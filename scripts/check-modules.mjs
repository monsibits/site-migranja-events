/**
 * Syntax-check and import every front-end JS module.
 * Catches top-level ReferenceErrors (like a handler left outside its function)
 * that node --check alone will not see.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function listJs(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    if (name === "node_modules" || name === ".git" || name === "scripts") continue;
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...await listJs(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function stubEl() {
  const el = {
    hidden: false,
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: "",
    textContent: "",
    value: "",
    href: "",
    id: "",
    name: "",
    checked: false,
    dataset: {},
    parentNode: null,
    addEventListener() {},
    removeEventListener() {},
    append() {},
    appendChild(node) { return node; },
    remove() {},
    focus() {},
    click() {},
    closest() { return null; },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    querySelector() { return stubEl(); },
    querySelectorAll() { return []; },
    getElementById() { return stubEl(); }
  };
  return el;
}

function setProp(obj, key, value) {
  try {
    obj[key] = value;
  } catch {
    try {
      Object.defineProperty(obj, key, { configurable: true, writable: true, value });
    } catch {
      /* built-in getter only */
    }
  }
}

function installBrowserShim() {
  if (globalThis.__mgModuleShim) return;
  globalThis.__mgModuleShim = true;
  const doc = stubEl();
  doc.body = stubEl();
  doc.documentElement = stubEl();
  doc.location = { href: "https://www.migranjaevents.com/portal/", hash: "", pathname: "/portal/" };
  doc.createElement = () => stubEl();
  doc.createElementNS = () => stubEl();
  const loc = { href: "https://www.migranjaevents.com/portal/", hash: "", pathname: "/portal/", origin: "https://www.migranjaevents.com", assign() {}, replace() {}, reload() {} };
  setProp(globalThis, "window", globalThis);
  const win = globalThis.window || globalThis;
  setProp(globalThis, "document", doc);
  setProp(globalThis, "location", loc);
  setProp(win, "location", loc);
  if (typeof win.addEventListener !== "function") win.addEventListener = () => {};
  if (typeof win.removeEventListener !== "function") win.removeEventListener = () => {};
  setProp(globalThis, "localStorage", { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} });
  setProp(globalThis, "sessionStorage", globalThis.localStorage);
  setProp(globalThis, "history", { pushState() {}, replaceState() {} });
  if (typeof win.matchMedia !== "function") win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  if (typeof win.getComputedStyle !== "function") win.getComputedStyle = () => ({ getPropertyValue() { return ""; } });
  if (typeof win.requestAnimationFrame !== "function") win.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  if (!win.HTMLElement) win.HTMLElement = class HTMLElement {};
  if (!win.customElements) win.customElements = { define() {}, get() { return undefined; } };
  if (!globalThis.fetch) globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "", headers: new Map() });
}

const files = (await listJs(root)).sort();
if (!files.length) {
  console.error("No JavaScript modules found.");
  process.exit(1);
}

const failed = [];
for (const file of files) {
  const rel = relative(root, file);
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status !== 0) {
    failed.push(`${rel}: syntax\n${(check.stderr || check.stdout || "").trim()}`);
    console.log(`FAIL  ${rel} — syntax`);
    continue;
  }
  try {
    const src = await readFile(file, "utf8");
    if (/\bimport\s+|^\s*export\s+/m.test(src)) {
      installBrowserShim();
      await import(pathToFileURL(file).href + `?check=${Date.now()}-${Math.random()}`);
    }
    console.log(`PASS  ${rel}`);
  } catch (err) {
    failed.push(`${rel}: import ${err && err.stack ? err.stack : err}`);
    console.log(`FAIL  ${rel} — ${err && err.message ? err.message : err}`);
  }
}

if (failed.length) {
  console.error(`\n${failed.length} module check(s) failed:\n${failed.join("\n\n")}`);
  process.exit(1);
}
console.log(`All ${files.length} JavaScript modules parsed and imported.`);
