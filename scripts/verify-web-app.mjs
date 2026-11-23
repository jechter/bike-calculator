import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function linkHref(html, rel) {
  const link = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0])
    .find(tag => tag.includes(`rel="${rel}"`));
  const href = link?.match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error(`Missing ${rel} link on the live page`);
  return href;
}

export async function verifyWebApp(deployUrl, dist = new URL('../dist/', import.meta.url), request = fetch) {
  async function get(url) {
    const response = await request(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Live web-app verification failed: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const liveHtml = (await get(deployUrl)).toString();
  const localHtml = await readFile(new URL('index.html', dist), 'utf8');
  for (const rel of ['manifest', 'apple-touch-icon']) {
    // Compare resolved links so a missing or mis-scoped link cannot silently pass.
    const href = linkHref(localHtml, rel);
    const url = new URL(href, deployUrl);
    if (new URL(linkHref(liveHtml, rel), deployUrl).href !== url.href) {
      throw new Error(`Incorrect live ${rel} link`);
    }
    const local = await readFile(new URL(href, dist));
    if (!(await get(url)).equals(local)) throw new Error(`Live ${rel} differs from the build`);
  }
  const manifestUrl = new URL(linkHref(localHtml, 'manifest'), deployUrl);
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
  for (const icon of manifest.icons) {
    const expected = await readFile(new URL(icon.src, dist));
    if (!(await get(new URL(icon.src, manifestUrl))).equals(expected)) {
      throw new Error(`Live manifest icon (${icon.sizes}) differs from the build`);
    }
  }
  console.log('    Live manifest, iPhone touch icon, and manifest icons match the build.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DEPLOY_URL) throw new Error('DEPLOY_URL must be set');
  await verifyWebApp(process.env.DEPLOY_URL);
}
