// Runner shim so `node --test tests/node` works on Node 22 (which resolves a directory argument as a
// module, i.e. this file). Imports every *.test.mjs / *.test.js in this directory; node:test collects them.
// Owned by the skeleton; do not put tests here.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const files = fs.readdirSync(__dirname).filter((f) => /\.test\.(mjs|js|cjs)$/.test(f)).sort();
  for (const f of files) await import(pathToFileURL(path.join(__dirname, f)).href);
})().catch((e) => { console.error(e); process.exitCode = 1; });
