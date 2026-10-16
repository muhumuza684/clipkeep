// Fails when the app loads a file that the installer would leave out.
// (A missing winv.js once broke every packaged build, while running from source worked fine.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const patterns = pkg.build.files;

function covered(rel) {
  rel = rel.split(path.sep).join('/');
  return patterns.some((p) => (p.endsWith('/**') ? rel.startsWith(p.slice(0, -2)) : p === rel));
}

const codeFiles = ['main.js', 'preload.js', 'store.js', 'smart.js', 'winv.js', 'brand.js'];

test('every local require() is included in the package', () => {
  for (const f of codeFiles) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(/require\('(\.\/[^']+)'\)/g)) {
      const target = m[1].replace(/^\.\//, '');
      const file = fs.existsSync(path.join(root, target + '.js')) ? target + '.js' : target;
      assert.ok(fs.existsSync(path.join(root, file)), `${f} requires ${file}, which does not exist`);
      assert.ok(covered(file), `${file} is required by ${f} but is missing from build.files in package.json`);
    }
  }
});

test('files the main process reads from the app folder are included', () => {
  const src = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  for (const m of src.matchAll(/path\.join\(__dirname,\s*'([^']+)'(?:,\s*'([^']+)')?/g)) {
    const rel = m[2] ? `${m[1]}/${m[2]}` : m[1];
    assert.ok(covered(rel), `main.js uses ${rel}, which is missing from build.files in package.json`);
  }
});
