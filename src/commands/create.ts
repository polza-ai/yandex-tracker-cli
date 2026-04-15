import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatIssueDetail } from '../formatters/table.js';

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Создать задачу')
    .requiredOption('-s, --summary <text>', 'Название задачи')
    .option('-d, --description <text>', 'Описание')
    .option('-q, --queue <queue>', 'Очередь')
    .option('-t, --type <type>', 'Тип (task, bug, story...)', 'task')
    .option('-p, --priority <priority>', 'Приоритет (blocker, critical, major, normal, minor)')
    .option('-a, --assignee <login>', 'Исполнитель')
    .option('--parent <key>', 'Родительская задача')
    .option('--sprint <id>', 'Спринт')
    .option('--tag <tags...>', 'Теги')
    .option('--json', 'Вывод в JSON')
    .action(async (opts) => {
      try {
        const config = await loadConfig();
        const queue = opts.queue ?? config.queue;

        if (!queue) {
          console.error('Очередь не указана. Используйте --queue или добавьте queue в конфиг.');
          process.exit(1);
        }

        const client = new TrackerClient(config);
        const issue = await client.createIssue({
          queue,
          summary: opts.summary,
          description: opts.description,
          type: opts.type,
          priority: opts.priority,
          assignee: opts.assignee,
          parent: opts.parent,
          sprint: opts.sprint ? parseInt(opts.sprint, 10) : undefined,
          tags: opts.tag,
        });

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
