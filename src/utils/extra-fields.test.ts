import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFieldOptions, resolveDescription, parseStoryPoints } from './extra-fields.js';
import { TrackerCliError } from './error.js';

describe('parseFieldOptions', () => {
  it('returns empty object for undefined', () => {
    expect(parseFieldOptions(undefined)).toEqual({});
  });

  it('parses key=value as string', () => {
    expect(parseFieldOptions(['deadline=2026-07-01'])).toEqual({ deadline: '2026-07-01' });
  });

  it('keeps numeric-looking string as string with =', () => {
    expect(parseFieldOptions(['code=007'])).toEqual({ code: '007' });
  });

  it('parses key:=value as JSON number/bool/null', () => {
    expect(parseFieldOptions(['storyPoints:=8', 'flag:=true', 'x:=null'])).toEqual({
      storyPoints: 8, flag: true, x: null,
    });
  });

  it('parses key:=json object and array', () => {
    expect(parseFieldOptions(['obj:={"a":1}', 'arr:=[1,2]'])).toEqual({
      obj: { a: 1 }, arr: [1, 2],
    });
  });

  it('keeps full value when string value contains = or :=', () => {
    expect(parseFieldOptions(['url=https://x?a=b'])).toEqual({ url: 'https://x?a=b' });
    expect(parseFieldOptions(['note=a:=b'])).toEqual({ note: 'a:=b' });
  });

  it('merges multiple pairs', () => {
    expect(parseFieldOptions(['a=1', 'b:=2'])).toEqual({ a: '1', b: 2 });
  });

  it('throws on missing =', () => {
    expect(() => parseFieldOptions(['novalue'])).toThrow(TrackerCliError);
  });

  it('throws on empty key', () => {
    expect(() => parseFieldOptions(['=v'])).toThrow(TrackerCliError);
  });

  it('throws on invalid JSON with :=', () => {
    expect(() => parseFieldOptions(['x:={bad'])).toThrow(/Невалидный JSON/);
  });
});

describe('resolveDescription', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'tracker-desc-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns inline description', () => {
    expect(resolveDescription('hello', undefined)).toBe('hello');
  });

  it('returns undefined when neither given', () => {
    expect(resolveDescription(undefined, undefined)).toBeUndefined();
  });

  it('reads from file', () => {
    const f = join(dir, 'd.md');
    writeFileSync(f, '# Заголовок\nтекст', 'utf-8');
    expect(resolveDescription(undefined, f)).toBe('# Заголовок\nтекст');
  });

  it('throws when both given', () => {
    expect(() => resolveDescription('a', '/tmp/x')).toThrow(/либо --description/);
  });

  it('throws when file missing', () => {
    expect(() => resolveDescription(undefined, join(dir, 'nope.md'))).toThrow(/Не удалось прочитать/);
  });
});

describe('parseStoryPoints', () => {
  it('returns undefined for undefined', () => {
    expect(parseStoryPoints(undefined)).toBeUndefined();
  });

  it('parses integer and float', () => {
    expect(parseStoryPoints('8')).toBe(8);
    expect(parseStoryPoints('2.5')).toBe(2.5);
  });

  it('throws on non-number', () => {
    expect(() => parseStoryPoints('big')).toThrow(/Ожидается число/);
  });
});
