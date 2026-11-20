import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { TrackerClient } from './tracker-client.js';

it.each([
  [1, true, [1]],
  [50, true, [1]],
  [150, true, [1, 2]],
  [150, false, [1, 2]],
  [Infinity, false, [1, 2, 3]],
] as const)('search limit %s, total pages header %s', async (limit, withHeader, expectedPages) => {
  const pages: number[] = [];
  const keys = Array.from({ length: 220 }, (_, i) => String(i + 1));
  const server = createServer((req, res) => {
    const params = new URL(req.url!, 'http://localhost').searchParams;
    const page = Number(params.get('page'));
    const size = Number(params.get('perPage'));
    pages.push(page);
    if (withHeader) res.setHeader('x-total-pages', Math.ceil(keys.length / size));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(keys.slice((page - 1) * size, page * size).map((key) => ({ key }))));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const client = new TrackerClient({
      token: 'fixture',
      tokenType: 'oauth',
      orgId: '1',
      apiBaseUrl: 'http://127.0.0.1:' + (server.address() as AddressInfo).port,
    });
    const issues = await client.searchIssues({}, limit);
    expect(issues.map((issue) => issue.key)).toEqual(keys.slice(0, limit));
    expect(pages).toEqual(expectedPages);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
