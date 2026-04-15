import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { saveGlobalConfig, saveProjectConfig, GLOBAL_CONFIG_PATH } from '../config/config.js';
import type { GlobalConfig } from '../config/config.schema.js';

async function prompt(rl: ReturnType<typeof createInterface>, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Настроить подключение к Yandex Tracker')
    .option('--project', 'Создать также конфиг проекта (.tracker.json)')
    .action(async (opts) => {
      const rl = createInterface({ input: stdin, output: stdout });

      try {
        console.log('\n🔧 Настройка Yandex Tracker CLI\n');

        const tokenType = await prompt(rl, 'Тип токена (oauth/iam)', 'oauth') as 'oauth' | 'iam';
        const token = await prompt(rl, `${tokenType === 'iam' ? 'IAM' : 'OAuth'} токен`);

        if (!token) {
          console.error('Токен обязателен.');
          process.exit(1);
        }

        const orgType = await prompt(rl, 'Тип организации (yandex360/cloud)', 'yandex360');
        const orgId = orgType === 'cloud'
          ? undefined
          : await prompt(rl, 'ID организации (X-Org-ID)');
        const cloudOrgId = orgType === 'cloud'
          ? await prompt(rl, 'Cloud Org ID (X-Cloud-Org-ID)')
          : undefined;

        const defaultQueue = await prompt(rl, 'Очередь по умолчанию (например BACKEND)', '');

        const config: GlobalConfig = {
          token,
          tokenType,
          ...(orgId && { orgId }),
          ...(cloudOrgId && { cloudOrgId }),
          ...(defaultQueue && { defaultQueue }),
          apiBaseUrl: 'https://api.tracker.yandex.net/v2',
        };

        await saveGlobalConfig(config);
        console.log(`\n✅ Конфигурация сохранена в ${GLOBAL_CONFIG_PATH}`);

        if (opts.project) {
          const queue = await prompt(rl, 'Очередь проекта', defaultQueue);
          const boardIdStr = await prompt(rl, 'ID доски (для спринтов, Enter — пропустить)', '');
          const boardId = boardIdStr ? parseInt(boardIdStr, 10) : undefined;

          await saveProjectConfig({
            ...(queue && { queue }),
            ...(boardId && { boardId }),
          });
          console.log('✅ Конфиг проекта сохранён в .tracker.json');
        }

        console.log('\nГотово! Попробуйте: tracker tasks\n');
      } finally {
        rl.close();
      }
    });
}
