import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatLinks } from '../formatters/table.js';
import chalk from 'chalk';

const linkTypeMap: Record<string, string> = {
  relates: 'relates',
  blocks: 'is dependent by',
  depends: 'depends on',
  duplicates: 'duplicates',
  'is duplicated by': 'is duplicated by',
  parent: 'is parent task for',
  subtask: 'is subtask for',
};

// Фраза читается слева направо: роль key относительно target.
const linkPhrases: Record<string, string> = {
  relates: 'связана с',
  blocks: 'блокирует',
  depends: 'зависит от',
  duplicates: 'дублирует',
  parent: '— родительская задача для',
  subtask: '— подзадача',
};

export function describeLink(key: string, target: string, type: string): string {
  const phrase = linkPhrases[type];
  return phrase ? `${key} ${phrase} ${target}` : `${key} → ${target} (${type})`;
}

export function registerLinkCommand(program: Command): void {
  program
    .command('link <key> [target]')
    .description('Связать задачи или показать связи')
    .option(
      '-t, --type <type>',
      'Тип связи (relates, blocks, depends, duplicates, parent, subtask)',
      'relates',
    )
    .option('--json', 'Вывод в JSON')
    .addHelpText(
      'after',
      `
Семантика (порядок аргументов важен, тип описывает роль <key>):
  tracker link A B -t parent    A становится РОДИТЕЛЕМ B
  tracker link A B -t subtask   A становится ПОДЗАДАЧЕЙ B
  tracker link A B -t blocks    A блокирует B
  tracker link A B -t depends   A зависит от B

Прикрепить подзадачу: tracker link <родитель> <ребёнок> -t parent
У задачи один родитель — повторная привязка перезаписывает его.

Чтение вывода tracker link X (метка — роль самого X):
  «Подзадача: Y»           = X — подзадача Y
  «Родительская задача: Y» = X — родитель Y
`,
    )
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
        const relationship = linkTypeMap[opts.type] ?? opts.type;
        const link = await client.createLink(resolvedKey, resolvedTarget, relationship);

        if (opts.json) {
          process.stdout.write(jsonOutput(link) + '\n');
        } else {
          console.log(
            `${chalk.green('✓')} ${describeLink(resolvedKey, resolvedTarget, opts.type)}`,
          );
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
