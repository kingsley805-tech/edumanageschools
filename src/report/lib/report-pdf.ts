import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const REPORT_CAPTURE_WIDTH_PX = 860;
const FALLBACK_LOGO = "/shepherd-logo.svg";

type ImgSnapshot = {
  el: HTMLImageElement;
  src: string;
  crossOrigin: string | null;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Wait for web fonts and images inside the report card before capture. */
export async function waitForReportAssets(element: HTMLElement) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await Promise.all(
    Array.from(element.querySelectorAll("img")).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Fetch remote / Supabase storage images as data URLs for PDF capture. */
async function imageUrlToDataUrl(src: string): Promise<string | null> {
  if (!src || src.startsWith("data:")) return src;

  try {
    const url = new URL(src, window.location.href);
    if (url.origin === window.location.origin) {
      const resp = await fetch(src);
      if (resp.ok) return await blobToDataUrl(await resp.blob());
    }
  } catch {
    /* try other methods */
  }

  try {
    const resp = await fetch(src, { mode: "cors", credentials: "omit" });
    if (resp.ok) return await blobToDataUrl(await resp.blob());
  } catch {
    /* try storage API */
  }

  const storageMatch = src.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?|$)/);
  if (storageMatch) {
    const [, bucket, objectPath] = storageMatch;
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(decodeURIComponent(objectPath));
    if (!error && data) return await blobToDataUrl(data);
  }

  return null;
}

/** Replace cross-origin images with data URLs so html2canvas does not taint the canvas. */
async function inlineImagesForPdf(root: HTMLElement): Promise<() => void> {
  const snapshots: ImgSnapshot[] = [];
  const fallback = `${window.location.origin}${FALLBACK_LOGO}`;

  await Promise.all(
    Array.from(root.querySelectorAll("img")).map(async (img) => {
      snapshots.push({
        el: img,
        src: img.src,
        crossOrigin: img.getAttribute("crossorigin"),
      });

      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) return;

      const dataUrl = await imageUrlToDataUrl(src);
      if (dataUrl) {
        img.removeAttribute("crossorigin");
        img.src = dataUrl;
        return;
      }

      img.removeAttribute("crossorigin");
      img.src = fallback;
    }),
  );

  await waitForReportAssets(root);

  return () => {
    for (const { el, src, crossOrigin } of snapshots) {
      el.src = src;
      if (crossOrigin) el.setAttribute("crossorigin", crossOrigin);
      else el.removeAttribute("crossorigin");
    }
  };
}

function sanitizeCloneDocument(doc: Document) {
  // html2canvas cannot parse Tailwind v4 oklch/color-mix from the app stylesheet.
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());
  doc.querySelectorAll("style").forEach((node) => node.remove());
}

function injectReportStyles(doc: Document) {
  const source = document.querySelector("style[data-report-export]");
  if (source) {
    doc.head.appendChild(source.cloneNode(true));
  } else {
    document.querySelectorAll("style").forEach((node) => {
      const text = node.textContent ?? "";
      if (text.includes(".rc-card")) {
        doc.head.appendChild(node.cloneNode(true));
      }
    });
  }

  if (!doc.querySelector('link[href*="Manrope"]')) {
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap";
    doc.head.appendChild(link);
  }
}

const RESOLVED_COLOR_PROPS = [
  "color",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "fill",
  "stroke",
] as const;

/** Copy browser-resolved rgb/hex colors so clone never references oklch CSS variables. */
function copyResolvedColors(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const sourceNodes: Element[] = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
  const cloneNodes: Element[] = [cloneRoot, ...cloneRoot.querySelectorAll("*")];
  const len = Math.min(sourceNodes.length, cloneNodes.length);

  for (let i = 0; i < len; i++) {
    const src = sourceNodes[i];
    const clone = cloneNodes[i];
    if (!(src instanceof HTMLElement) || !(clone instanceof HTMLElement)) continue;

    const computed = window.getComputedStyle(src);
    for (const prop of RESOLVED_COLOR_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value && value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
        clone.style.setProperty(prop, value);
      }
    }
  }

  cloneRoot.style.setProperty("background", "#ffffff", "important");
  cloneRoot.style.setProperty("color", "#0a0a0a", "important");
}

