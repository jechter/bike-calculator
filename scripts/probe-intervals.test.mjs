import { expect, it, vi } from 'vitest';
import { probeIntervals } from './probe-intervals.mjs';
const now = new Date('2026-11-03T12:00:00Z');
it('only reads fixed Intervals endpoints and filters sensitive fields from the report', async () => {
  const payloads = [
    { id: 'i123', name: 'Rider', email: 'private@example.com', api_key: 'test-key', weight: 80 },
    [{ id: 'bike-1', type: 'Bike', name: 'Road bike', distance: 4826500, notes: 'Private note', reminders: [{ id: 1, name: 'Chain', distance_used: 200, secret: 'hidden' }] }, { id: 'chain-1', component: true, type: 'Chain' }],
    [{ id: 'ride-1', source: 'UPLOAD', distance: 20000, gear: { id: 'bike-1', name: 'Road bike', secret: 'hidden' }, name: 'Private activity title', latlng: [1, 2], average_heartrate: 150 }, { id: 'stub' }],
  ];
  const request = vi.fn(async () => new Response(JSON.stringify(payloads.shift()), { status: 200 }));
  const report = await probeIntervals('test-key', { request, now });
  expect(request).toHaveBeenCalledTimes(3);
  for (const [url, options] of request.mock.calls) {
    expect(new URL(url).origin).toBe('https://intervals.icu');
    expect(options.method).toBe('GET');
    expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBe('Basic ' + Buffer.from('API_KEY:test-key').toString('base64'));
  }
  const activitiesUrl = new URL(request.mock.calls[2][0]);
  expect(activitiesUrl.searchParams.get('oldest')).toBe('2026-10-04');
  expect(activitiesUrl.searchParams.get('limit')).toBe('30');
  expect(report.profile).toEqual({ id: 'i123', name: 'Rider' });
  expect(report.gear[0].distance).toBe(4826500);
  expect(report.summary).toEqual({ bikes_returned: 1, components_returned: 1, activities_returned: 2, activities_with_distance: 1, activities_with_gear: 1, sources: ['UPLOAD'] });
  for (const value of ['test-key', 'private@example.com', 'Private note', 'Private activity title', 'latlng', 'average_heartrate', 'hidden']) expect(JSON.stringify(report)).not.toContain(value);
});
it.each([401, 429])('stops on %s without copying upstream error text or credentials', async status => {
  const request = vi.fn(async () => new Response('secret-key echoed by upstream', { status }));
  const report = await probeIntervals('test-key', { request, now });
  expect(request).toHaveBeenCalledTimes(1);
  expect(report.endpoints.profile.status).toBe(status);
  expect(JSON.stringify(report)).not.toContain('secret-key');
});
it('continues independent probes after forbidden responses and does not mistake denial for empty data', async () => {
  const request = vi.fn(async () => new Response('Forbidden', { status: 403 }));
  const report = await probeIntervals('test-key', { request, now });
  expect(request).toHaveBeenCalledTimes(3);
  expect(report.endpoints.gear.status).toBe(403);
  expect(report.endpoints.gear.error).toContain('Access denied');
});
it('sanitizes thrown errors and invalid response formats', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('private test-key')).mockResolvedValue(new Response('{}', { status: 200 }));
  const report = await probeIntervals('test-key', { request, now });
  expect(report.endpoints.profile.error).toBeTruthy();
  expect(report.endpoints.gear.error).toBeTruthy();
  expect(JSON.stringify(report)).not.toContain('test-key');
});
it('rejects missing credentials without making requests', async () => {
  const request = vi.fn();
  await expect(probeIntervals('', { request, now })).rejects.toThrow('valid personal API key');
  expect(request).not.toHaveBeenCalled();
});
