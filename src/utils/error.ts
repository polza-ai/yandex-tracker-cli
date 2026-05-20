import { AxiosError } from 'axios';

export class TrackerCliError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'TrackerCliError';
  }
}

function extractApiMessage(body: Record<string, unknown> | undefined): string {
  if (!body) return '';
  const parts: string[] = [];

  const messages = body.errorMessages as string[] | undefined;
  if (messages?.length) parts.push(...messages);

  const errors = body.errors as Record<string, string> | undefined;
  if (errors && typeof errors === 'object') {
    for (const [field, msg] of Object.entries(errors)) {
      parts.push(`${field}: ${msg}`);
    }
  }

  const single = body.message as string | undefined;
  if (parts.length === 0 && single) parts.push(single);

  return parts.join('; ');
}

export function handleApiError(error: unknown): never {
  if (error instanceof TrackerCliError) throw error;

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const body = error.response?.data as Record<string, unknown> | undefined;
    const apiMessage = extractApiMessage(body);

    switch (status) {
      case 401:
        throw new TrackerCliError(
          'Неверный токен авторизации. Запустите "tracker init" для настройки.',
          'AUTH_ERROR', 2
        );
      case 403:
        throw new TrackerCliError(
          `Нет доступа. ${apiMessage}`,
          'FORBIDDEN', 2
        );
      case 404:
        throw new TrackerCliError(
          `Не найдено. ${apiMessage}`,
          'NOT_FOUND', 3
        );
      case 422:
        throw new TrackerCliError(
          `Невалидный запрос: ${apiMessage}`,
          'VALIDATION_ERROR', 4
        );
      case 429:
        throw new TrackerCliError(
          'Превышен лимит запросов. Подождите и попробуйте снова.',
          'RATE_LIMIT', 1
        );
      default:
        throw new TrackerCliError(
          `Ошибка API (${status}): ${apiMessage || error.message}`,
          'API_ERROR', 1
        );
    }
  }

  if (error instanceof Error) {
    throw new TrackerCliError(error.message, 'UNKNOWN', 1);
  }

  throw new TrackerCliError(String(error), 'UNKNOWN', 1);
}

export function formatError(error: unknown, json: boolean): string {
  if (error instanceof TrackerCliError) {
    if (json) {
      return JSON.stringify({ ok: false, error: { code: error.code, message: error.message } });
    }
    return error.message;
  }
  if (json) {
    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN', message: String(error) } });
  }
  return String(error);
}
