# Claude Code — Project Configuration

## Стек
TypeScript (strict), ESM ("type": "module"), Commander.js, Axios, Zod, dayjs, Vitest.

## Команды
- `npm run dev -- <args>` — запуск через tsx
- `npm run build` — компиляция в dist/
- `npm run typecheck` — проверка типов
- `npm test` — тесты

## Публикация
```bash
# 1. Поднять версию в package.json
# 2. Собрать и опубликовать
npm run build && npm publish --access public
# 3. Закоммитить и запушить
git add -A && git commit -m "..." && git push
```
npm: `@polza-ai/yandex-tracker-cli`, GitHub: `polza-ai/yandex-tracker-cli`

## Правила кода
- Импорты с `.js` (Node16 module resolution)
- stdout — только данные (JSON/таблица), stderr — логи/спиннеры
- `--json` на каждой команде, формат: `{ ok: true, data }` / `{ ok: false, error: { code, message } }`
- Каждая команда — отдельный файл в `src/commands/`
- Ошибки через `TrackerCliError(message, code, exitCode)`
- Yandex Tracker API: поля `createdBy` (не `author`), спринт `name` (не `display`)

## Структура
```
bin/tracker.ts          — entry point, регистрация команд
src/client/             — HTTP-клиент, типы API, пагинация
src/commands/           — команды CLI (init, tasks, task, create, status, comment, time, sprint, checklist, link)
src/config/             — конфиг (глобальный ~/.tracker-cli/ + проектный .tracker.json)
src/formatters/         — вывод: table.ts (люди), json.ts (агенты)
src/utils/              — error.ts, key-resolver.ts
```

## Workflow с Yandex Tracker
См. [SKILL.md](./SKILL.md).
