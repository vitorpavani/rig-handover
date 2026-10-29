import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

// Parse at the edge: anything that isn't a well-formed run line is null.
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (!STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== null && o.owner !== undefined && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: (o.owner as string | null | undefined) ?? null,
    ...(o.error !== undefined ? { error: o.error as string } : {}),
  };
}

export function digest(lines: RunLine[]): DigestRow[] {
  const rows = new Map<string, DigestRow>();
  for (const l of lines) {
    const r = rows.get(l.job);
    if (!r) {
      rows.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error ?? null,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    r.runs += 1;
    if (l.status === 'retry') r.retries += 1;
    r.lastStatus = l.status;
    if (l.error !== undefined) r.lastError = l.error;
    if (l.owner !== null) r.owner = l.owner;
    r.lastAt = l.at;
  }
  return [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const lines: RunLine[] = [];
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const l = parseLine(raw);
    if (l) lines.push(l);
    else badLines += 1;
  }
  return { night, rows: digest(lines), badLines } satisfies Night;
};