function prepareCloneDocument(
  sourceRoot: HTMLElement,
  doc: Document,
  clone: HTMLElement,
) {
  sanitizeCloneDocument(doc);
  injectReportStyles(doc);
  prepareReportClone(doc, clone);
  copyResolvedColors(sourceRoot, clone);
}

function prepareReportClone(_doc: Document, clone: HTMLElement) {
  clone.classList.add("rc-exporting");
  clone.style.width = `${REPORT_CAPTURE_WIDTH_PX}px`;
  clone.style.maxWidth = `${REPORT_CAPTURE_WIDTH_PX}px`;
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";
  clone.style.overflow = "visible";
  clone.style.transform = "none";
  clone.style.background = "#ffffff";

  clone.querySelectorAll<HTMLElement>(".rc-bar-fill").forEach((bar) => {
    bar.style.transition = "none";
    const row = bar.closest("tr");
    const scoreText = row?.querySelector(".rc-score-num")?.textContent?.trim();
    const total = Number.parseFloat(scoreText || "0");
    if (!Number.isNaN(total) && total > 0) {
      bar.style.width = `${Math.min(total, 100)}%`;
    }
  });

  clone.querySelectorAll<HTMLElement>("input, textarea").forEach((input) => {
    const value = (input as HTMLInputElement).value;
    const span = _doc.createElement("span");
    span.textContent = value || "—";
    span.className = input.className.includes("rc-stat-input")
      ? "rc-stat-value"
      : input.className.includes("rc-cell-input")
        ? "rc-score-num"
        : "rc-info-value";
    input.replaceWith(span);
  });

  clone.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    img.removeAttribute("crossorigin");
    if (img.src.startsWith("data:")) return;
    try {
      const url = new URL(img.src, window.location.href);
      if (url.origin !== window.location.origin) {
        img.src = `${window.location.origin}${FALLBACK_LOGO}`;
      }
    } catch {
      img.src = `${window.location.origin}${FALLBACK_LOGO}`;
    }
  });
}

function canvasToImageData(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return canvas.toDataURL("image/jpeg", 0.92);
  }
}

/** Add captured canvas to PDF — single page when possible, no trailing blank pages. */
function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, margin: number) {
  const usableW = A4_WIDTH_MM - margin * 2;
  const usableH = A4_HEIGHT_MM - margin * 2;
  const imgW = usableW;
  let imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvasToImageData(canvas);
  const format = imgData.startsWith("data:image/png") ? "PNG" : "JPEG";

  // Slightly-tall reports: scale to one page instead of a nearly empty second page
  if (imgH > usableH && imgH <= usableH * 1.12) {
    imgH = usableH;
  }

  if (imgH <= usableH) {
    pdf.addImage(imgData, format, margin, margin, imgW, imgH);
    return;
  }

  const pageCanvasH = Math.floor((usableH * canvas.width) / imgW);
  if (pageCanvasH < 8) {
    pdf.addImage(imgData, format, margin, margin, imgW, usableH);
    return;
  }

  let rendered = 0;
  let page = 0;

  while (rendered < canvas.height - 1) {
    const sliceH = Math.min(pageCanvasH, canvas.height - rendered);
    if (sliceH < 8) break;

    if (page > 0) pdf.addPage();

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) break;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    const sliceHmm = (sliceH * imgW) / canvas.width;
    const sliceData = canvasToImageData(slice);
    const sliceFormat = sliceData.startsWith("data:image/png") ? "PNG" : "JPEG";
    pdf.addImage(sliceData, sliceFormat, margin, margin, imgW, sliceHmm);

    rendered += sliceH;
    page += 1;
  }
}

