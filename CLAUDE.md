# Claude Code — Project Configuration

## О проекте
CLI-инструмент для работы с Yandex Tracker. TypeScript, Node.js, ESM.

## Команды разработки
- `npm run dev -- <args>` — запуск CLI в dev-режиме (tsx)
- `npm run build` — компиляция TypeScript
- `npm test` — запуск тестов (vitest)
- `npm run typecheck` — проверка типов

## Рабочий процесс
Полная инструкция по workflow с Yandex Tracker находится в [SKILL.md](./SKILL.md).
Следуй ей при работе с задачами.

## Стек
- TypeScript (strict), ESM ("type": "module")
- Commander.js для CLI
- Axios для HTTP
- Zod для валидации
- Vitest для тестов

## Правила кода
- Все импорты с расширением .js (Node16 module resolution)
- stdout — только данные, stderr — логи/спиннеры
- Каждая команда в отдельном файле в src/commands/
- Ошибки через TrackerCliError с кодом и exitCode
