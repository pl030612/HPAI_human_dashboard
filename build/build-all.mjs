import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { read, utils } from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const lexDir = join(root, 'lexicon');
const outDir = join(root, 'docs', 'data');
mkdirSync(outDir, { recursive: true });

const XLSX_PATH = 'D:/01_Research/115_NTUH_H5N1_human/文獻資料庫_HPAI_H5N1.xlsx';

const lexicon = JSON.parse(readFileSync(join(lexDir, 'lexicon.json'), 'utf8'));
const countryMap = JSON.parse(readFileSync(join(lexDir, 'country-map.json'), 'utf8'));
const sources = JSON.parse(readFileSync(join(lexDir, 'sources.json'), 'utf8'));
const kpi = JSON.parse(readFileSync(join(lexDir, 'surveillance-kpi.json'), 'utf8'));
const cases = JSON.parse(readFileSync(join(lexDir, 'cases-by-country.json'), 'utf8'));

const resolver = new Map();
for (const t of lexicon.terms) {
  resolver.set(t.zh, t.canonical);
  for (const a of t.aliases) if (!resolver.has(a.trim())) resolver.set(a.trim(), t.canonical);
}
const termOf = c => lexicon.terms.find(t => t.canonical === c);
const resolveTag = s => resolver.get(s.trim()) || null;

const wb = read(readFileSync(XLSX_PATH), { type: 'buffer' });
const litRows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

const papers = [];
const unresolved = new Set();
for (let r = 1; r < litRows.length; r++) {
  const row = litRows[r];
  const title = String(row[1] || '').trim();
  if (!title) continue;
  const tags = [];
  for (const raw of String(row[10] || '').split(';')) {
    const s = raw.trim();
    if (!s) continue;
    const c = resolveTag(s);
    if (!c) { unresolved.add(s); continue; }
    if (!tags.includes(c)) tags.push(c);
  }
  const iso = String(row[11] || '').split(';').map(s => s.trim()).filter(Boolean);
  papers.push({
    id: 'P' + String(r).padStart(3, '0'),
    aspect: String(row[0] || '').trim(),
    title,
    title_en: String(row[13] || '').trim(),
    year: String(row[2] || '').trim(),
    subtype: String(row[3] || '').trim(),
    region_label: String(row[4] || '').trim(),
    study_type: String(row[5] || '').trim(),
    exposure: String(row[6] || '').trim(),
    findings: String(row[7] || '').trim(),
    findings_en: String(row[14] || '').trim(),
    model_param: String(row[8] || '').trim(),
    url: String(row[9] || '').trim(),
    tags,
    iso,
    scope: String(row[12] || '').trim() || 'none'
  });
}

const freq = new Map();
const pair = new Map();
for (const p of papers) {
  for (const c of p.tags) freq.set(c, (freq.get(c) || 0) + 1);
  for (let i = 0; i < p.tags.length; i++)
    for (let j = i + 1; j < p.tags.length; j++) {
      const k = [p.tags[i], p.tags[j]].sort().join('__');
      pair.set(k, (pair.get(k) || 0) + 1);
    }
}
const nodes = [...freq.entries()].map(([c, n]) => {
  const t = termOf(c);
  return { id: c, zh: t.zh, en: t.en, category: t.category, count: n };
});
const edges = [...pair.entries()].map(([k, w]) => {
  const [source, target] = k.split('__');
  return { source, target, weight: w };
});
const network = { nodes, edges };

const geoByIso = {};
const scopeTally = { country: 0, region: 0, global: 0, none: 0 };
for (const p of papers) {
  scopeTally[p.scope] = (scopeTally[p.scope] || 0) + 1;
  if (p.scope === 'country') {
    for (const iso of p.iso) {
      if (!geoByIso[iso]) {
        const entry = Object.values(countryMap.map).find(m => (m.iso || []).includes(iso));
        const idx = entry ? entry.iso.indexOf(iso) : -1;
        const iso_num = entry && entry.iso_num ? entry.iso_num[idx] : null;
        geoByIso[iso] = { iso, iso_num, en: entry ? entry.en : iso, zh: entry ? entry.zh : iso,
          centroid: entry ? entry.centroid : null, paper_count: 0 };
      }
      geoByIso[iso].paper_count++;
    }
  }
}
const geo = {
  by_country: Object.values(geoByIso).sort((a, b) => b.paper_count - a.paper_count),
  scope_tally: scopeTally,
  note: 'paper_count = 文獻密度（scope=country 才落點）；region/global/none 見 scope_tally 另計。人類病例 by-country choropleth 需 WHO 分國資料，尚待結構化。'
};

const qRows = utils.sheet_to_json(wb.Sheets['季度監測'], { header: 1, defval: '' });
const qHeader = qRows[0].map(h => String(h).trim());
const quarterly = [];
for (let r = 1; r < qRows.length; r++) {
  if (!String(qRows[r][0] || '').trim()) continue;
  const obj = {};
  qHeader.forEach((h, i) => { obj[h] = String(qRows[r][i] || '').trim(); });
  quarterly.push(obj);
}
const surveillance = { ...kpi, quarterly };

writeFileSync(join(outDir, 'papers.json'), JSON.stringify(papers, null, 2), 'utf8');
writeFileSync(join(outDir, 'network.json'), JSON.stringify(network, null, 2), 'utf8');
writeFileSync(join(outDir, 'geo.json'), JSON.stringify(geo, null, 2), 'utf8');
writeFileSync(join(outDir, 'surveillance.json'), JSON.stringify(surveillance, null, 2), 'utf8');
writeFileSync(join(outDir, 'sources.json'), JSON.stringify(sources, null, 2), 'utf8');
copyFileSync(join(lexDir, 'lexicon.json'), join(outDir, 'lexicon.json'));
copyFileSync(join(lexDir, 'i18n.json'), join(outDir, 'i18n.json'));
writeFileSync(join(outDir, 'cases.json'), JSON.stringify(cases, null, 2), 'utf8');

console.log('\n=== build-all 完成 ===');
console.log(`papers.json      : ${papers.length} 筆文獻`);
console.log(`network.json     : ${nodes.length} 節點 / ${edges.length} 邊`);
console.log(`geo.json         : ${geo.by_country.length} 國家落點；scope ${JSON.stringify(scopeTally)}`);
console.log(`surveillance.json: KPI + ${quarterly.length} 季`);
console.log(`cases.json       : ${cases.rows.length} 國病例（總 ${cases._meta.total_cases}）`);
console.log(`sources.json     : ${sources.sources.length} 來源`);
console.log(`lexicon.json     : ${lexicon.terms.length} 詞條 (複製)`);
if (unresolved.size) console.log(`[!] 未解析標籤: ${[...unresolved].join(', ')}`);
else console.log('[OK] 全部標籤解析成功');
console.log('輸出 →', outDir, '\n');
