import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError, TrackerCliError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import chalk from 'chalk';

export function registerStatusCommand(program: Command): void {
  program
    .command('status <key> <status>')
    .description('Изменить статус задачи (open, inProgress, review, testing, closed)')
    .option('-c, --comment <text>', 'Комментарий к переходу')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, targetStatus: string, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        const mappedStatus = config.statusMap[targetStatus] ?? targetStatus;

        const transitions = await client.getTransitions(resolvedKey);
        const transition = transitions.find(
          t => t.to.key === mappedStatus ||
               t.to.display.toLowerCase() === mappedStatus.toLowerCase() ||
               t.id === mappedStatus
        );

        if (!transition) {
          const available = transitions.map(t => `  ${t.to.key} (${t.to.display})`).join('\n');
          throw new TrackerCliError(
            `Переход в "${targetStatus}" невозможен из текущего статуса.\n\nДоступные переходы:\n${available}`,
            'INVALID_TRANSITION',
            4
          );
        }

        await client.executeTransition(resolvedKey, transition.id, opts.comment);

        if (opts.json) {
          process.stdout.write(jsonOutput({ key: resolvedKey, status: transition.to }) + '\n');
        } else {
          console.log(`${chalk.green('✓')} ${resolvedKey}: статус изменён на ${chalk.bold(transition.to.display)}`);
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
