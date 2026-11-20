import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const binary = fileURLToPath(new URL('../dist/bin/tracker.js', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const issue = { key: 'TEST-7', summary: 'Example' };
const requests = [];
let home, cwd, server;

before(async () => {
  home = await mkdtemp(join(tmpdir(), 'tracker-cli-'));
  cwd = join(home, 'project');
  await mkdir(cwd);
  await mkdir(join(home, '.tracker-cli'));
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
    res.setHeader('Content-Type', 'application/json');
    const routes = {
      'GET /issues/TEST-7': issue,
      'PATCH /issues/TEST-7': issue,
      'POST /issues/TEST-7/attachments': { id: '1', name: 'sample.txt' },
    };
    const result = routes[req.method + ' ' + req.url];
    res.statusCode = result ? 200 : 404;
    res.end(JSON.stringify(result ?? { message: 'missing fixture' }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  await writeFile(join(home, '.tracker-cli/config.json'), JSON.stringify({
    token: 'fixture', tokenType: 'iam', cloudOrgId: 'fixture-org', defaultQueue: 'GLOBAL',
    apiBaseUrl: 'http://127.0.0.1:' + server.address().port,
  }));
  await writeFile(join(cwd, '.tracker.json'), JSON.stringify({ queue: 'TEST' }));
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(home, { recursive: true, force: true });
});

function cli(...args) {
  return promisify(execFile)(process.execPath, [binary, ...args], {
    cwd, timeout: 10000, env: { HOME: home, USERPROFILE: home, NO_COLOR: '1' },
  });
}

test('version and help from the built entry point', async () => {
  assert.equal((await cli('--version')).stdout.split('\n')[0], manifest.version);
  const help = (await cli('--help')).stdout;
  for (const command of ['init', 'task', 'tasks', 'sprint', 'status', 'create', 'comment', 'time', 'checklist', 'link', 'update', 'transitions', 'attach']) {
    assert.match(help, new RegExp('^  ' + command + '\\b', 'm'));
  }
});

test('task combines project queue with global IAM and cloud organization', async () => {
  const { stdout, stderr } = await cli('task', '7', '--json');
  assert.equal(stderr, '');
  assert.deepEqual(JSON.parse(stdout), { ok: true, data: issue });
  const { headers, method, url } = requests.at(-1);
  assert.equal(method, 'GET');
  assert.equal(url, '/issues/TEST-7');
  assert.equal(headers.authorization, 'Bearer fixture');
  assert.equal(headers['x-cloud-org-id'], 'fixture-org');
});

test('update sends the requested fields as JSON', async () => {
  const { stdout } = await cli('update', '7', '--summary', issue.summary, '--json');
  assert.deepEqual(JSON.parse(stdout), { ok: true, data: issue });
  assert.equal(requests.at(-1).method, 'PATCH');
  assert.deepEqual(JSON.parse(requests.at(-1).body), { summary: issue.summary });
});

test('dry run previews the update without sending a request', async () => {
  const count = requests.length;
  const { stdout } = await cli('update', '7', '--summary', 'Preview', '--dry-run', '--json');
  assert.deepEqual(JSON.parse(stdout).data, {
    dryRun: true, method: 'PATCH', endpoint: '/issues/TEST-7', body: { summary: 'Preview' },
  });
  assert.equal(requests.length, count);
});

test('attach uploads file contents as multipart form data', async () => {
  await writeFile(join(cwd, 'sample.txt'), 'attachment payload');
  const { stdout } = await cli('attach', '7', 'sample.txt', '--json');
  assert.deepEqual(JSON.parse(stdout).data, { id: '1', name: 'sample.txt' });
  const { headers, body } = requests.at(-1);
  assert.match(headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.match(body, /name="file"; filename="sample.txt"/);
  assert.match(body, /\r\n\r\nattachment payload\r\n/);
});

test('404 preserves the exit code, JSON error and human-readable stderr', async () => {
  await assert.rejects(cli('task', '8', '--json'), err => {
    assert.equal(err.code, 3);
    const result = JSON.parse(err.stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NOT_FOUND');
    assert.match(result.error.message, /missing fixture/);
    assert.equal(err.stderr.trim(), result.error.message);
    return true;
  });
});
