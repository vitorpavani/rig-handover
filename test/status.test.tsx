import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { parseLine } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links each night to its digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toMatch(/<a href="\/digest\/2026-10-28">2026-10-28<\/a> · ok \d+ · retry \d+ · fail \d+/);
    expect(html).toMatch(/<a href="\/digest\/2026-10-27">2026-10-27<\/a> · ok \d+ · retry \d+ · fail \d+/);
    for (const n of ['2026-10-27', '2026-10-28']) {
      const lines = readFileSync(`runs/${n}.jsonl`, 'utf8').split('\n').filter((l) => l.trim());
      const by = (s: string) => lines.filter((l) => parseLine(l)?.status === s).length;
      expect(html).toContain(`${n}</a> · ok ${by('ok')} · retry ${by('retry')} · fail ${by('fail')}`);
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
