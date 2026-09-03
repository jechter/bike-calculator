// Dev-only visual check: screenshot a page of the app via headless Chrome.
//
//   npm run build && npm run preview -- --port 4320 &
//   node scripts/screenshot.mjs '#/drivetrain' out.png ['.gc-dot']
//
// Args: route (hash), output path, optional selector to hover before shooting.
// Set CHROME_PATH to override the browser binary.
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.PREVIEW_URL || "http://localhost:4320/";
const route = process.argv[2] || "#/drivetrain";
const out = process.argv[3] || "screenshot.png";
const hover = process.argv[4];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });
await page.goto(base + route, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 400));
if (hover) {
  await page.hover(hover);
  await new Promise((r) => setTimeout(r, 200));
}
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("wrote", out);
