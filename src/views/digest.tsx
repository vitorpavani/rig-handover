import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

function Row({ r }: { r: DigestRow }) {
  const rowWarn = r.retries >= 3 || r.lastStatus === 'fail';
  return (
    <tr class={rowWarn ? 'warn' : undefined}>
      <td>{r.job}</td>
      <td>{r.owner ?? dash}</td>
      <td>{r.runs}</td>
      <td class={r.retries >= 3 ? 'warn' : undefined}>{r.retries}</td>
      <td class={r.lastStatus === 'fail' ? 'warn' : undefined}>{r.lastStatus}</td>
      <td>{r.lastError ?? dash}</td>
      <td>{r.firstAt}</td>
      <td>{r.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? "line didn't" : "lines didn't"} parse
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <Row r={r} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="mute">no run log for that night</p>
    </>
  );
}
