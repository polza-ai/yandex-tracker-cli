import Table from 'cli-table3';
import chalk from 'chalk';
import type { Issue, Sprint, Comment, Worklog, ChecklistItem, IssueLink } from '../client/types.js';

const statusColors: Record<string, (s: string) => string> = {
  open: chalk.white,
  inProgress: chalk.yellow,
  readyForReview: chalk.cyan,
  testing: chalk.magenta,
  closed: chalk.green,
  resolved: chalk.green,
};

function colorStatus(display: string, key?: string): string {
  const colorFn = statusColors[key ?? ''] ?? chalk.white;
  return colorFn(display);
}

const priorityColors: Record<string, (s: string) => string> = {
  blocker: chalk.red.bold,
  critical: chalk.red,
  major: chalk.yellow,
  normal: chalk.white,
  minor: chalk.gray,
  trivial: chalk.gray,
};

function colorPriority(display: string, key?: string): string {
  const colorFn = priorityColors[key ?? ''] ?? chalk.white;
  return colorFn(display);
}

export function formatIssueList(issues: Issue[]): string {
  if (issues.length === 0) return chalk.gray('Задачи не найдены.');

  const table = new Table({
    head: [
      chalk.bold('Ключ'),
      chalk.bold('Статус'),
      chalk.bold('Приоритет'),
      chalk.bold('Исполнитель'),
      chalk.bold('Название'),
    ],
    colWidths: [14, 16, 12, 16, 50],
    wordWrap: true,
  });

  for (const issue of issues) {
    table.push([
      chalk.bold(issue.key),
      colorStatus(issue.status.display, issue.status.key),
      colorPriority(issue.priority.display, issue.priority.key),
      issue.assignee?.display ?? chalk.gray('—'),
      issue.summary,
    ]);
  }

  return table.toString();
}

export function formatIssueDetail(issue: Issue): string {
  const lines: string[] = [
    '',
    `${chalk.bold(issue.key)}  ${issue.summary}`,
    '',
    `  Статус:      ${colorStatus(issue.status.display, issue.status.key)}`,
    `  Приоритет:   ${colorPriority(issue.priority.display, issue.priority.key)}`,
    `  Тип:         ${issue.type.display}`,
    `  Очередь:     ${issue.queue.display}`,
    `  Исполнитель: ${issue.assignee?.display ?? chalk.gray('не назначен')}`,
    `  Автор:       ${issue.author.display}`,
  ];

  if (issue.sprint?.length) {
    lines.push(`  Спринт:      ${issue.sprint.map(s => s.display).join(', ')}`);
  }
  if (issue.deadline) {
    lines.push(`  Дедлайн:     ${issue.deadline}`);
  }
  if (issue.storyPoints !== undefined) {
    lines.push(`  Story Points: ${issue.storyPoints}`);
  }
  if (issue.tags?.length) {
    lines.push(`  Теги:        ${issue.tags.join(', ')}`);
  }
  if (issue.checklistTotal) {
    lines.push(`  Чеклист:     ${issue.checklistDone ?? 0}/${issue.checklistTotal}`);
  }

  lines.push(`  Создана:     ${issue.createdAt}`);
  lines.push(`  Обновлена:   ${issue.updatedAt}`);

  if (issue.description) {
    lines.push('');
    lines.push(chalk.bold('  Описание:'));
    const desc = issue.description.length > 500
      ? issue.description.slice(0, 500) + '...'
      : issue.description;
    lines.push('  ' + desc.split('\n').join('\n  '));
  }

  lines.push('');
  return lines.join('\n');
}

export function formatSprint(sprint: Sprint): string {
  const statusIcon = sprint.status === 'in_progress' ? chalk.green('●') : chalk.gray('○');
  const lines = [
    '',
    `${statusIcon} ${chalk.bold(sprint.display)}`,
    `  Статус: ${sprint.status}`,
  ];
  if (sprint.startDate) lines.push(`  Начало: ${sprint.startDate}`);
  if (sprint.endDate) lines.push(`  Конец:  ${sprint.endDate}`);
  lines.push('');
  return lines.join('\n');
}

export function formatComments(comments: Comment[]): string {
  if (comments.length === 0) return chalk.gray('Комментариев нет.');
  return comments.map(c => [
    '',
    `${chalk.bold(c.createdBy.display)} · ${c.createdAt}`,
    `  ${c.text}`,
  ].join('\n')).join('\n');
}

export function formatWorklogs(worklogs: Worklog[]): string {
  if (worklogs.length === 0) return chalk.gray('Записей о времени нет.');

  const table = new Table({
    head: [chalk.bold('Автор'), chalk.bold('Время'), chalk.bold('Дата'), chalk.bold('Комментарий')],
    colWidths: [20, 12, 12, 40],
    wordWrap: true,
  });

  for (const w of worklogs) {
    table.push([
      w.createdBy.display,
      w.duration,
      w.start,
      w.comment ?? '',
    ]);
  }

  return table.toString();
}

export function formatChecklist(items: ChecklistItem[]): string {
  if (items.length === 0) return chalk.gray('Чеклист пуст.');
  return items.map((item, i) => {
    const icon = item.checked ? chalk.green('✓') : chalk.gray('○');
    const text = item.checked ? chalk.strikethrough(item.text) : item.text;
    return `  ${icon} ${i + 1}. ${text}`;
  }).join('\n');
}

export function formatLinks(links: IssueLink[]): string {
  if (links.length === 0) return chalk.gray('Связей нет.');
  return links.map(l => {
    const rel = l.direction === 'outward' ? l.type.outward : l.type.inward;
    return `  ${rel}: ${chalk.bold(l.object.key)} ${l.object.display}`;
  }).join('\n');
}
