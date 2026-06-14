import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { resolveAssignee } from '../utils/assignee-resolver.js';
import { handleApiError } from '../utils/error.js';
import { parseFieldOptions, resolveDescription, parseStoryPoints } from '../utils/extra-fields.js';
import { jsonOutput } from '../formatters/json.js';
import { formatIssueDetail } from '../formatters/table.js';

export function registerUpdateCommand(program: Command): void {
  program
    .command('update <key>')
    .description('Обновить задачу (summary, description, type, assignee, priority, story-points, поля)')
    .option('-s, --summary <text>', 'Новое название')
    .option('-d, --description <text>', 'Новое описание')
    .option('-F, --description-file <path>', 'Новое описание из файла (взаимоисключимо с -d)')
    .option('-t, --type <type>', 'Новый тип (task, bug, refactoring...)')
    .option('-a, --assignee <login>', 'Новый исполнитель')
    .option('-p, --priority <priority>', 'Новый приоритет')
    .option('--sprint <id>', 'Назначить спринт')
    .option('--tag <tags...>', 'Теги')
    .option('--story-points <points>', 'Story Points / бизнес-ценность (SP)')
    .option('--field <pairs...>', 'Доп. поле key=value (строка) или key:=json (повторяемо)')
    .option('--dry-run', 'Показать тело запроса без обновления')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        const assignee = await resolveAssignee(client, config, opts.assignee);
        const description = resolveDescription(opts.description, opts.descriptionFile);
        const storyPoints = parseStoryPoints(opts.storyPoints);

        const params: Record<string, unknown> = { ...parseFieldOptions(opts.field) };
        if (opts.summary) params.summary = opts.summary;
        if (description !== undefined) params.description = description;
        if (opts.type) params.type = opts.type;
        if (assignee) params.assignee = assignee;
        if (opts.priority) params.priority = opts.priority;
        if (opts.sprint) params.sprint = [{ id: opts.sprint }];
        if (opts.tag) params.tags = opts.tag;
        if (storyPoints !== undefined) params.storyPoints = storyPoints;

        if (Object.keys(params).length === 0) {
          console.error('Укажите что обновить: --summary, --description(-file), --type, --assignee, --priority, --sprint, --tag, --story-points, --field');
          process.exit(1);
        }

        if (opts.dryRun) {
          const preview = { dryRun: true, method: 'PATCH', endpoint: `/issues/${resolvedKey}`, body: params };
          if (opts.json) {
            process.stdout.write(jsonOutput(preview) + '\n');
          } else {
            console.log(`DRY-RUN PATCH /issues/${resolvedKey}\n` + JSON.stringify(params, null, 2));
          }
          return;
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
