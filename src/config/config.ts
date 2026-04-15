import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { globalConfigSchema, projectConfigSchema, type GlobalConfig, type ProjectConfig, type ResolvedConfig } from './config.schema.js';

export const GLOBAL_CONFIG_DIR = join(homedir(), '.tracker-cli');
export const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, 'config.json');
export const PROJECT_CONFIG_NAME = '.tracker.json';

async function readJsonFile(path: string): Promise<unknown> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function findProjectConfig(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, PROJECT_CONFIG_NAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadGlobalConfig(): Promise<GlobalConfig | null> {
  const raw = await readJsonFile(GLOBAL_CONFIG_PATH);
  if (!raw) return null;
  return globalConfigSchema.parse(raw);
}

export async function loadProjectConfig(): Promise<ProjectConfig | null> {
  const path = findProjectConfig();
  if (!path) return null;
  const raw = await readJsonFile(path);
  if (!raw) return null;
  return projectConfigSchema.parse(raw);
}

export async function loadConfig(): Promise<ResolvedConfig> {
  const global = await loadGlobalConfig();
  if (!global) {
    throw new Error('Конфигурация не найдена. Запустите "tracker init" для настройки.');
  }

  const project = await loadProjectConfig();

  return {
    token: global.token,
    tokenType: global.tokenType,
    orgId: global.orgId,
    cloudOrgId: global.cloudOrgId,
    apiBaseUrl: global.apiBaseUrl,
    queue: project?.queue ?? global.defaultQueue,
    boardId: project?.boardId,
    branchPrefix: project?.branchPrefix ?? 'feature',
    statusMap: project?.statusMap ?? {
      open: 'open',
      inProgress: 'inProgress',
      review: 'readyForReview',
      testing: 'testing',
      closed: 'closed',
    },
  };
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    await mkdir(GLOBAL_CONFIG_DIR, { recursive: true });
  }
  await writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function saveProjectConfig(config: ProjectConfig, dir: string = process.cwd()): Promise<void> {
  const path = join(dir, PROJECT_CONFIG_NAME);
  await writeFile(path, JSON.stringify(config, null, 2), 'utf-8');
}
