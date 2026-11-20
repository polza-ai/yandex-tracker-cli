import { globSync } from 'node:fs';
import { defineConfig } from 'rolldown';

export default defineConfig({
  input: Object.fromEntries(
    globSync(['bin/**/*.ts', 'src/**/*.ts'])
      .filter(path => !path.endsWith('.test.ts'))
      .map(path => [path.replaceAll('\\', '/').slice(0, -3), path]),
  ),
  platform: 'node',
  external: [/^[^./]/],
  output: { dir: 'dist', format: 'esm', sourcemap: true, cleanDir: true },
});
