import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = "http://localhost:4320/";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

const results = [];
const ok = (name, cond, extra = "") => results.push([cond ? "PASS" : "FAIL", name, extra]);

async function load(hash) {
  // Force a full document load: a hash-only change wouldn't remount the SPA.
  await page.goto("about:blank");
  await page.goto(base + hash, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
}
const hash = () => page.evaluate(() => window.location.hash);

// 1. Fresh drivetrain load — clean-ish hash, no config params.
await load("#/drivetrain");
ok("drivetrain fresh hash has no query", !(await hash()).includes("?"), await hash());

// 2. Change cadence via the header/inputs → hash should carry it.
//    Find the cadence number input by its label text.
await page.evaluate(() => {
  // Change comparing toggle to exercise B encoding is complex; instead just poke
  // a number input for cadence: find input near "rpm" or the cadence slider.
});
// Type into the first NumberInput on the page is fragile; instead drive via URL.

// 3. Load a drivetrain link with explicit params and confirm they take effect.
await load("#/drivetrain?cr=53%2C39&cad=100&metric=ratio&cmp=1&bcr=48%2C32");
const dtState = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")];
  const texts = [...document.querySelectorAll("input[type=text]")].map((i) => i.value);
  return { texts };
});
ok("drivetrain chainring A applied from URL", dtState.texts.includes("53,39") || dtState.texts.includes("53, 39"), JSON.stringify(dtState.texts));
ok("drivetrain chainring B applied from URL", dtState.texts.includes("48,32") || dtState.texts.includes("48, 32"), JSON.stringify(dtState.texts));
ok("drivetrain hash preserved after load", (await hash()).includes("cmp=1"), await hash());

// 4. Wheel-building: fresh load clean.
await load("#/wheel-building");
ok("wheel fresh hash has no query", !(await hash()).includes("?"), await hash());

// 5. Wheel-building link with params applied.
await load("#/wheel-building?erd=580&n=28&ratio=2%3A1&ll=2x&hub=none");
const wbState = await page.evaluate(() => {
  const nums = [...document.querySelectorAll("input[type=number]")].map((i) => i.value);
  return { nums };
});
ok("wheel erd applied from URL", wbState.nums.includes("580"), JSON.stringify(wbState.nums));
ok("wheel spokes applied from URL", wbState.nums.includes("28"), JSON.stringify(wbState.nums));
ok("wheel hash preserved after load", (await hash()).includes("erd=580"), await hash());

// 6. Round-trip: mutate an input, confirm hash updates, reload that hash, confirm value sticks.
await load("#/wheel-building");
await page.evaluate(() => {
  const erd = [...document.querySelectorAll("input[type=number]")][0];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(erd, "615");
  erd.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 200));
const h = await hash();
ok("wheel hash updates after edit", h.includes("erd=615"), h);
await load(h);
const after = await page.evaluate(() => [...document.querySelectorAll("input[type=number]")][0].value);
ok("wheel edit round-trips through reload", after === "615", after);

// 7. Same-tab hashchange (pasting a shared link on the route already open) should
//    remount the page and apply the new config without a full reload.
await load("#/drivetrain");
await page.evaluate(() => {
  window.location.hash = "/drivetrain?cr=52%2C36";
});
await new Promise((r) => setTimeout(r, 300));
const pasted = await page.evaluate(() =>
  [...document.querySelectorAll("input[type=text]")].map((i) => i.value),
);
ok(
  "drivetrain applies config on same-tab hashchange",
  pasted.includes("52,36") || pasted.includes("52, 36"),
  JSON.stringify(pasted),
);

// 8. Editing after load must not wipe the config (replaceState, no remount): change
//    cadence-like field, ensure existing chainring text stays.
await load("#/drivetrain?cr=52%2C36");
await page.evaluate(() => {
  const num = [...document.querySelectorAll("input[type=number]")][0];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(num, String(Number(num.value) + 1));
  num.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 200));
const stillThere = await page.evaluate(() =>
  [...document.querySelectorAll("input[type=text]")].map((i) => i.value),
);
ok(
  "drivetrain keeps config after an edit (no remount wipe)",
  stillThere.includes("52,36") || stillThere.includes("52, 36"),
  JSON.stringify(stillThere),
);

await browser.close();

let failed = 0;
for (const [status, name, extra] of results) {
  if (status === "FAIL") failed++;
  console.log(`${status}  ${name}${status === "FAIL" ? "  <= " + extra : ""}`);
}
console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
process.exit(failed ? 1 : 0);
