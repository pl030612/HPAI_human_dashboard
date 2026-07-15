import { initI18n, applyStatic, wireLangToggle, t, trMap, pick, catLabel, getLang } from './i18n.js';

const d3 = window.d3, topojson = window.topojson;
const load = f => fetch('data/' + f).then(r => r.json());
await initI18n();
const [papers, net, lexicon, geo] = await Promise.all([
  load('papers.json'), load('network.json'), load('lexicon.json'), load('geo.json')
]);

const term = new Map(lexicon.terms.map(t => [t.canonical, t]));
const catColor = { subtype: '#2a78d6', clade: '#4a3aa7', mutation: '#e34948', host: '#1baf7a', exposure: '#eda100', method: '#888780', theme: '#e87ba4' };
const labelOf = c => { const tm = term.get(c); return tm ? (getLang() === 'en' ? tm.en : tm.zh) : c; };
const state = { q: '', scope: 'all', tags: new Set(), aspect: '', country: '' };

function buildSelects() {
  const asp = document.getElementById('aspect-filter');
  asp.innerHTML = `<option value="">${t('aspect_all')}</option>` +
    [...new Set(papers.map(p => p.aspect).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'))
      .map(a => `<option value="${a}"${a === state.aspect ? ' selected' : ''}>${trMap('aspect', a)}</option>`).join('');
  const cty = document.getElementById('country-filter');
  cty.innerHTML = `<option value="">${t('country_all')}</option>` +
    geo.by_country.map(c => `<option value="${c.iso}"${c.iso === state.country ? ' selected' : ''}>${getLang() === 'en' ? c.en : c.zh}（${c.paper_count}）</option>`).join('');
}

function matchText(p) {
  if (!state.q) return true;
  const needle = state.q.toLowerCase();
  const inField = v => String(v || '').toLowerCase().includes(needle);
  if (state.scope === 'all') {
    const tagText = p.tags.map(c => (term.get(c)?.zh || '') + ' ' + (term.get(c)?.en || '')).join(' ').toLowerCase();
    return ['title', 'title_en', 'subtype', 'region_label', 'study_type', 'exposure', 'findings', 'findings_en']
      .some(f => inField(p[f])) || tagText.includes(needle);
  }
  return inField(p[state.scope]);
}
const filtered = () => papers.filter(p =>
  matchText(p) && [...state.tags].every(x => p.tags.includes(x)) &&
  (!state.aspect || p.aspect === state.aspect) && (!state.country || p.iso.includes(state.country)));

function renderChips() {
  const box = document.getElementById('active-chips');
  const chips = [];
  if (state.q) chips.push(['q', `「${state.q}」`]);
  if (state.aspect) chips.push(['aspect', trMap('aspect', state.aspect)]);
  if (state.country) { const c = geo.by_country.find(x => x.iso === state.country); chips.push(['country', c ? (getLang() === 'en' ? c.en : c.zh) : state.country]); }
  [...state.tags].forEach(x => chips.push(['tag:' + x, labelOf(x), catColor[term.get(x)?.category]]));
  box.innerHTML = chips.length
    ? chips.map(([k, label, color]) => `<span class="badge rounded-pill" role="button" data-clear="${k}" style="cursor:pointer;background:${color || '#6c757d'}">${label} ✕</span>`).join('')
      + `<button class="btn btn-sm btn-link text-decoration-none py-0" id="clear-all">${t('clear_all')}</button>`
    : `<span class="text-secondary small">${t('chips_empty')}</span>`;
}

function renderResults() {
  const list = filtered();
  document.getElementById('lit-count').textContent = t('litcount', { n: list.length, total: papers.length });
  document.getElementById('lit-count-footer').textContent = t('litcount_footer', { n: list.length, total: papers.length });
  const el = document.getElementById('results');
  if (!list.length) { el.innerHTML = `<div class="card"><div class="card-body text-secondary small">${t('results_empty')}</div></div>`; return; }
  el.innerHTML = list.map(p => `
    <div class="card mb-2"><div class="card-body py-2 px-3">
      <div class="d-flex justify-content-between gap-2">
        <a href="${p.url}" target="_blank" rel="noopener" class="fw-medium text-decoration-none">${pick(p, 'title')}</a>
        <span class="small text-secondary text-nowrap">${p.year}</span>
      </div>
      <div class="small text-secondary my-1">${trMap('aspect', p.aspect)}　·　${p.subtype || '—'}　·　${trMap('region', p.region_label)}　·　${trMap('study_type', p.study_type)}</div>
      <div class="small mb-1">${pick(p, 'findings')}</div>
      <div class="d-flex flex-wrap gap-1">${p.tags.map(c =>
        `<span class="badge rounded-pill" role="button" data-tag="${c}" style="cursor:pointer;font-weight:400;background:${catColor[term.get(c)?.category] || '#6c757d'}">${labelOf(c)}</span>`).join('')}</div>
    </div></div>`).join('');
  el.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { state.tags.add(b.dataset.tag); rerender(); });
}

function renderLegend() {
  document.getElementById('net-legend').innerHTML = Object.keys(catColor).map(k =>
    `<span><span class="dot" style="background:${catColor[k]}"></span>${catLabel(k)}</span>`).join('');
}

let netUpdate = () => {}, netLabelUpdate = () => {}, netMapUpdate = () => {};
function rerender() { renderChips(); renderResults(); netUpdate(); netMapUpdate(); }

document.getElementById('q').oninput = e => { state.q = e.target.value.trim(); rerender(); };
document.getElementById('scope').onchange = e => { state.scope = e.target.value; rerender(); };
document.getElementById('aspect-filter').onchange = e => { state.aspect = e.target.value; rerender(); };
document.getElementById('country-filter').onchange = e => { state.country = e.target.value; rerender(); };
document.getElementById('active-chips').onclick = e => {
  const c = e.target.dataset.clear;
  if (e.target.id === 'clear-all') { state.q = ''; state.tags.clear(); state.aspect = ''; state.country = ''; document.getElementById('q').value = ''; document.getElementById('aspect-filter').value = ''; document.getElementById('country-filter').value = ''; rerender(); }
  else if (c === 'q') { state.q = ''; document.getElementById('q').value = ''; rerender(); }
  else if (c === 'aspect') { state.aspect = ''; document.getElementById('aspect-filter').value = ''; rerender(); }
  else if (c === 'country') { state.country = ''; document.getElementById('country-filter').value = ''; rerender(); }
  else if (c && c.startsWith('tag:')) { state.tags.delete(c.slice(4)); rerender(); }
};

applyStatic();
buildSelects();
renderLegend();
drawNetwork();
drawMap();
rerender();
wireLangToggle(() => { buildSelects(); renderLegend(); netLabelUpdate(); rerender(); });

function drawNetwork() {
  const el = document.getElementById('network');
  const W = 680, H = 420;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).style('width', '100%');
  const linkG = svg.append('g').attr('stroke', '#adb5bd');
  const nodeG = svg.append('g');
  const nodes = net.nodes.map(n => ({ ...n }));
  const links = net.edges.map(e => ({ ...e }));
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => 70 - Math.min(d.weight * 4, 40)).strength(0.25))
    .force('charge', d3.forceManyBody().strength(-140))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(d => 6 + Math.sqrt(d.count) * 2.4 + 4));
  const link = linkG.selectAll('line').data(links).join('line')
    .attr('stroke-width', d => Math.min(Math.sqrt(d.weight), 3)).attr('stroke-opacity', 0.35);
  const node = nodeG.selectAll('g').data(nodes).join('g').style('cursor', 'pointer')
    .on('click', (ev, d) => { state.tags.has(d.id) ? state.tags.delete(d.id) : state.tags.add(d.id); rerender(); })
    .call(d3.drag()
      .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  node.append('circle').attr('r', d => 5 + Math.sqrt(d.count) * 2.4)
    .attr('fill', d => catColor[d.category] || '#6c757d').attr('stroke', '#fff').attr('stroke-width', 1.2);
  node.append('text').attr('x', d => 7 + Math.sqrt(d.count) * 2.4).attr('y', 4)
    .attr('font-size', d => d.count >= 4 ? 11 : 9).attr('fill', 'var(--bs-body-color)').style('pointer-events', 'none');
  sim.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
  netLabelUpdate = () => node.select('text').text(d => labelOf(d.id));
  netLabelUpdate();
  netUpdate = () => {
    const active = state.tags;
    node.select('circle').attr('stroke', d => active.has(d.id) ? '#000' : '#fff')
      .attr('stroke-width', d => active.has(d.id) ? 2.5 : 1.2)
      .attr('opacity', d => active.size && !active.has(d.id) ? 0.35 : 1);
    node.select('text').style('display', d => (active.has(d.id) || d.count >= 3) ? null : 'none')
      .attr('opacity', d => active.size && !active.has(d.id) ? 0.4 : 1);
    link.attr('stroke-opacity', d => !active.size ? 0.35 : ((active.has(d.source.id) || active.has(d.target.id)) ? 0.55 : 0.08));
  };
}

