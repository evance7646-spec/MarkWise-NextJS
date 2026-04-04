import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MOJIBAKE_RE = /[\xC3-\xC5][\x80-\xBF]|Ã|â€|Ã‚|ÃƒÂ|Ã¢|Ã‚Â/;

function walk(dir, results = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full, results);
      else if (/\.(ts|tsx)$/.test(name)) results.push(full);
    } catch {}
  }
  return results;
}

// Ordered replacements — most-specific first to avoid partial replacement
const REPLACEMENTS = [
  // Triple-encoded em-dash variants
  ['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â', ' — '],
  ['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬', ' — '],
  // Long sequences
  ['ÃƒÂ¢Ã¢â€šÂ¬', ' — '],
  // Double-encoded
  ['Ã¢â€šÂ¬', '€'],
  ['Ã¢â‚¬â€', '—'],
  ['Ã¢â‚¬â€œ', '–'],
  ['Ã¢â‚¬â„¢', '\u2019'],
  ['Ã¢â‚¬Å"', '\u201C'],
  ['Ã¢â‚¬', ' — '],
  // Single-encoded
  ['Ã‚Â·', '·'],
  ['Ã‚Â°', '°'],
  ['Ã‚Â', ''],
  // Remaining stray
  ['ÃƒÂ', ''],
  ['Ã¢', ''],
  ['Ãƒ', ''],
  ['Ã‚', ''],
  ['â€', '"'],
  ['ÃƒÂ¨', 'è'],
  ['ÃƒÂ©', 'é'],
  ['ÃƒÂ ', 'à'],
  ['ÃƒÂ±', 'ñ'],
];

const roots = ['app', 'lib'].map(r => join('c:\\MarkWise', r));
const files = roots.flatMap(r => walk(r));

let fixedCount = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!MOJIBAKE_RE.test(src)) continue;

  let out = src;
  for (const [from, to] of REPLACEMENTS) {
    // split/join is faster than regex for literal strings
    out = out.split(from).join(to);
  }

  if (out !== src) {
    writeFileSync(f, out, 'utf8');
    fixedCount++;
    const relative = f.replace('c:\\MarkWise\\', '');
    console.log('Fixed:', relative);
  }
}

console.log(`\nDone. Fixed ${fixedCount} file(s).`);

// Verify no more mojibake
const remaining = files.filter(f => MOJIBAKE_RE.test(readFileSync(f, 'utf8')));
if (remaining.length) {
  console.log('Still has mojibake:');
  for (const f of remaining) console.log(' -', f.replace('c:\\MarkWise\\', ''));
} else {
  console.log('No mojibake remaining.');
}
