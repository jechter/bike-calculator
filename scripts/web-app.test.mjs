import { expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);

async function expectPng(path, size) {
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(size);
  expect(bytes.readUInt32BE(20)).toBe(size);
  // RGB, not transparent: iOS supplies the rounded corners itself.
  expect(bytes[25]).toBe(2);
}

it('provides correctly sized touch and manifest icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('public/manifest.webmanifest', root), 'utf8'));
  expect(manifest.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
  for (const icon of manifest.icons) {
    expect(icon.type).toBe('image/png');
    expect(icon.purpose).toBe('any');
    await expectPng(new URL(icon.src, new URL('public/manifest.webmanifest', root)), Number(icon.sizes.split('x')[0]));
  }
  await expectPng(new URL('public/icons/apple-touch-icon.png', root), 180);
});

it('links the shared icons and manifest from root, nested, and legacy entry pages', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bikecalc-web-app-'));
  try {
    await mkdir(join(dir, 'dist'));
    await cp(new URL('public/', root), join(dir, 'dist'), { recursive: true });
    await writeFile(join(dir, 'dist/index.html'), await readFile(new URL('index.html', root)));
    execFileSync(process.execPath, [new URL('scripts/build-pages.mjs', root).pathname], { cwd: dir });
    const routes = JSON.parse(await readFile(new URL('src/routes.json', root), 'utf8'));
    const pages = ['', ...routes.flatMap(route => [route.slug, ...route.legacySlugs]).map(slug => `${slug}/`)];
    for (const page of pages) {
      const html = await readFile(join(dir, 'dist', page, 'index.html'), 'utf8');
      const icon = html.match(/rel="apple-touch-icon" sizes="180x180" href="([^"]+)"/)[1];
      const manifest = html.match(/rel="manifest" href="([^"]+)"/)[1];
      const pageUrl = new URL(page, 'https://example.com/nested/bikeworkshopcalc/');
      expect(new URL(icon, pageUrl).pathname).toBe('/nested/bikeworkshopcalc/icons/apple-touch-icon.png');
      expect(new URL(manifest, pageUrl).pathname).toBe('/nested/bikeworkshopcalc/manifest.webmanifest');
      await expectPng(join(dir, 'dist', page, icon), 180);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
