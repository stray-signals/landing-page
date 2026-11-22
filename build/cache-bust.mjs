// Post-build: tag every local JS/CSS reference in _site with ?v=<version> so a
// deploy never mixes freshly fetched modules with stale cached ones.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SITE = '_site';
const VERSION = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 8);
// Pitch pages come from other repos; leave them alone.
const SKIP = ['projects/pigeonhole', 'projects/roam'];

// Quoted module specifiers in JS/HTML: './x.js', '../x.js', '/x.js', '/x.css'
const SPECIFIER = /(['"`])((?:\.{1,2}\/|\/)(?!\/)[^'"`\s?#]+\.(?:js|css))\1/g;
// HTML attributes with bare relative paths: src="avatar/avatar.js", href="css/main.css"
const ATTR = /((?:src|href)=")(?!https?:|data:|\/\/|\.{0,2}\/)([^"?#\s]+\.(?:js|css))"/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some(s => relative(SITE, p).startsWith(s))) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|html)$/.test(name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(SITE)) {
  const src = readFileSync(file, 'utf8');
  let out = src.replace(SPECIFIER, (_, q, path) => `${q}${path}?v=${VERSION}${q}`);
  if (file.endsWith('.html')) out = out.replace(ATTR, (_, pre, path) => `${pre}${path}?v=${VERSION}"`);
  if (out !== src) { writeFileSync(file, out); changed++; }
}
console.log(`cache-bust: tagged ${changed} files with v=${VERSION}`);
