import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatSprint, formatIssueList } from '../formatters/table.js';

export function registerSprintCommand(program: Command): void {
  program
    .command('sprint')
    .description('Текущий спринт')
    .option('-b, --board <id>', 'ID доски')
    .option('--tasks', 'Показать задачи спринта')
    .option('--json', 'Вывод в JSON')
    .action(async (opts) => {
      try {
        const config = await loadConfig();
        const boardId = opts.board ? parseInt(opts.board, 10) : config.boardId;

        if (!boardId) {
          console.error('ID доски не указан. Используйте --board <id> или добавьте boardId в .tracker.json');
          process.exit(1);
        }

        const client = new TrackerClient(config);
        const sprint = await client.getCurrentSprint(boardId);

        if (!sprint) {
          console.log('Активный спринт не найден.');
          return;
        }

        if (opts.tasks) {
          const issues = await client.searchIssues({
            query: `Sprint: ${sprint.id}`,
          });

          if (opts.json) {
            process.stdout.write(jsonOutput({ sprint, issues }) + '\n');
          } else {
            console.log(formatSprint(sprint));
            console.log(formatIssueList(issues));
          }
        } else {
          if (opts.json) {
            process.stdout.write(jsonOutput(sprint) + '\n');
          } else {
            console.log(formatSprint(sprint));
          }
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
