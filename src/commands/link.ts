import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatLinks } from '../formatters/table.js';
import chalk from 'chalk';

export function registerLinkCommand(program: Command): void {
  program
    .command('link <key> [target]')
    .description('Связать задачи или показать связи')
    .option('-t, --type <type>', 'Тип связи (relates, blocks, depends, duplicates)', 'relates')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, target: string | undefined, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        if (!target) {
          const links = await client.getLinks(resolvedKey);
          if (opts.json) {
            process.stdout.write(jsonOutput(links) + '\n');
          } else {
            console.log(formatLinks(links));
          }
          return;
        }

        const resolvedTarget = resolveKey(target, config.queue);
        const link = await client.createLink(resolvedKey, resolvedTarget, opts.type);

        if (opts.json) {
          process.stdout.write(jsonOutput(link) + '\n');
        } else {
          console.log(`${chalk.green('✓')} ${resolvedKey} → ${resolvedTarget} (${opts.type})`);
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
