import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatComments } from '../formatters/table.js';
import chalk from 'chalk';

export function registerCommentCommand(program: Command): void {
  program
    .command('comment <key> [text]')
    .description('Добавить или показать комментарии')
    .option('-f, --file <path>', 'Текст комментария из файла')
    .option('-l, --list', 'Показать все комментарии')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, text: string | undefined, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        if (opts.list || (!text && !opts.file)) {
          const comments = await client.getComments(resolvedKey);
          if (opts.json) {
            process.stdout.write(jsonOutput(comments) + '\n');
          } else {
            console.log(formatComments(comments));
          }
          return;
        }

        let commentText = text;
        if (opts.file) {
          commentText = await readFile(opts.file, 'utf-8');
        }

        if (!commentText) {
          console.error('Укажите текст комментария или используйте --file.');
          process.exit(1);
        }

        const comment = await client.addComment(resolvedKey, commentText);

        if (opts.json) {
          process.stdout.write(jsonOutput(comment) + '\n');
        } else {
          console.log(`${chalk.green('✓')} Комментарий добавлен к ${resolvedKey}`);
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
