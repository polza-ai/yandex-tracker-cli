import type { Sprint } from '../client/types.js';

/** Архивный спринт — по статусу или флагу archived. */
function isArchived(s: Sprint): boolean {
  return s.status === 'archived' || s.status === 'closed' || s.archived === true;
}

/** Ранг статуса для группировки в списке: активный → планируемый → завершённый. */
function statusRank(s: Sprint): number {
  if (s.status === 'in_progress') return 0;
  if (s.status === 'draft') return 1;
  return 2;
}

/** Сортировка по дате старта: ближайшая раньше; без даты — в конец; тай-брейк по id. */
function byStartThenId(a: Sprint, b: Sprint): number {
  const sa = a.startDate ?? '9999-99-99';
  const sb = b.startDate ?? '9999-99-99';
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.id - b.id;
}

/**
 * Целевой спринт ПЛАНИРОВАНИЯ — куда наполняем задачи.
 * Это следующий планируемый спринт (status=draft), а НЕ текущий исполняемый (in_progress).
 * Приоритет: ближайший draft → иначе активный (in_progress) → иначе null.
 * Архивные/завершённые игнорируются.
 */
export function selectPlanningSprint(sprints: Sprint[]): Sprint | null {
  const live = sprints.filter((s) => !isArchived(s));
  const drafts = live.filter((s) => s.status === 'draft').sort(byStartThenId);
  if (drafts.length) return drafts[0];
  const active = live.filter((s) => s.status === 'in_progress').sort(byStartThenId);
  if (active.length) return active[0];
  return null;
}

/**
 * Список спринтов для показа человеку: in_progress → draft → завершённые,
 * внутри группы — ближайшие/свежие раньше. Архивные скрыты, если includeArchived=false.
 */
export function listSprints(sprints: Sprint[], includeArchived: boolean): Sprint[] {
  const filtered = includeArchived ? sprints : sprints.filter((s) => !isArchived(s));
  return [...filtered].sort((a, b) => {
    const o = statusRank(a) - statusRank(b);
    if (o !== 0) return o;
    return -byStartThenId(a, b); // внутри группы — свежие/ближайшие раньше
  });
}