async function drawMap() {
  const el = document.getElementById('map');
  const W = 680, H = 340;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).style('width', '100%');
  const tip = d3.select(el).style('position', 'relative').append('div').attr('class', 'map-tooltip');
  const byNum = new Map();
  for (const c of geo.by_country) if (c.iso_num) byNum.set(String(+c.iso_num), c);
  const max = d3.max(geo.by_country, c => c.paper_count) || 1;
  const color = d3.scaleSequential(d3.interpolateBlues).domain([0, max]);
  const noData = getComputedStyle(document.body).getPropertyValue('--bs-secondary-bg') || '#e9ecef';
  const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  const countries = topojson.feature(world, world.objects.countries).features;
  const path = d3.geoPath(d3.geoNaturalEarth1().fitSize([W, H], { type: 'FeatureCollection', features: countries }));
  const paths = svg.selectAll('path').data(countries).join('path').attr('class', 'country').attr('d', path)
    .attr('fill', d => { const c = byNum.get(String(+d.id)); return c ? color(c.paper_count) : noData; })
    .style('cursor', d => byNum.get(String(+d.id)) ? 'pointer' : 'default')
    .on('click', (ev, d) => { const c = byNum.get(String(+d.id)); if (!c) return; state.country = state.country === c.iso ? '' : c.iso; document.getElementById('country-filter').value = state.country; rerender(); })
    .on('mousemove', (ev, d) => { const c = byNum.get(String(+d.id)); const [x, y] = d3.pointer(ev, el);
      tip.style('opacity', 1).style('left', (x + 12) + 'px').style('top', (y + 12) + 'px')
        .html(c ? `<strong>${getLang() === 'en' ? c.en : c.zh}</strong><br>${c.paper_count} ${getLang() === 'en' ? 'papers' : '篇'}` : (d.properties.name || '')); })
    .on('mouseleave', () => tip.style('opacity', 0));
  netMapUpdate = () => paths.attr('stroke', d => { const c = byNum.get(String(+d.id)); return (c && c.iso === state.country) ? '#000' : 'var(--bs-body-bg)'; })
    .attr('stroke-width', d => { const c = byNum.get(String(+d.id)); return (c && c.iso === state.country) ? 2 : 0.4; });
}
