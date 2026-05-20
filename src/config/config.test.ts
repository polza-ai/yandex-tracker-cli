import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectConfigSchema, globalConfigSchema } from './config.schema.js';

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_CWD = process.cwd();

let workDir: string;
let fakeHome: string;

async function importFresh(): Promise<typeof import('./config.js')> {
  vi.resetModules();
  return await import('./config.js');
}

function writeProject(dir: string, body: unknown) {
  writeFileSync(join(dir, '.tracker.json'), JSON.stringify(body), 'utf-8');
}

function writeGlobal(home: string, body: unknown) {
  const dir = join(home, '.tracker-cli');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(body), 'utf-8');
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'tracker-cli-test-'));
  fakeHome = mkdtempSync(join(tmpdir(), 'tracker-cli-home-'));
  process.env.HOME = fakeHome;
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  process.env.HOME = ORIGINAL_HOME;
  rmSync(workDir, { recursive: true, force: true });
  rmSync(fakeHome, { recursive: true, force: true });
});

describe('projectConfigSchema', () => {
  it('accepts minimal queue-only config', () => {
    const parsed = projectConfigSchema.parse({ queue: 'BACKEND' });
    expect(parsed.queue).toBe('BACKEND');
    expect(parsed.token).toBeUndefined();
  });

  it('accepts new override fields', () => {
    const parsed = projectConfigSchema.parse({
      orgId: '123',
      cloudOrgId: '456',
      token: 'y0_AAA',
      tokenType: 'iam',
    });
    expect(parsed.orgId).toBe('123');
    expect(parsed.token).toBe('y0_AAA');
    expect(parsed.tokenType).toBe('iam');
  });

  it('rejects invalid tokenType', () => {
    expect(() => projectConfigSchema.parse({ tokenType: 'bearer' })).toThrow();
  });

  it('does NOT inject default tokenType (so merge can prefer global)', () => {
    const parsed = projectConfigSchema.parse({ queue: 'X' });
    expect(parsed.tokenType).toBeUndefined();
  });

  it('rejects empty token', () => {
    expect(() => projectConfigSchema.parse({ token: '' })).toThrow();
  });
});

describe('globalConfigSchema', () => {
  it('still requires orgId or cloudOrgId', () => {
    expect(() => globalConfigSchema.parse({ token: 'x' })).toThrow();
  });
});

describe('findProjectConfig', () => {
  it('finds .tracker.json in cwd', async () => {
    const { findProjectConfig } = await importFresh();
    writeProject(workDir, { queue: 'A' });
    expect(findProjectConfig(workDir)).toBe(join(workDir, '.tracker.json'));
  });

  it('finds .tracker.json two levels up', async () => {
    const { findProjectConfig } = await importFresh();
    writeProject(workDir, { queue: 'A' });
    const deep = join(workDir, 'a', 'b');
    mkdirSync(deep, { recursive: true });
    expect(findProjectConfig(deep)).toBe(join(workDir, '.tracker.json'));
  });

  it('stops at $HOME boundary (cwd === HOME does NOT read ~/.tracker.json)', async () => {
    const { findProjectConfig } = await importFresh();
    writeProject(fakeHome, { queue: 'A' });
    expect(findProjectConfig(fakeHome)).toBeNull();
  });

  it('ignores ~/.tracker.json when cwd is a descendant of $HOME', async () => {
    const { findProjectConfig } = await importFresh();
    writeProject(fakeHome, { queue: 'A' });
    const sub = join(fakeHome, 'work', 'repo');
    mkdirSync(sub, { recursive: true });
    expect(findProjectConfig(sub)).toBeNull();
  });

  it('finds project config in $HOME descendant before reaching boundary', async () => {
    const { findProjectConfig } = await importFresh();
    const project = join(fakeHome, 'work', 'repo');
    mkdirSync(project, { recursive: true });
    writeProject(project, { queue: 'X' });
    const deep = join(project, 'src', 'nested');
    mkdirSync(deep, { recursive: true });
    expect(findProjectConfig(deep)).toBe(join(project, '.tracker.json'));
  });

  it('returns null when no config exists anywhere reachable', async () => {
    const { findProjectConfig } = await importFresh();
    const sub = join(fakeHome, 'empty');
    mkdirSync(sub);
    expect(findProjectConfig(sub)).toBeNull();
  });
});

