import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatChecklist } from '../formatters/table.js';
import chalk from 'chalk';

export function registerChecklistCommand(program: Command): void {
  program
    .command('checklist <key> [action] [text]')
    .description('Чеклист задачи: (без аргументов — показать), add <text>, check <номер>')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, action: string | undefined, text: string | undefined, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        if (!action) {
          const items = await client.getChecklist(resolvedKey);
          if (opts.json) {
            process.stdout.write(jsonOutput(items) + '\n');
          } else {
            console.log(formatChecklist(items));
          }
          return;
        }

        if (action === 'add') {
          if (!text) {
            console.error('Укажите текст пункта чеклиста.');
            process.exit(1);
          }
          const item = await client.addChecklistItem(resolvedKey, text);
          if (opts.json) {
            process.stdout.write(jsonOutput(item) + '\n');
          } else {
            console.log(`${chalk.green('✓')} Пункт добавлен в чеклист ${resolvedKey}`);
          }
          return;
        }

        if (action === 'check') {
          if (!text) {
            console.error('Укажите номер пункта.');
            process.exit(1);
          }
          const items = await client.getChecklist(resolvedKey);
          const index = parseInt(text, 10) - 1;
          if (index < 0 || index >= items.length) {
            console.error(`Пункт ${text} не найден. Всего пунктов: ${items.length}`);
            process.exit(1);
          }
          const item = items[index];
          await client.toggleChecklistItem(resolvedKey, item.id, !item.checked);
          const icon = !item.checked ? chalk.green('✓') : chalk.gray('○');
          if (opts.json) {
            process.stdout.write(jsonOutput({ ...item, checked: !item.checked }) + '\n');
          } else {
            console.log(`${icon} Пункт "${item.text}" — ${!item.checked ? 'выполнен' : 'не выполнен'}`);
          }
          return;
        }

        console.error(`Неизвестное действие: ${action}. Используйте: add, check`);
        process.exit(1);
      } catch (error) {
        handleApiError(error);
      }
    });
}
