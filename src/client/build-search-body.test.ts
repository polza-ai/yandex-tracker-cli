import { describe, it, expect } from 'vitest';
import { TrackerClient } from './tracker-client.js';

function makeClient(): TrackerClient {
  return new TrackerClient({ token: 'x', tokenType: 'oauth', orgId: '1' });
}

describe('buildSearchBody', () => {
  it('passes a custom TQL query as-is and appends sort when requested', () => {
    const client = makeClient();
    expect(client.buildSearchBody({ query: 'Resolution: empty()', orderBy: 'Updated DESC' }))
      .toEqual({ query: 'Resolution: empty() "Sort by": Updated DESC' });
    expect(client.buildSearchBody({ query: 'Resolution: empty()', orderBy: 'Updated DESC' }, false))
      .toEqual({ query: 'Resolution: empty()' });
  });

  it('combines queue, assignee:me and status with AND', () => {
    const body = makeClient().buildSearchBody({ queue: 'HELPDESK', assignee: 'me', status: 'open' });
    expect(body).toEqual({ query: 'Queue: "HELPDESK" AND Assignee: me() AND Status: "open"' });
  });

  it('quotes a named assignee', () => {
    const body = makeClient().buildSearchBody({ assignee: 'ivan', includeClosed: true });
    expect(body).toEqual({ query: 'Assignee: "ivan"' });
  });

  it('adds Resolution: empty() when no status and not includeClosed', () => {
    const body = makeClient().buildSearchBody({ queue: 'HELPDESK' });
    expect(body).toEqual({ query: 'Queue: "HELPDESK" AND Resolution: empty()' });
  });

  it('omits Resolution: empty() when includeClosed is set', () => {
    const body = makeClient().buildSearchBody({ queue: 'HELPDESK', includeClosed: true });
    expect(body).toEqual({ query: 'Queue: "HELPDESK"' });
  });

  it('does not append sort when includeSort is false', () => {
    const body = makeClient().buildSearchBody({ queue: 'HELPDESK', orderBy: 'Updated DESC' }, false);
    expect(body).toEqual({ query: 'Queue: "HELPDESK" AND Resolution: empty()' });
  });

  it('defaults to Resolution: empty() for an otherwise empty filter', () => {
    expect(makeClient().buildSearchBody({})).toEqual({ query: 'Resolution: empty()' });
  });

  it('returns an empty body when only includeClosed is set', () => {
    expect(makeClient().buildSearchBody({ includeClosed: true })).toEqual({});
  });
});
