export function resolveKey(input: string, defaultQueue?: string): string {
  if (/^[A-Z][A-Z0-9]+-\d+$/.test(input)) {
    return input;
  }

  if (/^\d+$/.test(input) && defaultQueue) {
    return `${defaultQueue}-${input}`;
  }

  return input;
}
