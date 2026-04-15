import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadConfig } from '../config/config.js';
import { TrackerClient } from '../client/tracker-client.js';
import { resolveKey } from '../utils/key-resolver.js';
import { handleApiError } from '../utils/error.js';
import { jsonOutput } from '../formatters/json.js';
import { formatWorklogs } from '../formatters/table.js';
import chalk from 'chalk';

const TIMERS_DIR = join(homedir(), '.tracker-cli');
const TIMERS_FILE = join(TIMERS_DIR, 'timers.json');

interface Timers {
  [key: string]: string;
}

async function loadTimers(): Promise<Timers> {
  try {
    const content = await readFile(TIMERS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function saveTimers(timers: Timers): Promise<void> {
  if (!existsSync(TIMERS_DIR)) {
    await mkdir(TIMERS_DIR, { recursive: true });
  }
  await writeFile(TIMERS_FILE, JSON.stringify(timers, null, 2));
}

function parseDuration(input: string): string {
  const regex = /(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?/;
  const match = input.match(regex);
  if (!match || (!match[1] && !match[2] && !match[3])) {
    throw new Error(`Не удалось разобрать длительность: "${input}". Примеры: 2h30m, 1d, 45m`);
  }

  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10) + days * 8;
  const minutes = parseInt(match[3] || '0', 10);

  let iso = 'PT';
  if (hours > 0) iso += `${hours}H`;
  if (minutes > 0) iso += `${minutes}M`;
  if (iso === 'PT') iso += '0M';

  return iso;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join('');
}

export function registerTimeCommand(program: Command): void {
  program
    .command('time <key> <action> [duration]')
    .description('Трекинг времени: start, stop, log <duration>, show')
    .option('-c, --comment <text>', 'Комментарий')
    .option('--json', 'Вывод в JSON')
    .action(async (key: string, action: string, duration: string | undefined, opts) => {
      try {
        const config = await loadConfig();
        const client = new TrackerClient(config);
        const resolvedKey = resolveKey(key, config.queue);

        switch (action) {
          case 'start': {
            const timers = await loadTimers();
            if (timers[resolvedKey]) {
              console.log(`${chalk.yellow('⚠')} Таймер для ${resolvedKey} уже запущен.`);
              return;
            }
            timers[resolvedKey] = new Date().toISOString();
            await saveTimers(timers);

            if (opts.json) {
              process.stdout.write(jsonOutput({ key: resolvedKey, action: 'start', startedAt: timers[resolvedKey] }) + '\n');
            } else {
              console.log(`${chalk.green('▶')} Таймер запущен для ${resolvedKey}`);
            }
            break;
          }

          case 'stop': {
            const timers = await loadTimers();
            const startTime = timers[resolvedKey];
            if (!startTime) {
              console.error(`Таймер для ${resolvedKey} не запущен.`);
              process.exit(1);
            }

            const elapsed = Date.now() - new Date(startTime).getTime();
            const durationStr = formatElapsed(elapsed);
            const isoDuration = parseDuration(durationStr);

            delete timers[resolvedKey];
            await saveTimers(timers);

            const worklog = await client.addWorklog(resolvedKey, {
              duration: isoDuration,
              start: startTime,
              comment: opts.comment,
            });

            if (opts.json) {
              process.stdout.write(jsonOutput({ key: resolvedKey, action: 'stop', duration: durationStr, worklog }) + '\n');
            } else {
              console.log(`${chalk.green('⏹')} Таймер остановлен: ${durationStr} залогировано для ${resolvedKey}`);
            }
            break;
          }

          case 'log': {
            if (!duration) {
              console.error('Укажите длительность. Примеры: 2h30m, 1d, 45m');
              process.exit(1);
            }

            const isoDuration = parseDuration(duration);
            const worklog = await client.addWorklog(resolvedKey, {
              duration: isoDuration,
              comment: opts.comment,
            });

            if (opts.json) {
              process.stdout.write(jsonOutput(worklog) + '\n');
            } else {
              console.log(`${chalk.green('✓')} ${duration} залогировано для ${resolvedKey}`);
            }
            break;
          }

          case 'show': {
            const worklogs = await client.getWorklogs(resolvedKey);
            if (opts.json) {
              process.stdout.write(jsonOutput(worklogs) + '\n');
            } else {
              console.log(formatWorklogs(worklogs));
            }
            break;
          }

          default:
            console.error(`Неизвестное действие: ${action}. Используйте: start, stop, log, show`);
            process.exit(1);
        }
      } catch (error) {
        handleApiError(error);
      }
    });
}
