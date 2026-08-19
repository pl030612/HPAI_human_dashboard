import { initI18n, applyStatic, wireLangToggle, t, trMap, pick, getLang } from './i18n.js';
import { BUILD_VERSION } from './build-version.js';

const d3 = window.d3, topojson = window.topojson, Chart = window.Chart;
const load = f => fetch('data/' + f + '?v=' + BUILD_VERSION).then(r => r.json());
const nf = new Intl.NumberFormat('en-US');

await initI18n();
const [surv, geo, papers, sources, cases] = await Promise.all([
  load('surveillance.json'), load('geo.json'), load('papers.json'), load('sources.json'), load('cases.json')
]);

let aspectChart = null;

function renderText() {
  document.getElementById('freshness').textContent = t('freshness', { asOf: surv._meta.asOf, next: '2026-10' });
  document.getElementById('footer-meta').textContent = t('footer_meta', { asOf: surv._meta.asOf });

  const kpi = ({ label, value, sub, accent }) => `<div class="col-6 col-md-4 col-xl">
    <div class="kpi-card ${accent ? 'accent-' + accent : ''}">
      <div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>
      <div class="kpi-sub text-secondary">${sub}</div></div></div>`;
  document.getElementById('kpi-row').innerHTML = [
    kpi({ label: t('kpi_global'), value: nf.format(surv.global.cumulative_human_cases), sub: t('kpi_global_sub', { y: surv.global.since_year, cfr: Math.round(surv.global.cfr * 100) }) }),
    kpi({ label: t('kpi_tw_h5n1'), value: surv.taiwan.h5n1_local, sub: t('kpi_tw_h5n1_sub'), accent: 'success' }),
    kpi({ label: t('kpi_tw_local'), value: surv.taiwan.all_subtype_local, sub: t('kpi_tw_local_sub'), accent: 'warning' }),
    kpi({ label: t('kpi_tw_cum'), value: surv.taiwan.cumulative_incl_imported, sub: t('kpi_tw_cum_sub', { imp: surv.taiwan.cumulative_incl_imported - surv.taiwan.all_subtype_local, y: surv.taiwan.since_year }) }),
    kpi({ label: t('kpi_tw_poultry'), value: surv.taiwan_poultry.cumulative_outbreaks, sub: t('kpi_tw_poultry_sub', { since: surv.taiwan_poultry.since, asOf: surv.taiwan_poultry.cumulative_as_of }), accent: 'danger' }),
    kpi({ label: t('kpi_tw_poultry_season'), value: surv.taiwan_poultry.season_outbreaks, sub: t('kpi_tw_poultry_season_sub', { label: pick(surv.taiwan_poultry, 'season_label') }), accent: 'danger' })
  ].join('');

  const statusStyle = { new: '#dc3545', detected: '#fd7e14', monitoring: '#6c757d', not_crossed: '#198754' };
  document.getElementById('mutation-board').innerHTML = surv.mutation_watch.map(m => {
    const c = statusStyle[m.status] || '#6c757d';
    return `<div class="mut-row"><span class="mut-name">${m.zh}</span>
      <span class="mut-status" style="color:${c}"><span class="dot" style="background:${c}"></span>${getLang() === 'en' ? m.status_en : m.status_zh}</span></div>`;
  }).join('');

  const axisColor = { clade_2321: '#0d6efd', clade_2344b: '#fd7e14' };
  document.getElementById('clade-axes').innerHTML = surv.clade_axes.map(a =>
    `<div class="axis-card" style="border-left-color:${axisColor[a.id] || '#6c757d'}">
      <h4>${getLang() === 'en' ? a.en : a.zh} <span class="text-secondary small">${getLang() === 'en' ? a.zh : a.en}</span></h4>
      <div class="meta">${t('clade_region')}：${pick(a, 'region')}　·　${t('clade_severity')}：${pick(a, 'severity')}</div></div>`).join('');

  const q = surv.quarterly[0] || {};
  document.getElementById('quarter-label').textContent = q['季別'] || '';
  document.getElementById('quarter-brief').innerHTML = [
    '新增人類個案(國別/年齡/暴露源/亞型/結局)', '全球累計', '關鍵突變', '地理擴散事件', '對本土參數的意涵'
  ].filter(k => q[k]).map(k =>
    `<div class="row py-1 border-bottom"><div class="col-4 col-md-3 text-secondary">${trMap('quarter_field', k)}</div><div class="col-8 col-md-9">${q[k]}</div></div>`
  ).join('');

  document.querySelector('#sources-table tbody').innerHTML = sources.sources.map(s =>
    `<tr><td>${getLang() === 'en' ? s.title_en : s.title_zh}</td>
      <td class="text-secondary">${getLang() === 'en' ? s.org : s.org_zh}</td>
      <td><span class="badge text-bg-light">${pick(s, 'cadence')}</span></td>
      <td class="small text-secondary">${pick(s, 'method')}</td>
      <td><a href="${s.url}" target="_blank" rel="noopener" class="text-decoration-none">${t('src_link')}</a></td></tr>`).join('');

  const topC = cases.rows[0];
  document.getElementById('map-note').textContent = t('map_note', {
    total: nf.format(cases._meta.total_cases), deaths: cases._meta.total_deaths, n: cases.rows.length,
    top: getLang() === 'en' ? topC.en : topC.zh, max: topC.cases, asOf: cases._meta.as_of
  });
}

