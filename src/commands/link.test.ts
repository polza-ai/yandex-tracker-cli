import { describe, it, expect } from 'vitest';
import { describeLink } from './link.js';

describe('describeLink', () => {
  it('parent: key становится родителем target', () => {
    expect(describeLink('POLZA-590', 'POLZA-591', 'parent')).toBe(
      'POLZA-590 — родительская задача для POLZA-591',
    );
  });

  it('subtask: key становится подзадачей target', () => {
    expect(describeLink('POLZA-591', 'POLZA-590', 'subtask')).toBe(
      'POLZA-591 — подзадача POLZA-590',
    );
  });

  it('blocks и depends читаются слева направо', () => {
    expect(describeLink('A-1', 'B-2', 'blocks')).toBe('A-1 блокирует B-2');
    expect(describeLink('A-1', 'B-2', 'depends')).toBe('A-1 зависит от B-2');
  });

  it('неизвестный тип — нейтральная стрелка', () => {
    expect(describeLink('A-1', 'B-2', 'is duplicated by')).toBe('A-1 → B-2 (is duplicated by)');
  });
});
