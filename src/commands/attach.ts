import { Command } from 'commander';
import { createReadStream, createWriteStream } from 'node:fs';
import { basename } from 'node:path';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import chalk from 'chalk';

export function registerAttachCommand(program: Command): void {
  program
    .command('attach <key> [file]')
    .description('Аттачи: загрузить файл, список (--list), скачать (--download)')
    .option('-l, --list', 'Показать список аттачей')
    .option('--download <id>', 'Скачать аттач по ID')
    .option('-o, --output <path>', 'Путь для сохранения (при --download)')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, file: string | undefined, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        // List attachments
        if (opts.list || (!file && !opts.download)) {
          const attachments = await client.getAttachments(resolvedKey);
          if (opts.json) {
            process.stdout.write(jsonOutput(attachments) + '\n');
          } else {
            if (attachments.length === 0) {
              console.log(chalk.gray('Аттачей нет.'));
            } else {
              console.log('');
              for (const a of attachments) {
                const size = a.size > 1024 * 1024
                  ? `${(a.size / 1024 / 1024).toFixed(1)} МБ`
                  : `${Math.round(a.size / 1024)} КБ`;
                console.log(`  ${chalk.bold(a.id)} ${a.name} (${size}) — ${a.createdBy?.display ?? ''}`);
              }
              console.log('');
            }
          }
          return;
        }

        // Download
        if (opts.download) {
          const attachment = await client.downloadAttachment(resolvedKey, opts.download);
          const outputPath = opts.output ?? attachment.name;
          const writer = createWriteStream(outputPath);
          attachment.stream.pipe(writer);
          await new Promise<void>((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          if (opts.json) {
            process.stdout.write(jsonOutput({ id: opts.download, savedTo: outputPath }) + '\n');
          } else {
            console.log(`${chalk.green('✓')} Сохранено: ${outputPath}`);
          }
          return;
        }

        // Upload
        if (!file) {
          console.error('Укажите файл для загрузки.');
          process.exit(1);
        }

        const attachment = await client.uploadAttachment(resolvedKey, file, basename(file));

        if (opts.json) {
          process.stdout.write(jsonOutput(attachment) + '\n');
        } else {
          console.log(`${chalk.green('✓')} ${basename(file)} загружен к ${resolvedKey}`);
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
