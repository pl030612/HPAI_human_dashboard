import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const lexicon = JSON.parse(readFileSync(join(root, 'lexicon', 'lexicon.json'), 'utf8'));
const tagsFile = process.argv[2];
const lines = readFileSync(tagsFile, 'utf8').split(/\r?\n/).filter(l => l.trim().length);

const zhToCanon = new Map();
const aliasToCanon = new Map();
for (const t of lexicon.terms) {
  zhToCanon.set(t.zh, t.canonical);
  for (const a of t.aliases) aliasToCanon.set(a.trim(), t.canonical);
}

function resolve(tag) {
  const s = tag.trim();
  if (zhToCanon.has(s)) return zhToCanon.get(s);
  if (aliasToCanon.has(s)) return aliasToCanon.get(s);
  return null;
}

const dataLines = lines.slice(1);
const freq = new Map();
const pairFreq = new Map();
const unresolved = new Set();
let paperCount = 0;

for (const line of dataLines) {
  const [tagsRaw] = line.split('|');
  if (!tagsRaw || !tagsRaw.trim()) continue;
  paperCount++;
  const canon = [];
  for (const tag of tagsRaw.split(';')) {
    if (!tag.trim()) continue;
    const c = resolve(tag);
    if (!c) { unresolved.add(tag.trim()); continue; }
    if (!canon.includes(c)) canon.push(c);
  }
  for (const c of canon) freq.set(c, (freq.get(c) || 0) + 1);
  for (let i = 0; i < canon.length; i++) {
    for (let j = i + 1; j < canon.length; j++) {
      const key = [canon[i], canon[j]].sort().join('__');
      pairFreq.set(key, (pairFreq.get(key) || 0) + 1);
    }
  }
}

const zhOf = c => lexicon.terms.find(t => t.canonical === c)?.zh || c;

console.log(`\n=== P0 標註驗證 ===`);
console.log(`文獻數: ${paperCount} | 不重複關鍵字節點: ${freq.size} | 共現邊: ${pairFreq.size}`);

if (unresolved.size) {
  console.log(`\n[!] 對不上詞庫的標籤 (${unresolved.size}) — 需修正 lexicon 或標註:`);
  for (const u of unresolved) console.log('   - ' + u);
} else {
  console.log(`\n[OK] 全部標籤都對得上詞庫，無孤兒節點。`);
}

console.log(`\n--- 關鍵字頻率 Top 15 ---`);
[...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([c, n]) => console.log(`   ${String(n).padStart(2)}  ${zhOf(c)}  (${c})`));

console.log(`\n--- 共現最強配對 Top 12 ---`);
[...pairFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, n]) => {
    const [a, b] = k.split('__');
    console.log(`   ${String(n).padStart(2)}  ${zhOf(a)} — ${zhOf(b)}`);
  });
console.log('');