function renderChart() {
  const cnt = {};
  for (const p of papers) { const a = p.aspect || '—'; cnt[a] = (cnt[a] || 0) + 1; }
  const rows = Object.entries(cnt).sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  const canvas = document.getElementById('aspectChart');
  const whenSized = (el, cb, n = 30) => (el.clientWidth > 0 || n <= 0) ? cb() : requestAnimationFrame(() => whenSized(el, cb, n - 1));
  if (aspectChart) aspectChart.destroy();
  whenSized(canvas.parentElement, () => {
    aspectChart = new Chart(canvas, {
      type: 'bar',
      data: { labels: rows.map(r => trMap('aspect', r[0])), datasets: [{ data: rows.map(r => r[1]), backgroundColor: '#2a78d6', borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { font: { size: 11 } } } } }
    });
  });
}

applyStatic();
renderText();
renderChart();
drawMap();
wireLangToggle(() => { renderText(); renderChart(); });

async function drawMap() {
  const el = document.getElementById('map');
  const W = 960, H = 480;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
  const tip = d3.select(el).style('position', 'relative').append('div').attr('class', 'map-tooltip');
  const byNum = new Map();
  for (const c of cases.rows) if (c.iso_num) byNum.set(String(+c.iso_num), c);
  const max = d3.max(cases.rows, c => c.cases) || 1;
  const color = d3.scaleSequential(d3.interpolateReds).domain([0, Math.sqrt(max)]);
  const noData = getComputedStyle(document.body).getPropertyValue('--bs-secondary-bg') || '#e9ecef';
  const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  const countries = topojson.feature(world, world.objects.countries).features;
  const path = d3.geoPath(d3.geoNaturalEarth1().fitSize([W, H], { type: 'FeatureCollection', features: countries }));
  svg.selectAll('path').data(countries).join('path').attr('class', 'country').attr('d', path)
    .attr('fill', d => { const c = byNum.get(String(+d.id)); return c ? color(Math.sqrt(c.cases)) : noData; })
    .on('mousemove', (ev, d) => { const c = byNum.get(String(+d.id)); const [x, y] = d3.pointer(ev, el);
      const en = getLang() === 'en';
      tip.style('opacity', 1).style('left', (x + 12) + 'px').style('top', (y + 12) + 'px')
        .html(c ? `<strong>${en ? c.en : c.zh}</strong><br>${en ? 'cases' : '病例'} ${c.cases} · ${en ? 'deaths' : '死亡'} ${c.deaths}` : (d.properties.name || '')); })
    .on('mouseleave', () => tip.style('opacity', 0));
}