function disableAppStylesheets(): () => void {
  const touchedLinks: HTMLLinkElement[] = [];
  const touchedStyles: { node: HTMLStyleElement; media: string | null }[] = [];

  document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
    const link = node as HTMLLinkElement;
    if (
      link.disabled ||
      !link.href ||
      link.href.includes("fonts.googleapis.com") ||
      link.href.includes("fonts.gstatic.com")
    ) {
      return;
    }
    link.disabled = true;
    touchedLinks.push(link);
  });

  document.querySelectorAll("style").forEach((node) => {
    if (node.hasAttribute("data-report-export")) return;
    const text = node.textContent ?? "";
    if (!text.includes("oklch") && !text.includes("color-mix")) return;
    const style = node as HTMLStyleElement;
    touchedStyles.push({ node: style, media: style.media || null });
    style.media = "not all";
  });

  return () => {
    for (const link of touchedLinks) link.disabled = false;
    for (const { node, media } of touchedStyles) {
      if (media) node.media = media;
      else node.removeAttribute("media");
    }
  };
}

/** Capture a report card element to canvas (for single or merged PDF export). */
export async function captureReportElement(element: HTMLElement): Promise<HTMLCanvasElement> {
  const prevOverflow = element.style.overflow;
  const prevWidth = element.style.width;
  const prevMaxWidth = element.style.maxWidth;

  element.classList.add("rc-exporting");
  element.style.overflow = "visible";
  element.style.width = `${REPORT_CAPTURE_WIDTH_PX}px`;
  element.style.maxWidth = `${REPORT_CAPTURE_WIDTH_PX}px`;

  const restoreImages = await inlineImagesForPdf(element);
  const restoreStylesheets = disableAppStylesheets();

  const sandbox = document.createElement("div");
  sandbox.setAttribute("data-pdf-capture", "true");
  sandbox.style.cssText = [
    "position:fixed",
    "left:-20000px",
    "top:0",
    "width:860px",
    "background:#ffffff",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");

  const reportStyle = document.querySelector("style[data-report-export]");
  if (reportStyle) {
    sandbox.appendChild(reportStyle.cloneNode(true));
  }

  const captureRoot = element.cloneNode(true) as HTMLElement;
  sandbox.appendChild(captureRoot);
  document.body.appendChild(sandbox);

  prepareReportClone(document, captureRoot);
  copyResolvedColors(element, captureRoot);

  try {
    await waitForReportAssets(captureRoot);

    const scale = Math.min(2, 8192 / Math.max(captureRoot.scrollHeight, 1));

    const canvas = await html2canvas(captureRoot, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: captureRoot.scrollWidth,
      height: captureRoot.scrollHeight,
      windowWidth: captureRoot.scrollWidth,
      windowHeight: captureRoot.scrollHeight,
      onclone: (doc, clone) => {
        prepareCloneDocument(captureRoot, doc, clone);
      },
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("Could not capture the report layout.");
    }

    return canvas;
  } finally {
    sandbox.remove();
    restoreStylesheets();
    restoreImages();
    element.style.overflow = prevOverflow;
    element.style.width = prevWidth;
    element.style.maxWidth = prevMaxWidth;
    element.classList.remove("rc-exporting");
  }
}

export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const canvas = await captureReportElement(element);
  const pdf = new jsPDF("p", "mm", "a4");
  addCanvasToPdf(pdf, canvas, 8);
  pdf.save(filename);
}

/** One PDF file with each report card starting on a new page (or continued across pages if tall). */
export async function exportElementsToMergedPdf(elements: HTMLElement[], filename: string) {
  if (!elements.length) {
    throw new Error("No report cards to export.");
  }

  const pdf = new jsPDF("p", "mm", "a4");
  for (let i = 0; i < elements.length; i++) {
    const canvas = await captureReportElement(elements[i]);
    if (i > 0) pdf.addPage();
    addCanvasToPdf(pdf, canvas, 8);
  }
  pdf.save(filename);
}

export async function printBulkReportCards(container: HTMLElement) {
  await waitForReportAssets(container);
  document.body.classList.add("printing-report", "printing-bulk");
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      document.body.classList.remove("printing-report", "printing-bulk");
      window.removeEventListener("afterprint", onAfter);
    };
    const onAfter = () => {
      cleanup();
      resolve();
    };
    window.addEventListener("afterprint", onAfter, { once: true });
    try {
      window.print();
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

export function printElement(_element?: HTMLElement | null) {
  window.print();
}
