// Read-only personal-account probe. Never logs credentials or raw API responses.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const base = 'https://intervals.icu';
const select = (object, keys) => Object.fromEntries(keys.filter(key => object?.[key] !== undefined).map(key => [key, object[key]]));
const numericDistance = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function summarizeGear(items) {
  if (!Array.isArray(items)) throw new Error('Unexpected gear response format.');
  return items.map(item => ({
    ...select(item, ['id', 'name', 'type', 'component', 'component_ids', 'retired', 'distance', 'time', 'activities']),
    reminders: (Array.isArray(item.reminders) ? item.reminders : []).map(reminder => select(reminder, ['id', 'name', 'distance', 'distance_used', 'starting_distance', 'last_reset', 'days'])),
  }));
}
export function summarizeActivities(items) {
  if (!Array.isArray(items)) throw new Error('Unexpected activities response format.');
  return items.map(item => ({ ...select(item, ['id', 'start_date_local', 'type', 'distance', 'icu_distance', 'source', 'device_name']), ...(item.gear ? { gear: select(item.gear, ['id', 'name']) } : {}) }));
}
export async function probeIntervals(key, { request = fetch, now = new Date() } = {}) {
  if (!key || /[\s:]/.test(key) || key.length > 4096) throw new Error('Supply a valid personal API key in the local credentials file.');
  const newest = now.toISOString().slice(0, 10);
  const oldest = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({ oldest, newest, limit: '30', fields: 'id,start_date_local,type,distance,icu_distance,gear,source,device_name' });
  const report = { checked_at: now.toISOString(), window: { oldest, newest, limit: 30 }, endpoints: {}, profile: null, gear: [], activities: [], notes: [
    'Read-only GET requests only. No account, gear, or activity data was changed.',
    'This report omits email, health metrics, activity titles, routes, and GPS data. It still contains personal gear names, IDs, activity dates, and device names; keep it private.',
    'Distance values are retained exactly as returned. Compare one bike total with the Intervals.icu UI to confirm units and completeness.',
    'This is a limited recent sample, not a lifetime mileage calculation. Missing fields or stub activities do not establish which source was withheld.',
    'An accessible aggregate total is not proof that downstream use of all contributing sources is permitted.',
  ] };
  const endpoints = [
    ['profile', '/api/v1/athlete/0', data => select(data, ['id', 'name'])],
    ['gear', '/api/v1/athlete/0/gear', summarizeGear],
    ['activities', '/api/v1/athlete/0/activities?' + params, summarizeActivities],
  ];
  for (const [name, path, summarize] of endpoints) {
    try {
      const response = await request(base + path, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Basic ' + Buffer.from('API_KEY:' + key).toString('base64'), Accept: 'application/json', 'User-Agent': 'BikeWorkshopMaintenanceProbe/1.0' } });
      report.endpoints[name] = { status: response.status, rate_limit_remaining: response.headers.get('X-RateLimit-Remaining') };
      if (!response.ok) {
        report.endpoints[name].error = response.status === 401 ? 'API key rejected. Check or regenerate it in Intervals.icu settings.' : response.status === 403 ? 'Access denied. This alone does not establish why access was denied.' : response.status === 429 ? 'Rate limited. Retry later.' : 'Request failed; response body intentionally omitted.';
        if (response.status === 401 || response.status === 429) break;
        continue;
      }
      report[name] = summarize(await response.json());
    } catch {
      // Error objects and response bodies may contain sensitive data: never echo them.
      report.endpoints[name] = { error: 'Network, timeout, or unexpected response error. No response body logged.' };
    }
  }
  report.summary = {
    bikes_returned: report.gear.filter(item => item.type === 'Bike' && !item.component).length,
    components_returned: report.gear.filter(item => item.component === true).length,
    activities_returned: report.activities.length,
    activities_with_distance: report.activities.filter(item => numericDistance(item.distance)).length,
    activities_with_gear: report.activities.filter(item => item.gear?.id).length,
    sources: [...new Set(report.activities.map(item => item.source).filter(Boolean))],
  };
  return report;
}
async function main() {
  const keyFile = resolve(process.env.INTERVALS_API_KEY_FILE || '.intervals-api-key.local');
  let key;
  try { key = (await readFile(keyFile, 'utf8')).split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).join('').trim(); }
  catch { throw new Error('Create .intervals-api-key.local with your personal API key. Do not paste it into chat or put it on the command line.'); }
  const report = await probeIntervals(key);
  const output = resolve('artifacts/intervals-probe.local.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log('Private, filtered report saved to artifacts/intervals-probe.local.json');
  console.log(JSON.stringify({ endpoints: report.endpoints, summary: report.summary }, null, 2));
  if (Object.values(report.endpoints).some(result => result.error)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Probe could not start. Put only your personal API key in .intervals-api-key.local (comment lines are allowed), then retry. No credentials were logged.'); process.exitCode = 1; });
}
