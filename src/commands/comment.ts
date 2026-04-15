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

const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

function isImage(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return imageExts.has(ext);
}

export function registerCommentCommand(program: Command): void {
  program
    .command('comment <key> [text]')
    .description('Добавить или показать комментарии')
    .option('-f, --file <path>', 'Текст комментария из файла')
    .option('-a, --attach <files...>', 'Прикрепить файлы к комментарию')
    .option('-l, --list', 'Показать все комментарии')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, text: string | undefined, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        if (opts.list || (!text && !opts.file && !opts.attach)) {
          const comments = await client.getComments(resolvedKey);
          if (opts.json) {
            process.stdout.write(jsonOutput(comments) + '\n');
          } else {
            console.log(formatComments(comments));
          }
          return;
        }

        let commentText = text ?? '';
        if (opts.file) {
          commentText = await readFile(opts.file, 'utf-8');
        }

        // Upload attachments and append links to comment text
        const attachments: unknown[] = [];
        if (opts.attach) {
          for (const filePath of opts.attach as string[]) {
            const filename = basename(filePath);
            const attachment = await client.uploadAttachment(resolvedKey, filePath, filename);
            attachments.push(attachment);

            const url = attachment.content;
            if (isImage(filename)) {
              commentText += `\n![${filename}](${url})`;
            } else {
              commentText += `\n[${filename}](${url})`;
            }
          }
        }

        if (!commentText.trim()) {
          console.error('Укажите текст комментария, --file или --attach.');
          process.exit(1);
        }

        const comment = await client.addComment(resolvedKey, commentText);

        if (opts.json) {
          process.stdout.write(jsonOutput({ comment, attachments }) + '\n');
        } else {
          console.log(`${chalk.green('✓')} Комментарий добавлен к ${resolvedKey}`);
          if (attachments.length > 0) {
            console.log(`  ${attachments.length} файл(ов) прикреплено`);
          }
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
