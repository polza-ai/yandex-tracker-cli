# yandex-tracker-cli

CLI для [Yandex Tracker](https://tracker.yandex.ru/) — для людей и AI-агентов.

Простой инструмент для работы с задачами из терминала. Поддерживает двойной вывод: цветные таблицы для людей, `--json` для AI-агентов (Claude Code, Cursor и др.).

## Установка

```bash
npm install -g @polza-ai/yandex-tracker-cli
```

Или из исходников:

```bash
git clone https://github.com/polza-ai/yandex-tracker-cli.git
cd yandex-tracker-cli
npm install
npm run build
npm link
```

## Быстрый старт

```bash
# Настройка подключения
tracker init

# Мои задачи
tracker tasks --assignee me

# Детали задачи
tracker task BACKEND-123

# Создать задачу
tracker create -s "Исправить баг в авторизации" -t bug -p critical

# Сменить статус
tracker status BACKEND-123 inProgress

# Комментарий
tracker comment BACKEND-123 "Взял в работу, MR будет через час"

# Залогировать время
tracker time BACKEND-123 log 2h30m
```

## Команды

| Команда | Описание |
|---------|----------|
| `tracker init` | Настройка подключения к Yandex Tracker |
| `tracker tasks` | Поиск и список задач |
| `tracker task <KEY>` | Детали задачи |
| `tracker create` | Создание задачи |
| `tracker status <KEY> <STATUS>` | Смена статуса (через transitions) |
| `tracker comment <KEY> [text]` | Комментарии |
| `tracker time <KEY> <action>` | Трекинг времени (start/stop/log/show) |
| `tracker sprint` | Текущий спринт |
| `tracker checklist <KEY>` | Чеклист задачи |
| `tracker link <KEY> [TARGET]` | Связи между задачами |

Все команды поддерживают `--json` для машинного вывода.

## Конфигурация

### Глобальная (`~/.tracker-cli/config.json`)

Создаётся через `tracker init`:

```json
{
  "token": "y0_AgAAAA...",
  "tokenType": "oauth",
  "orgId": "123456",
  "defaultQueue": "BACKEND",
  "apiBaseUrl": "https://api.tracker.yandex.net/v2"
}
```

### Проектная (`.tracker.json` в корне репо)

```json
{
  "queue": "BACKEND",
  "boardId": 42,
  "branchPrefix": "feature",
  "statusMap": {
    "open": "open",
    "inProgress": "inProgress",
    "review": "readyForReview",
    "testing": "testing",
    "closed": "closed"
  }
}
```

`statusMap` позволяет маппить каноничные имена статусов на реальные ключи вашего workflow.

## Для AI-агентов

В комплекте идёт `SKILL.md` — инструкция для AI-агента, описывающая полный рабочий цикл:
задача → статус → ветка → код → коммит → MR → комментарий → review.

### Claude Code

`CLAUDE.md` в корне проекта подхватывается автоматически.

### Cursor

Скопируйте `SKILL.md` в `.cursor/rules/tracker-workflow.md`.

## JSON-вывод

Все команды с `--json` возвращают структурированный ответ:

```json
{
  "ok": true,
  "data": { ... }
}
```

При ошибке:

```json
{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "Не найдено." }
}
```

## Требования

- Node.js 20+
- OAuth-токен Yandex Tracker (получить на [oauth.yandex.ru](https://oauth.yandex.ru/))

## Лицензия

MIT

---

<p align="center">
  Сделано в <a href="https://polza.ai">polza.ai</a> — №1 LLM агрегатор в России.
  <br>
  Генерируйте текст, код, изображения, видео и аудио через один API —
  <br>
  экономьте время и деньги с оплатой по токенам.
</p>
