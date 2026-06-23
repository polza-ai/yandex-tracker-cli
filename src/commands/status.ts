import { Command } from 'commander';
import { AxiosError } from 'axios';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError, TrackerCliError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import chalk from 'chalk';

/** Перех типа "Закрыт" в некоторых воркфлоу требует поле «Резолюция». */
function isResolutionRequired(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  const body = error.response?.data as Record<string, unknown> | undefined;
  const messages = (body?.errorMessages as string[] | undefined) ?? [];
  const errors = (body?.errors as Record<string, string> | undefined) ?? {};
  const haystack = [...messages, ...Object.keys(errors), ...Object.values(errors)]
    .join(' ')
    .toLowerCase();
  return haystack.includes('резолюц') || haystack.includes('resolution');
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status <key> <status>')
    .description('Изменить статус задачи (open, inProgress, review, testing, closed)')
    .option('-c, --comment <text>', 'Комментарий к переходу')
    .option('-r, --resolution <key>', 'Резолюция при закрытии (напр. fixed, successful, wontFix)')
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

        try {
          await client.executeTransition(resolvedKey, transition.id, opts.comment, opts.resolution);
        } catch (err) {
          if (!opts.resolution && isResolutionRequired(err)) {
            const resolutions = await client.getResolutions();
            const list = resolutions.map(r => `  ${r.key} (${r.name})`).join('\n');
            throw new TrackerCliError(
              `Переход в "${transition.to.display}" требует резолюцию — укажите её через --resolution <key>.\n\nДоступные резолюции:\n${list}`,
              'RESOLUTION_REQUIRED',
              4
            );
          }
          throw err;
        }

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
