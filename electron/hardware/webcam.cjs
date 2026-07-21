/**
 * Webcam / face-capture helpers.
 * Capture happens in the renderer via getUserMedia; main process persists images.
 */
const fs = require("fs");
const path = require("path");
const paths = require("../utils/paths.cjs");

function saveCapture({ dataBase64, category = "photos", fileName } = {}) {
  if (!dataBase64) throw new Error("Missing image data");
  const raw = String(dataBase64).replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  const dir =
    category === "photos"
      ? paths.getPhotosDir()
      : paths.getDocumentsDir(category);
  const name = fileName || `capture-${Date.now()}.jpg`;
  const full = path.join(dir, name);
  fs.writeFileSync(full, buffer);
  return { path: full, size: buffer.length };
}

module.exports = { saveCapture };
