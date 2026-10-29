import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const markdownFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const filename = path.join(directory, entry.name);
  return entry.isDirectory() ? markdownFiles(filename) : entry.name.endsWith('.md') ? [filename] : [];
});
const files = [
  ...fs.readdirSync(root).filter(name => name.endsWith('.md')).map(name => path.join(root, name)),
  ...['docs', 'Study'].filter(name => fs.existsSync(path.join(root, name))).flatMap(name => markdownFiles(path.join(root, name))),
];
const broken = [];
let checked = 0;
for (const filename of files) {
  const source = fs.readFileSync(filename, 'utf8').replace(/```[\s\S]*?```/g, '');
  const links = /\[[^\]\n]*\]\(/g;
  for (const match of source.matchAll(links)) {
    let end = match.index + match[0].length;
    const start = end;
    let depth = 1;
    // Local source paths can contain route groups such as app/(app)/daily.
    for (; end < source.length && depth > 0; end++) {
      if (source[end] === '\\') { end++; continue; }
      if (source[end] === '(') depth++;
      if (source[end] === ')') depth--;
    }
    if (depth !== 0) continue;
    const raw = source.slice(start, end - 1).trim();
    const target = raw.startsWith('<') ? raw.slice(1, raw.indexOf('>')) : raw.split(/\s+["']/)[0];
    if (!target || target.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    const relative = decodeURIComponent(target.split('#')[0]);
    checked++;
    if (!fs.existsSync(path.resolve(path.dirname(filename), relative))) {
      broken.push(`${path.relative(root, filename)}: ${target}`);
    }
  }
}
if (broken.length) {
  console.error(broken.join('\n'));
  process.exitCode = 1;
}
console.log(`Checked ${files.length} Markdown files and ${checked} local file links; ${broken.length} broken.`);
