import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatIssueDetail } from '../formatters/table.js';

export function registerUpdateCommand(program: Command): void {
  program
    .command('update <key>')
    .description('Обновить задачу (summary, description, assignee, priority)')
    .option('-s, --summary <text>', 'Новое название')
    .option('-d, --description <text>', 'Новое описание')
    .option('-a, --assignee <login>', 'Новый исполнитель')
    .option('-p, --priority <priority>', 'Новый приоритет')
    .option('--sprint <id>', 'Назначить спринт')
    .option('--tag <tags...>', 'Теги')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        const params: Record<string, unknown> = {};
        if (opts.summary) params.summary = opts.summary;
        if (opts.description) params.description = opts.description;
        if (opts.assignee) params.assignee = opts.assignee;
        if (opts.priority) params.priority = opts.priority;
        if (opts.sprint) params.sprint = [{ id: opts.sprint }];
        if (opts.tag) params.tags = opts.tag;

        if (Object.keys(params).length === 0) {
          console.error('Укажите что обновить: --summary, --description, --assignee, --priority, --sprint, --tag');
          process.exit(1);
        }

        const issue = await client.updateIssue(resolvedKey, params);

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
