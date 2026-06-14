import { readFileSync } from 'node:fs';
import { TrackerCliError } from './error.js';

/**
 * Парсит повторяемый флаг --field в объект полей запроса.
 *
 * Формат каждого элемента:
 *   key=value   — строковое значение (всё после первого `=` — как есть)
 *   key:=value  — JSON-значение (число, bool, null, объект, массив)
 *
 * Примеры:
 *   --field deadline=2026-07-01            → { deadline: "2026-07-01" }
 *   --field storyPoints:=8                 → { storyPoints: 8 }
 *   --field 'foo:={"a":1}'                 → { foo: { a: 1 } }
 */
export function parseFieldOptions(pairs: string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pair of pairs ?? []) {
    const jsonIdx = pair.indexOf(':=');
    const strIdx = pair.indexOf('=');

    let key: string;
    let raw: string;
    let asJson: boolean;

    if (jsonIdx !== -1 && (strIdx === -1 || jsonIdx < strIdx)) {
      key = pair.slice(0, jsonIdx).trim();
      raw = pair.slice(jsonIdx + 2);
      asJson = true;
    } else if (strIdx !== -1) {
      key = pair.slice(0, strIdx).trim();
      raw = pair.slice(strIdx + 1);
      asJson = false;
    } else {
      throw new TrackerCliError(
        `Неверный формат --field "${pair}". Ожидается key=value или key:=json.`,
        'INVALID_FIELD', 1,
      );
    }

    if (!key) {
      throw new TrackerCliError(`Пустой ключ в --field "${pair}".`, 'INVALID_FIELD', 1);
    }

    if (asJson) {
      try {
        out[key] = JSON.parse(raw);
      } catch {
        throw new TrackerCliError(`Невалидный JSON в --field "${pair}".`, 'INVALID_FIELD', 1);
      }
    } else {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Возвращает описание из --description или --description-file.
 * Указание обоих сразу — ошибка. Если ничего не задано — undefined.
 */
export function resolveDescription(
  description: string | undefined,
  descriptionFile: string | undefined,
): string | undefined {
  if (description !== undefined && descriptionFile !== undefined) {
    throw new TrackerCliError(
      'Используйте либо --description, либо --description-file, не оба сразу.',
      'INVALID_ARGS', 1,
    );
  }
  if (descriptionFile !== undefined) {
    try {
      return readFileSync(descriptionFile, 'utf-8');
    } catch (e) {
      throw new TrackerCliError(
        `Не удалось прочитать файл описания "${descriptionFile}": ${(e as Error).message}`,
        'FILE_ERROR', 1,
      );
    }
  }
  return description;
}

/** Парсит и валидирует --story-points (поле Трекера storyPoints — float). */
export function parseStoryPoints(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new TrackerCliError(
      `Неверное значение --story-points "${value}". Ожидается число.`,
      'INVALID_ARGS', 1,
    );
  }
  return n;
}
