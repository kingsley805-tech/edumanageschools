/** Opens a print-friendly window for the current lesson note preview area. */
export function printLessonNote(elementId = "lesson-note-print-root") {
  const root = document.getElementById(elementId);
  if (!root) {
    window.print();
    return;
  }
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`
    <!DOCTYPE html>
    <html><head><title>Lesson Note</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; color: #111; line-height: 1.5; }
      h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
      h2 { font-size: 1rem; margin: 1.25rem 0 0.5rem; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      .meta { color: #555; font-size: 0.9rem; margin-bottom: 1rem; }
      .field { margin-bottom: 0.75rem; }
      .field label { font-weight: 600; display: block; font-size: 0.85rem; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>${root.innerHTML}</body></html>
  `);
  w.document.close();
  w.focus();
  w.onload = () => {
    w.print();
    w.close();
  };
}
