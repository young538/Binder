import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const standalone = path.resolve('.next/standalone');
if (existsSync(path.join(standalone, 'data', 'binder.sqlite'))) {
  throw new Error('The standalone build contains the local database');
}
// Docker copies these assets alongside the standalone server as well.
cpSync('public', path.join(standalone, 'public'), { recursive: true });
cpSync('.next/static', path.join(standalone, '.next/static'), { recursive: true });
await import(pathToFileURL(path.join(standalone, 'server.js')).href);
