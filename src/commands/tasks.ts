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
    .option('--json', 'Вывод в JSON')
    .action(async (opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);

        const issues = await client.searchIssues({
          queue: opts.queue ?? config.queue,
          assignee: opts.assignee,
          includeClosed: opts.all,
          status: opts.status,
          sprint: opts.sprint,
          query: opts.query,
        });

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
