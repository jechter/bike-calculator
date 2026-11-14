// Real-browser layout regression check. Start Vite/preview first, then run:
// CHROME_PATH=/path/to/chromium PREVIEW_URL=http://localhost:5173/ node scripts/check-header-dividers.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const routes = JSON.parse(await readFile(new URL('../src/routes.json', import.meta.url), 'utf8'));
const base = process.env.PREVIEW_URL || 'http://localhost:4320/';
if (!process.env.CHROME_PATH) throw new Error('Set CHROME_PATH to your Chromium/Chrome executable.');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
let checked = 0;
try {
  const page = await browser.newPage();
  // This fresh browser profile has no real account/session, and sends no auth requests.
  await page.goto(base, { waitUntil: 'networkidle0' });
  for (const width of [1280, 1920, 2560]) {
    await page.setViewport({ width, height: 1000 });
    for (const collapsed of [false, true]) {
      await page.evaluate(value => localStorage.setItem('nav-collapsed', value ? '1' : '0'), collapsed);
      for (const route of routes) {
        await page.goto(new URL(route.slug + '/', base).href, { waitUntil: 'networkidle0' });
        const layout = await page.evaluate(() => {
          const main = document.querySelector('main');
          const header = main.querySelector('.main-head, .fs-head');
          const box = header.getBoundingClientRect();
          const section = main.querySelector(':scope > .section');
          return {
            left: box.left, right: box.right, mainLeft: main.getBoundingClientRect().left,
            viewport: document.documentElement.clientWidth,
            border: parseFloat(getComputedStyle(header).borderBottomWidth),
            contentWidth: section?.getBoundingClientRect().width,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        });
        const label = `${route.id}, ${width}px, ${collapsed ? 'collapsed' : 'expanded'} sidebar`;
        assert.ok(Math.abs(layout.left - layout.mainLeft) < 1, `${label}: divider has a left gap`);
        assert.ok(Math.abs(layout.right - layout.viewport) < 1, `${label}: divider has a right gap`);
        assert.equal(layout.border, 1, `${label}: missing divider`);
        assert.equal(layout.overflow, false, `${label}: horizontal page overflow`);
        if (['tire', 'power', 'thread-direction'].includes(route.id)) {
          const expected = Math.min(836, layout.viewport - layout.mainLeft - 64);
          assert.ok(Math.abs(layout.contentWidth - expected) < 1, `${label}: reading width changed`);
        }
        checked++;
      }
    }
  }
  for (const width of [390, 1000]) {
    await page.setViewport({ width, height: 844 });
    for (const route of routes) {
      await page.goto(new URL(route.slug + '/', base).href, { waitUntil: 'networkidle0' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${route.id}, ${width}px: horizontal page overflow`);
      checked++;
    }
  }
  console.log(`Passed ${checked} page layouts: full-width desktop dividers, unchanged reading widths, and no horizontal overflow.`);
} finally {
  await browser.close();
}
