import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatIssueList, formatIssueDetail } from '../formatters/table.js';

export function registerTaskCommand(program: Command): void {
  program
    .command('task <key>')
    .description('Показать детали задачи')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);
        const issue = await client.getIssue(resolvedKey);

        if (opts.json) {
          process.stdout.write(jsonOutput(issue) + '\n');
        } else {
          console.log(formatIssueDetail(issue));
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}

export function registerTasksCommand(program: Command): void {
  program
    .command('tasks')
    .description('Поиск и список задач')
    .option('-q, --queue <queue>', 'Очередь')
    .option('-a, --assignee <login>', 'Исполнитель (me — текущий пользователь)')
    .option('-s, --status <status>', 'Статус')
    .option('--sprint <sprint>', 'Спринт')
    .option('--query <tql>', 'Произвольный TQL-запрос')
    .option('--all', 'Включить закрытые задачи')
    .option('--count', 'Вернуть только количество задач')
    .option('--fetch-all', 'Выгрузить все задачи (обход потолка пагинации)')
    .option('-l, --limit <n>', 'Максимум задач (по умолчанию 50; верхний предел для --fetch-all)')
    .option('--sort <field>', 'Сортировка (updated, created, priority)', 'updated')
    .option('--json', 'Вывод в JSON')
    .action(async (opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);

        const sortMap: Record<string, string> = {
          updated: 'Updated DESC',
          created: 'Created DESC',
          priority: 'Priority ASC',
        };
        const orderBy = sortMap[opts.sort] ?? `${opts.sort} DESC`;

        const filter = {
          queue: opts.queue ?? config.queue,
          assignee: opts.assignee,
          includeClosed: opts.all,
          status: opts.status,
          sprint: opts.sprint,
          query: opts.query,
          orderBy,
        };

        if (opts.count) {
          const count = await client.countIssues(filter);
          if (opts.json) {
            process.stdout.write(jsonOutput({ count }) + '\n');
          } else {
            console.log(String(count));
          }
          return;
        }

        if (opts.fetchAll) {
          const SAFETY_CAP = 10000;
          const userLimit = opts.limit ? parseInt(opts.limit, 10) : undefined;
          const maxResults = Math.min(userLimit && userLimit > 0 ? userLimit : SAFETY_CAP, SAFETY_CAP);
          const { issues, capped } = await client.searchAllIssues(filter, maxResults);
          if (capped && maxResults === SAFETY_CAP) {
            process.stderr.write(`⚠ Достигнут предел ${SAFETY_CAP} задач, результат обрезан. Уточните запрос.\n`);
          }
          if (opts.json) {
            process.stdout.write(jsonOutput(issues) + '\n');
          } else {
            console.log(formatIssueList(issues));
          }
          return;
        }

        let issues = await client.searchIssues(filter);

        const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
        if (limit > 0) {
          issues = issues.slice(0, limit);
        }

        if (opts.json) {
          process.stdout.write(jsonOutput(issues) + '\n');
        } else {
          console.log(formatIssueList(issues));
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
