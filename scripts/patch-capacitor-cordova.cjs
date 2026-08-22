/**
 * Capacitor cordova.js calls evt.toLowerCase() without null checks.
 * Re-apply guard after npm install.
 */
const fs = require("fs");
const path = require("path");

const cordovaPath = path.join(__dirname, "..", "node_modules", "@capacitor", "core", "cordova.js");

if (!fs.existsSync(cordovaPath)) {
  process.exit(0);
}

let src = fs.readFileSync(cordovaPath, "utf8");
const marker = "if (evt == null || evt === '') return;";

if (src.includes(marker)) {
  process.exit(0);
}

const replacements = [
  [
    "document.addEventListener = function (evt, handler, capture) {\n      var e = evt.toLowerCase();",
    "document.addEventListener = function (evt, handler, capture) {\n      if (evt == null || evt === '') return;\n      var e = evt.toLowerCase();",
  ],
  [
    "window.addEventListener = function (evt, handler, capture) {\n      var e = evt.toLowerCase();",
    "window.addEventListener = function (evt, handler, capture) {\n      if (evt == null || evt === '') return;\n      var e = evt.toLowerCase();",
  ],
  [
    "document.removeEventListener = function (evt, handler, capture) {\n      var e = evt.toLowerCase();",
    "document.removeEventListener = function (evt, handler, capture) {\n      if (evt == null || evt === '') return;\n      var e = evt.toLowerCase();",
  ],
  [
    "window.removeEventListener = function (evt, handler, capture) {\n      var e = evt.toLowerCase();",
    "window.removeEventListener = function (evt, handler, capture) {\n      if (evt == null || evt === '') return;\n      var e = evt.toLowerCase();",
  ],
];

for (const [from, to] of replacements) {
  if (!src.includes(from)) {
    console.warn("[patch-capacitor-cordova] Pattern not found; skipping one replacement.");
    continue;
  }
  src = src.replace(from, to);
}

fs.writeFileSync(cordovaPath, src);
console.log("[patch-capacitor-cordova] Patched @capacitor/core/cordova.js");
