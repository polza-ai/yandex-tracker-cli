import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { globalConfigSchema, projectConfigSchema, type GlobalConfig, type ProjectConfig, type ResolvedConfig } from './config.schema.js';

export const GLOBAL_CONFIG_DIR = join(homedir(), '.tracker-cli');
export const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, 'config.json');
export const PROJECT_CONFIG_NAME = '.tracker.json';

const DEFAULT_STATUS_MAP = {
  open: 'open',
  inProgress: 'inProgress',
  review: 'inReview',
  testing: 'testing',
  closed: 'closed',
};

const DEFAULT_API_BASE_URL = 'https://api.tracker.yandex.net/v2';

async function readJsonFile(path: string): Promise<unknown> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function findProjectConfig(startDir: string = process.cwd()): string | null {
  const home = homedir();
  const useHomeBoundary = !!home && home !== '/' && isInside(startDir, home);

  let dir = startDir;
  while (true) {
    if (!(useHomeBoundary && dir === home)) {
      const candidate = join(dir, PROJECT_CONFIG_NAME);
      if (existsSync(candidate)) return candidate;
    }
    if (useHomeBoundary && dir === home) return null;
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
  const project = await loadProjectConfig();

  if (!global && !project) {
    throw new Error('Конфигурация не найдена. Запустите "tracker init" для настройки.');
  }

  const token = project?.token ?? global?.token;
  const tokenType = project?.tokenType ?? global?.tokenType ?? 'oauth';
  const orgId = project?.orgId ?? global?.orgId;
  const cloudOrgId = project?.cloudOrgId ?? global?.cloudOrgId;
  const apiBaseUrl = global?.apiBaseUrl ?? DEFAULT_API_BASE_URL;

  if (!token) {
    throw new Error('Токен не задан. Добавьте "token" в .tracker.json или запустите "tracker init".');
  }
  if (!orgId && !cloudOrgId) {
    throw new Error('Не задан orgId или cloudOrgId. Укажите его в .tracker.json или в глобальном конфиге.');
  }

  return {
    token,
    tokenType,
    orgId,
    cloudOrgId,
    apiBaseUrl,
    queue: project?.queue ?? global?.defaultQueue,
    boardId: project?.boardId,
    branchPrefix: project?.branchPrefix ?? 'feature',
    statusMap: project?.statusMap ?? DEFAULT_STATUS_MAP,
    userLogin: global?.userLogin,
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
