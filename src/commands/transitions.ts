import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import chalk from 'chalk';

export function registerTransitionsCommand(program: Command): void {
  program
    .command('transitions <key>')
    .description('Показать доступные переходы статуса')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        const issue = await client.getIssue(resolvedKey);
        const transitions = await client.getTransitions(resolvedKey);

        if (opts.json) {
          process.stdout.write(jsonOutput({ currentStatus: issue.status, transitions }) + '\n');
        } else {
          console.log('');
          console.log(`${chalk.bold(resolvedKey)} — текущий статус: ${chalk.cyan(issue.status.display)} (${issue.status.key})`);
          console.log('');
          if (transitions.length === 0) {
            console.log(chalk.gray('  Нет доступных переходов.'));
          } else {
            console.log('  Доступные переходы:');
            for (const t of transitions) {
              console.log(`  → ${chalk.bold(t.to.key)} (${t.to.display})`);
            }
          }
          console.log('');
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
