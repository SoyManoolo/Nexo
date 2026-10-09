import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.MCP_AUTH_TOKEN;
if (!token?.trim()) {
  console.error('MCP_AUTH_TOKEN must be set to a non-empty value.');
  process.exitCode = 1;
} else {
  const manifestUrl = new URL('../node_modules/@modelcontextprotocol/inspector/package.json', import.meta.url);
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  const executable = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.['mcp-inspector'];
  if (!executable) throw new Error('The MCP Inspector CLI executable was not found.');

  const inspector = resolve(dirname(fileURLToPath(manifestUrl)), executable);
  const result = spawnSync(
    process.execPath,
    [
      inspector,
      '--cli',
      '--server-url',
      'http://127.0.0.1:3100/mcp',
      '--transport',
      'http',
      '--method',
      'tools/list',
      '--header',
      `Authorization: Bearer ${token}`,
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
