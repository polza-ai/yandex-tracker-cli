import { describe, it, expect } from 'vitest';
import { TrackerClient } from './tracker-client.js';

function makeClient(): TrackerClient {
  return new TrackerClient({ token: 'x', tokenType: 'oauth', orgId: '1' });
}

describe('buildCreateIssueBody', () => {
  it('includes required queue and summary', () => {
    const body = makeClient().buildCreateIssueBody({ queue: 'POLZA', summary: 'Тест' });
    expect(body).toEqual({ queue: 'POLZA', summary: 'Тест' });
  });

  it('maps storyPoints and typed fields', () => {
    const body = makeClient().buildCreateIssueBody({
      queue: 'POLZA', summary: 'Фича', type: 'newFeature', priority: 'normal',
      sprint: 47, parent: 'POLZA-1', tags: ['a'], storyPoints: 8,
    });
    expect(body.storyPoints).toBe(8);
    expect(body.type).toBe('newFeature');
    expect(body.sprint).toEqual([{ id: 47 }]);
    expect(body.parent).toBe('POLZA-1');
    expect(body.tags).toEqual(['a']);
  });

  it('merges extra fields but typed fields win', () => {
    const body = makeClient().buildCreateIssueBody({
      queue: 'POLZA', summary: 'X',
      storyPoints: 5,
      fields: { deadline: '2026-07-01', storyPoints: 99 },
    });
    expect(body.deadline).toBe('2026-07-01');
    expect(body.storyPoints).toBe(5); // типизированный --story-points перекрывает --field
  });

  it('omits storyPoints when not set', () => {
    const body = makeClient().buildCreateIssueBody({ queue: 'POLZA', summary: 'X' });
    expect('storyPoints' in body).toBe(false);
  });
});
