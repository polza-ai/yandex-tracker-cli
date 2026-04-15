export function jsonOutput(data: unknown): string {
  return JSON.stringify({ ok: true, data }, null, 2);
}

export function jsonError(code: string, message: string): string {
  return JSON.stringify({ ok: false, error: { code, message } }, null, 2);
}
