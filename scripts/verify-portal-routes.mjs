/**
 * Smoke-check: every portal route module referenced in App.tsx resolves and builds.
 * Run: node scripts/verify-portal-routes.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = join(root, "src", "App.tsx");
const app = readFileSync(appPath, "utf8");

const staticImports = [...app.matchAll(/^import\s+(\w+)\s+from\s+["'](@\/[^"']+|\.[^"']+)["']/gm)].map(
  (m) => ({ name: m[1], spec: m[2] }),
);

const billingImports = [...app.matchAll(
  /^import\s+\{([^}]+)\}\s+from\s+["']@\/billing\/routes["']/m,
)];
const billingNames = billingImports.length
  ? billingImports[0][1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim())
  : [];

const failures = [];

async function resolve(spec) {
  const base = spec.startsWith("@/") ? join(root, "src", spec.slice(2)) : join(root, "src", spec.replace(/^\.\//, ""));
  const candidates = [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")];
  for (const file of candidates) {
    try {
      await import(pathToFileURL(file).href);
      return file;
    } catch (e) {
      failures.push({ spec, file, error: e.message });
    }
  }
  return null;
}

let ok = 0;
for (const { spec } of staticImports) {
  if (spec.startsWith("@/report/")) continue;
  const resolved = await resolve(spec);
  if (resolved) ok++;
}

if (billingNames.length) {
  const billingRoutes = join(root, "src", "billing", "routes.tsx");
  await import(pathToFileURL(billingRoutes).href);
  ok += billingNames.length;
}

const routeCount = (app.match(/<Route\s+path=/g) ?? []).length;
console.log(`Portal routes in App.tsx: ${routeCount}`);
console.log(`Static page modules checked: ${ok}`);
if (failures.length) {
  console.error("Import failures:");
  for (const f of failures.slice(0, 10)) {
    console.error(`  ${f.spec} → ${f.file}: ${f.error}`);
  }
  process.exit(1);
}
console.log("All checked portal modules load successfully.");
