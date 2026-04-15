import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { saveGlobalConfig, saveProjectConfig, GLOBAL_CONFIG_PATH } from '../config/config.js';
import type { GlobalConfig } from '../config/config.schema.js';
import { TrackerClient } from '../client/tracker-client.js';

const OAUTH_URL = 'https://oauth.yandex.ru/authorize?response_type=token&client_id=2e8b250c69cb4dbb8ccf4d9009e7ba9c';

async function prompt(rl: ReturnType<typeof createInterface>, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Настроить подключение к Yandex Tracker')
    .option('--iam', 'Использовать IAM-токен вместо OAuth (для сервисных аккаунтов Yandex Cloud)')
    .option('--project', 'Создать также конфиг проекта (.tracker.json)')
    .action(async (opts) => {
      const rl = createInterface({ input: stdin, output: stdout });

      try {
        console.log('');
        console.log('🔧 Настройка Yandex Tracker CLI');
        console.log('─'.repeat(40));

        // Step 1: Token
        const tokenType: 'oauth' | 'iam' = opts.iam ? 'iam' : 'oauth';

        if (tokenType === 'oauth') {
          console.log('');
          console.log('Шаг 1. OAuth-токен');
          console.log('');
          console.log('  Откройте ссылку в браузере, нажмите «Разрешить»,');
          console.log('  скопируйте токен из адресной строки:');
          console.log('');
          console.log(`  👉 ${OAUTH_URL}`);
          console.log('');
        } else {
          console.log('');
          console.log('Шаг 1. IAM-токен');
          console.log('');
          console.log('  Получите IAM-токен для сервисного аккаунта:');
          console.log('  yc iam create-token');
          console.log('');
        }

        const token = await prompt(rl, 'Вставьте токен');

        if (!token) {
          console.error('\n❌ Токен обязателен.\n');
          process.exit(1);
        }

        // Step 2: Organization
        console.log('');
        console.log('Шаг 2. Организация');
        console.log('');
        console.log('  Какой тип организации у вас в Яндексе?');
        console.log('');
        console.log('  1 — Яндекс 360 (бывш. Яндекс.Коннект) — большинство компаний');
        console.log('  2 — Yandex Cloud — если трекер подключён через облако');
        console.log('');

        const orgChoice = await prompt(rl, 'Выберите (1 или 2)', '1');
        const isCloud = orgChoice === '2';

        let orgId: string | undefined;
        let cloudOrgId: string | undefined;

        if (isCloud) {
          console.log('');
          console.log('  Узнать Cloud Org ID:');
          console.log('  yc organization-manager organization list');
          console.log('');
          cloudOrgId = await prompt(rl, 'Cloud Organization ID');
        } else {
          console.log('');
          console.log('  Узнать ID организации:');
          console.log('  Откройте https://tracker.yandex.ru/admin/orgs');
          console.log('  и скопируйте «Идентификатор организации».');
          console.log('');
          orgId = await prompt(rl, 'ID организации');
        }

        if (!orgId && !cloudOrgId) {
          console.error('\n❌ ID организации обязателен.\n');
          process.exit(1);
        }

        // Step 3: Verify token + fetch queues
        console.log('');
        console.log('Шаг 3. Проверка подключения...');
        console.log('');

        const client = new TrackerClient({
          token,
          tokenType,
          orgId,
          cloudOrgId,
          apiBaseUrl: 'https://api.tracker.yandex.net/v2',
        });

        let defaultQueue = '';

        try {
          const myself = await client.getMyself();
          console.log(`  ✅ Подключено! Вы: ${myself.display}`);
          console.log('');

          const queues = await client.getQueues();

          if (queues.length > 0) {
            console.log('  Доступные очереди:');
            console.log('');
            queues.forEach((q, i) => {
              console.log(`  ${i + 1}. ${q.key} — ${q.name}`);
            });
            console.log('');

            const queueChoice = await prompt(rl, 'Выберите очередь (номер или ключ, Enter — пропустить)', '');

            if (queueChoice) {
              const idx = parseInt(queueChoice, 10) - 1;
              if (idx >= 0 && idx < queues.length) {
                defaultQueue = queues[idx].key;
              } else {
                const found = queues.find(q => q.key.toLowerCase() === queueChoice.toLowerCase());
                defaultQueue = found ? found.key : queueChoice.toUpperCase();
              }
            }
          } else {
            console.log('  Очередей не найдено. Можете указать вручную.');
            console.log('');
            defaultQueue = await prompt(rl, 'Очередь по умолчанию (Enter — пропустить)', '');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('401') || msg.includes('403')) {
            console.error('  ❌ Не удалось подключиться. Проверьте токен и ID организации.');
            console.error(`     ${msg}`);
            process.exit(1);
          }
          console.log('  ⚠️  Не удалось получить список очередей.');
          console.log(`     ${msg}`);
          console.log('');
          defaultQueue = await prompt(rl, 'Очередь по умолчанию (Enter — пропустить)', '');
        }

        // Save
        const config: GlobalConfig = {
          token,
          tokenType,
          ...(orgId && { orgId }),
          ...(cloudOrgId && { cloudOrgId }),
          ...(defaultQueue && { defaultQueue }),
          apiBaseUrl: 'https://api.tracker.yandex.net/v2',
        };

        await saveGlobalConfig(config);

        console.log('');
        console.log(`✅ Конфигурация сохранена в ${GLOBAL_CONFIG_PATH}`);

        // Optional: project config
        if (opts.project) {
          console.log('');
          console.log('Настройка проекта (.tracker.json)');
          console.log('─'.repeat(40));
          const queue = await prompt(rl, 'Очередь проекта', defaultQueue);
          const boardIdStr = await prompt(rl, 'ID доски для спринтов (Enter — пропустить)', '');
          const boardId = boardIdStr ? parseInt(boardIdStr, 10) : undefined;

          await saveProjectConfig({
            ...(queue && { queue }),
            ...(boardId && { boardId }),
          });
          console.log('✅ Конфиг проекта сохранён в .tracker.json');
        }

        console.log('');
        console.log('🎉 Готово! Попробуйте:');
        console.log('');
        console.log('  tracker tasks              — список задач');
        console.log('  tracker tasks --assignee me — мои задачи');
        console.log('  tracker task КЛЮЧ          — детали задачи');
        console.log('');
      } finally {
        rl.close();
      }
    });
}
