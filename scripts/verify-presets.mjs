import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = "http://localhost:4320/";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

const results = [];
const ok = (name, cond, extra = "") => results.push([cond ? "PASS" : "FAIL", name, extra]);

async function load(hash) {
  await page.goto("about:blank");
  await page.goto(base + hash, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
}
const nums = () => page.evaluate(() => [...document.querySelectorAll("input[type=number]")].map((i) => i.value));

await load("#/wheel-building");

// The menu button exists.
const btn = await page.$(".wb-examples .copy-link-btn");
ok("examples menu button present", !!btn);

// Open it and count the presets + group headers.
await btn.click();
await new Promise((r) => setTimeout(r, 150));
const menu = await page.evaluate(() => {
  const items = [...document.querySelectorAll(".wb-examples-list li")];
  return {
    groups: items.filter((li) => li.classList.contains("preset-group")).map((li) => li.textContent),
    presets: items.filter((li) => !li.classList.contains("preset-group")).map((li) => li.textContent.trim()),
  };
});
ok("two groups shown", menu.groups.length === 2, JSON.stringify(menu.groups));
ok("all 10 presets shown", menu.presets.length === 10, JSON.stringify(menu.presets));

// Pick "64-spoke Yamaha XS650 Heritage" and confirm the config loads.
const picked = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".wb-examples-list button")].find((x) =>
    x.textContent.includes("Yamaha"),
  );
  if (b) b.click();
  return !!b;
});
ok("clicked Yamaha preset", picked);
await new Promise((r) => setTimeout(r, 500));

const hash = await page.evaluate(() => window.location.hash);
ok("hash reflects the preset", hash.includes("n=64") && hash.includes("erd=502"), hash);

const after = await nums();
ok("spoke count applied (64)", after.includes("64"), JSON.stringify(after));
ok("ERD applied (502)", after.includes("502"), JSON.stringify(after));

// Pick the standard 36-spoke preset next; confirm it re-seeds without reload.
await page.evaluate(() => {
  document.querySelector(".wb-examples .copy-link-btn").click();
});
await new Promise((r) => setTimeout(r, 120));
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".wb-examples-list button")].find((x) =>
    x.textContent.includes("36-spoke"),
  );
  b.click();
});
await new Promise((r) => setTimeout(r, 500));
const after36 = await nums();
ok("switching presets re-seeds (36 spokes)", after36.includes("36"), JSON.stringify(after36));

await browser.close();

let failed = 0;
for (const [status, name, extra] of results) {
  if (status === "FAIL") failed++;
  console.log(`${status}  ${name}${status === "FAIL" ? "  <= " + extra : ""}`);
}
console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
process.exit(failed ? 1 : 0);
