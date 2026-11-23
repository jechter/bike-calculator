import { expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { verifyWebApp } from './verify-web-app.mjs';

it('uploads all build files and runs web-app verification without touching other remote paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bikecalc-deploy-'));
  try {
    await mkdir(join(dir, 'scripts'));
    await mkdir(join(dir, 'bin'));
    await cp(new URL('./deploy.sh', import.meta.url), join(dir, 'scripts/deploy.sh'));
    const files = ['assets/index-new.js', 'assets/index-new.css', 'index.html', 'manifest.webmanifest', 'sitemap.xml', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'privacy/index.html', 'calculator/index.html', 'future/nested/file.txt'];
    for (const file of files) {
      await mkdir(join(dir, 'dist', file, '..'), { recursive: true });
      await writeFile(join(dir, 'dist', file), 'fixture');
    }
    const commands = {
      git: 'exit 0', npm: 'exit 0',
      expect: 'cat >> "$CAPTURE"; printf "index-new.js\\nindex-new.css\\n"',
      curl: 'printf "index-new.js\\nindex-new.css\\n"',
      node: 'printf "%s\\n" "$*" >> "$VERIFY_CAPTURE"',
    };
    for (const [name, script] of Object.entries(commands)) {
      await writeFile(join(dir, 'bin', name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    }
    execFileSync('bash', [join(dir, 'scripts/deploy.sh')], { env: {
      ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      DEPLOY_USER: 'fixture', DEPLOY_HOST: 'fixture.invalid', PASSWORD: 'not-a-secret',
      REMOTE_DIR: '/calculator-only', DEPLOY_URL: 'https://example.com/calculator-only/',
      CAPTURE: join(dir, 'capture'), VERIFY_CAPTURE: join(dir, 'verify'),
    } });
    const upload = await readFile(join(dir, 'capture'), 'utf8');
    expect(upload).toContain('cd /calculator-only');
    for (const file of files.filter(file => !file.startsWith('assets/') && file !== 'index.html')) {
      expect(upload).toContain(`put ${file} ${file}`);
    }
    expect(upload).toContain('put *');
    expect(upload.indexOf('put index.html')).toBeGreaterThan(upload.indexOf('put icons/icon-512.png'));
    expect(upload).not.toContain('.htaccess');
    expect(await readFile(join(dir, 'verify'), 'utf8')).toContain('scripts/verify-web-app.mjs');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('verifies live web-app bytes and rejects missing or stale icons', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bikecalc-verify-'));
  try {
    await cp(new URL('../public/', import.meta.url), dir, { recursive: true });
    await cp(new URL('../index.html', import.meta.url), join(dir, 'index.html'));
    const base = 'https://example.com/calculator/';
    const dist = pathToFileURL(dir + '/');
    const request = async url => {
      const path = new URL(url).pathname.slice('/calculator/'.length) || 'index.html';
      return new Response(await readFile(new URL(path, dist)));
    };
    await verifyWebApp(base, dist, request);
    await expect(verifyWebApp(base, dist, async (url, options) =>
      String(url).endsWith('icon-512.png') ? new Response('stale') : request(url, options)
    )).rejects.toThrow('differs from the build');
    await expect(verifyWebApp(base, dist, async (url, options) =>
      String(url).endsWith('apple-touch-icon.png') ? new Response('', { status: 404 }) : request(url, options)
    )).rejects.toThrow('HTTP 404');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
