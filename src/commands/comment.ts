import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
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
    .option('-a, --attach <files...>', 'Прикрепить файлы к комментарию (v3 API)')
    .option('-l, --list', 'Показать все комментарии')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, text: string | undefined, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        // List comments
        if (opts.list || (!text && !opts.file && !opts.attach)) {
          const comments = await client.getComments(resolvedKey);
          if (opts.json) {
            process.stdout.write(jsonOutput(comments) + '\n');
          } else {
            console.log(formatComments(comments));
          }
          return;
        }

        // Build comment text
        let commentText = text ?? '';
        if (opts.file) {
          commentText = await readFile(opts.file, 'utf-8');
        }

        // With attachments — use v3 API
        if (opts.attach) {
          const attachmentIds: string[] = [];
          const uploaded: { id: string; name: string }[] = [];

          for (const filePath of opts.attach as string[]) {
            const filename = basename(filePath);
            const result = await client.uploadTempAttachment(filePath, filename);
            attachmentIds.push(result.id);
            uploaded.push({ id: result.id, name: filename });
          }

          const comment = await client.addCommentV3(resolvedKey, commentText, attachmentIds);

          if (opts.json) {
            process.stdout.write(jsonOutput({ comment, attachments: uploaded }) + '\n');
          } else {
            console.log(`${chalk.green('✓')} Комментарий добавлен к ${resolvedKey}`);
            console.log(`  ${uploaded.length} файл(ов) прикреплено`);
          }
          return;
        }

        // Without attachments — use v2 API
        if (!commentText.trim()) {
          console.error('Укажите текст комментария, --file или --attach.');
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
