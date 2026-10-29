import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { lane } from '../src/lane.js';

// Temp runs dir: runs/ is read-only and must never be written to.
const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = createApp(config);

const GOOD = '2026-10-29';
const EMPTY = '2026-10-30';
const BAD = '2026-10-31';
const MISSING = '2026-10-28';

type JsonNight = { night: string; rows: { job: string; lastStatus: string; retries: number }[]; badLines: number };

// Job names in the order they appear in the page's table.
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*>\s*<td>([^<]+)<\/td>/g)].map((m) => m[1]!);
}

beforeAll(() => {
  // 3 lines for 2 jobs; "backup" ends with a fail, so its row carries the warn class.
  writeFileSync(
    join(runsDir, `${GOOD}.jsonl`),
    [
      '{"at":"2026-10-29T01:00:00+01:00","job":"sync-invoices","status":"ok","owner":"ana"}',
      '{"at":"2026-10-29T02:00:00+01:00","job":"backup","status":"retry","owner":"bo","error":"timeout"}',
      '{"at":"2026-10-29T03:00:00+01:00","job":"backup","status":"fail","owner":"bo","error":"disk full"}',
      '',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  // One good line, one truncated line that doesn't parse.
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [
      '{"at":"2026-10-31T01:00:00+01:00","job":"sync-invoices","status":"ok","owner":"ana"}',
      '{"at":"2026-10-31T02:00:00+01:00","job":"backup","sta',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('200 with the job names, the lane banner, and rows in order', async () => {
    const res = await app.request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('sync-invoices');
    expect(html).toContain('backup');
    expect(html).toContain(lane().id);
    expect(pageJobs(html)).toEqual(['backup', 'sync-invoices']);
  });

  it('404 for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for that night');
  });

  it('empty file: 200 and "nothing ran"', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('bad line: 200 and the unparsed-line notice', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/1 line didn(&#39;|')t parse/);
    expect(pageJobs(html)).toEqual(['sync-invoices']);
  });

  it('a row with a fail status gets class="warn"', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    expect(html).toMatch(/<tr class="warn">\s*<td>backup<\/td>/);
    expect(html).not.toMatch(/<tr class="warn">\s*<td>sync-invoices<\/td>/);
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with rows in the same order as the page', async () => {
    const res = await app.request(`/api/digest/${GOOD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonNight;
    expect(body.night).toBe(GOOD);
    expect(body.badLines).toBe(0);
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    expect(body.rows.map((r) => r.job)).toEqual(pageJobs(html));
    expect(body.rows.map((r) => r.job)).toEqual(['backup', 'sync-invoices']);
  });

  it('404 for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `no run log for ${MISSING}` });
  });

  it('empty file: 200 with rows []', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonNight;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('bad line: 200, badLines 1, good rows kept', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonNight;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['sync-invoices']);
  });
});
