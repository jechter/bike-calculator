// Real directory entry points work on ordinary static hosting, including a
// subdirectory alongside WordPress. No catch-all rewrite rule is necessary.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const routes = JSON.parse(await readFile(new URL('../src/routes.json', import.meta.url), 'utf8'));
const template = await readFile('dist/index.html', 'utf8');
const origin = 'https://rueckenwind.berlin/bikeworkshopcalc/';
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function pageHtml(page, nested) {
  const prefix = nested ? '../' : './';
  const links = routes.map(r => `<li><a href="${prefix}${r.slug}/">${escape(r.title)}</a></li>`).join('\n');
  return template
    .replaceAll('./assets/', `${prefix}assets/`)
    .replace(/<title>.*?<\/title>/, `<title>${escape(page.title)} | Rückenwind</title>\n    <meta name="description" content="${escape(page.description)}" />\n    <link rel="canonical" href="${origin}${page.slug}/" />`)
    .replace('<div id="root"></div>', `<div id="root"><main><h1>${escape(page.title)}</h1><p>${escape(page.description)}</p><p>Use this free interactive calculator from the Rückenwind community bike workshop. Enable JavaScript to enter your measurements and see results.</p><nav aria-label="Calculators"><ul>${links}</ul></nav></main></div>`);
}
for (const page of routes) {
  await mkdir(`dist/${page.slug}`, { recursive: true });
  await writeFile(`dist/${page.slug}/index.html`, pageHtml(page, true));
}
await writeFile('dist/index.html', pageHtml(routes[0], false));
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(r => `  <url><loc>${origin}${r.slug}/</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Generated ${routes.length} calculator entry pages and sitemap.xml`);
