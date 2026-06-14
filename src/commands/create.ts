import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { handleApiError } from '../utils/error.js';
import { resolveAssignee } from '../utils/assignee-resolver.js';
import { parseFieldOptions, resolveDescription, parseStoryPoints } from '../utils/extra-fields.js';
import { jsonOutput } from '../formatters/json.js';
import { formatIssueDetail } from '../formatters/table.js';

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Создать задачу')
    .requiredOption('-s, --summary <text>', 'Название задачи')
    .option('-d, --description <text>', 'Описание')
    .option('-F, --description-file <path>', 'Описание из файла (взаимоисключимо с -d)')
    .option('-q, --queue <queue>', 'Очередь')
    .option('-t, --type <type>', 'Тип (task, bug, story...)', 'task')
    .option('-p, --priority <priority>', 'Приоритет (blocker, critical, major, normal, minor)')
    .option('-a, --assignee <login>', 'Исполнитель')
    .option('--parent <key>', 'Родительская задача')
    .option('--sprint <id>', 'Спринт')
    .option('--tag <tags...>', 'Теги')
    .option('--story-points <points>', 'Story Points / бизнес-ценность (SP)')
    .option('--field <pairs...>', 'Доп. поле key=value (строка) или key:=json (повторяемо)')
    .option('--dry-run', 'Показать тело запроса без создания задачи')
    .option('--json', 'Вывод в JSON')
    .action(async (opts) => {
      try {
        const config = await loadConfig();
        const queue = opts.queue ?? config.queue;

        if (!queue) {
          console.error('Очередь не указана. Используйте --queue или добавьте queue в конфиг.');
          process.exit(1);
        }

        const description = resolveDescription(opts.description, opts.descriptionFile);
        const fields = parseFieldOptions(opts.field);
        const storyPoints = parseStoryPoints(opts.storyPoints);

        const client = new TrackerClient(config);
        const assignee = await resolveAssignee(client, config, opts.assignee);
        const params = {
          queue,
          summary: opts.summary,
          description,
          type: opts.type,
          priority: opts.priority,
          assignee,
          parent: opts.parent,
          sprint: opts.sprint ? parseInt(opts.sprint, 10) : undefined,
          tags: opts.tag,
          storyPoints,
          fields,
        };

        if (opts.dryRun) {
          const preview = { dryRun: true, method: 'POST', endpoint: '/issues', body: client.buildCreateIssueBody(params) };
          if (opts.json) {
            process.stdout.write(jsonOutput(preview) + '\n');
          } else {
            console.log('DRY-RUN POST /issues\n' + JSON.stringify(preview.body, null, 2));
          }
          return;
        }

        const issue = await client.createIssue(params);

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
