import { loadGlobalConfig, saveGlobalConfig } from './config.js';

export async function setToken(token: string, tokenType: 'oauth' | 'iam' = 'oauth'): Promise<void> {
  const existing = await loadGlobalConfig();
  if (!existing) {
    throw new Error('Конфигурация не найдена. Сначала запустите "tracker init".');
  }
  await saveGlobalConfig({ ...existing, token, tokenType });
}