describe('loadConfig', () => {
  it('resolves with project-only config (no global)', async () => {
    process.chdir(workDir);
    writeProject(workDir, {
      queue: 'PROJ',
      orgId: '999',
      token: 'project-token',
      tokenType: 'oauth',
    });
    const { loadConfig } = await importFresh();
    const cfg = await loadConfig();
    expect(cfg.token).toBe('project-token');
    expect(cfg.orgId).toBe('999');
    expect(cfg.queue).toBe('PROJ');
    expect(cfg.apiBaseUrl).toBe('https://api.tracker.yandex.net/v2');
  });

  it('resolves with global-only config', async () => {
    const isolated = mkdtempSync(join(tmpdir(), 'tracker-cli-iso-'));
    try {
      process.chdir(isolated);
      writeGlobal(fakeHome, {
        token: 'global-token',
        tokenType: 'oauth',
        orgId: '1',
        apiBaseUrl: 'https://api.tracker.yandex.net/v2',
      });
      const { loadConfig } = await importFresh();
      const cfg = await loadConfig();
      expect(cfg.token).toBe('global-token');
      expect(cfg.orgId).toBe('1');
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('project overrides global for orgId/cloudOrgId/token/tokenType', async () => {
    process.chdir(workDir);
    writeGlobal(fakeHome, {
      token: 'global-token',
      tokenType: 'oauth',
      orgId: 'global-org',
      apiBaseUrl: 'https://api.tracker.yandex.net/v2',
    });
    writeProject(workDir, {
      orgId: 'project-org',
      token: 'project-token',
      tokenType: 'iam',
    });
    const { loadConfig } = await importFresh();
    const cfg = await loadConfig();
    expect(cfg.token).toBe('project-token');
    expect(cfg.orgId).toBe('project-org');
    expect(cfg.tokenType).toBe('iam');
  });

  it('apiBaseUrl is always taken from global, never project', async () => {
    process.chdir(workDir);
    writeGlobal(fakeHome, {
      token: 'global-token',
      tokenType: 'oauth',
      orgId: '1',
      apiBaseUrl: 'https://global.example.com/v2',
    });
    writeProject(workDir, {
      queue: 'X',
      apiBaseUrl: 'https://project.example.com/v2',
    } as Record<string, unknown>);
    const { loadConfig } = await importFresh();
    const cfg = await loadConfig();
    expect(cfg.apiBaseUrl).toBe('https://global.example.com/v2');
  });

  it('partial project override keeps global token when project has only orgId', async () => {
    process.chdir(workDir);
    writeGlobal(fakeHome, {
      token: 'global-token',
      tokenType: 'iam',
      orgId: 'global-org',
      apiBaseUrl: 'https://api.tracker.yandex.net/v2',
    });
    writeProject(workDir, { orgId: 'client-org' });
    const { loadConfig } = await importFresh();
    const cfg = await loadConfig();
    expect(cfg.token).toBe('global-token');
    expect(cfg.tokenType).toBe('iam');
    expect(cfg.orgId).toBe('client-org');
  });

  it('throws when neither global nor project exists', async () => {
    const isolated = mkdtempSync(join(tmpdir(), 'tracker-cli-iso-'));
    try {
      process.chdir(isolated);
      const { loadConfig } = await importFresh();
      await expect(loadConfig()).rejects.toThrow(/Конфигурация не найдена/);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('throws when token is missing after merge', async () => {
    process.chdir(workDir);
    writeProject(workDir, { orgId: '1' });
    const { loadConfig } = await importFresh();
    await expect(loadConfig()).rejects.toThrow(/[Тт]окен/);
  });

  it('throws when neither orgId nor cloudOrgId is set after merge', async () => {
    process.chdir(workDir);
    writeProject(workDir, { token: 'x' });
    const { loadConfig } = await importFresh();
    await expect(loadConfig()).rejects.toThrow(/orgId|cloudOrgId/);
  });
});
