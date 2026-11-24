import { expect, it } from 'vitest';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';

it('serves the linked privacy document in Vite without falling back to the calculator app', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  try {
    await server.listen();
    const address = server.httpServer.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/privacy/index.html`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<h1>Privacy notice</h1>');
    const email = ['bikeworkshopcalculator', 'jonasechterhoff.com'].join('@');
    const street = ['Riesestr', '17'].join(' ');
    const city = ['12347', 'Berlin'].join(' ');
    expect(html).not.toContain(email);
    const componentSource = await readFile(new URL('../src/components/Derailleur.tsx', import.meta.url), 'utf8');
    const encodedMailbox = componentSource.match(/const PROPOSAL_MAILBOX = (\[[\d,\s]+\]);/);
    expect(encodedMailbox).not.toBeNull();
    const proposalEmail = String.fromCharCode(...JSON.parse(encodedMailbox[1]).map(code => code - 1));
    expect(proposalEmail).toBe(email);
    expect(componentSource).not.toContain(email);
    expect(html).not.toContain(street);
    expect(html).not.toContain(city);
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    try {
      const link = dom.window.document.getElementById('privacy-email');
      expect(link.textContent).toBe(email);
      expect(link.getAttribute('href')).toBe('mailto:' + email);
      const postal = dom.window.document.getElementById('privacy-postal');
      expect(postal.textContent).toBe(street + city + 'Germany');
      expect(postal.querySelectorAll('br').length).toBe(3);
      expect(dom.window.document.querySelector('noscript').textContent).toContain('Enable JavaScript');
    } finally {
      dom.window.close();
    }
    expect(html).toContain('<time datetime="2026-11-16">November 16, 2026</time>');
    expect(html).not.toContain('[CONFIRM');
    expect(html).not.toContain('Draft — not ready for public launch');
    expect(html).toContain('href="https://supabase.com/legal/customer-resources/data-processing-addendum"');
    expect(html).toContain('href="https://www.strato.de/agb/avv/"');
    expect(html).toContain('<strong>STRATO GmbH:</strong>');
    expect(html).toContain('Not every listed subprocessor is used for our SMTP service.');
    expect(html).toContain('href="https://www.intervals.icu/privacy-policy/"');
    expect(html).toContain('href="https://www.ionos.de/terms-gtc/terms-privacy"');
    expect(html).toContain('IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, Germany');
    expect(html).toContain('those examples do not establish the retention setting for rueckenwind.berlin');
    expect(html).toContain('Intervals.icu Ltd., 71-75 Shelton Street');
    expect(html).toContain('not a backup-deletion deadline for our Supabase garage');
    expect(html).toContain('OAuth with PKCE');
    expect(html).toContain('SETTINGS:READ');
    expect(html).toContain('encrypted in Supabase Vault');
    expect(html).not.toContain('OAuth access token is kept only in page memory');
    expect(html).toContain('maintenance-intervals-oauth-v1');
    expect(html).not.toContain('your browser sends your API key');
    expect(html).not.toContain('The linked policy has not yet been reviewed');
    expect(html).toContain('href="https://rueckenwind.berlin/datenschutzerklaerung/"');
    expect(html).not.toContain('/src/main.tsx');
    expect(html).not.toContain('id="root"');
  } finally {
    await server.close();
  }
});
