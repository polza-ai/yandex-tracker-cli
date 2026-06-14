import { describe, it, expect } from 'vitest';
import { selectPlanningSprint, listSprints } from './sprint-select.js';
import type { Sprint } from '../client/types.js';

function sp(id: number, status: Sprint['status'], startDate?: string, archived?: boolean): Sprint {
  return { self: `s/${id}`, id, status, startDate, archived } as Sprint;
}

// Реальная картина доски POLZA: in_progress=«прошлый, не закрытый», draft=«следующий».
const board: Sprint[] = [
  sp(47, 'in_progress', '2026-06-08'),  // Спринт 46 — закончился, не закрыт
  sp(49, 'draft'),                       // Спринт 47 — следующий, дат ещё нет
  sp(46, 'archived', '2026-06-01'),
  sp(44, 'archived', '2026-05-18'),
];

describe('selectPlanningSprint', () => {
  it('предпочитает draft (следующий) активному in_progress', () => {
    expect(selectPlanningSprint(board)?.id).toBe(49);
  });

  it('берёт активный, если draft-ов нет', () => {
    const noDraft = board.filter((s) => s.status !== 'draft');
    expect(selectPlanningSprint(noDraft)?.id).toBe(47);
  });

  it('среди нескольких draft берёт ближайший по startDate', () => {
    const s = [sp(50, 'draft', '2026-07-01'), sp(49, 'draft', '2026-06-22'), sp(47, 'in_progress', '2026-06-08')];
    expect(selectPlanningSprint(s)?.id).toBe(49);
  });

  it('draft без даты тай-брейк по id', () => {
    const s = [sp(52, 'draft'), sp(49, 'draft'), sp(50, 'draft')];
    expect(selectPlanningSprint(s)?.id).toBe(49);
  });

  it('игнорирует архивные', () => {
    const onlyArchived = [sp(46, 'archived'), sp(44, 'closed'), sp(40, 'draft', undefined, true)];
    expect(selectPlanningSprint(onlyArchived)).toBeNull();
  });

  it('null на пустом списке', () => {
    expect(selectPlanningSprint([])).toBeNull();
  });
});

describe('listSprints', () => {
  it('по умолчанию скрывает архивные/завершённые', () => {
    const ids = listSprints(board, false).map((s) => s.id);
    expect(ids).toEqual([47, 49]); // in_progress раньше draft
    expect(ids).not.toContain(46);
  });

  it('с includeArchived показывает все', () => {
    const ids = listSprints(board, true).map((s) => s.id);
    expect(ids).toContain(46);
    expect(ids).toContain(44);
    expect(ids.length).toBe(4);
  });

  it('группирует: in_progress → draft → завершённые', () => {
    const ids = listSprints(board, true).map((s) => s.id);
    expect(ids[0]).toBe(47); // in_progress
    expect(ids[1]).toBe(49); // draft
    expect(ids.slice(2)).toEqual([46, 44]); // архивные, свежие раньше
  });
});
