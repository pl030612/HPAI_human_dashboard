import { BUILD_VERSION } from './build-version.js';

let LANG = localStorage.getItem('hpai_lang') || 'zh';
let DICT = null;

export async function initI18n() {
  DICT = await fetch('data/i18n.json?v=' + BUILD_VERSION).then(r => r.json());
  document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-Hant';
  return DICT;
}
export const getLang = () => LANG;
export function setLang(l) {
  LANG = l;
  localStorage.setItem('hpai_lang', l);
  document.documentElement.lang = l === 'en' ? 'en' : 'zh-Hant';
}
export function t(key, params = {}) {
  let s = (DICT.ui[LANG] && DICT.ui[LANG][key]) ?? key;
  for (const k in params) s = s.replaceAll('{' + k + '}', params[k]);
  return s;
}
export function trMap(kind, zhKey) {
  if (LANG !== 'en') return zhKey;
  return (DICT[kind] && DICT[kind][zhKey]) || zhKey;
}
export const catLabel = cat => (DICT.cat[cat] ? DICT.cat[cat][LANG] : cat);
export const pick = (obj, base) => LANG === 'en'
  ? (obj[base + '_en'] ?? obj[base] ?? obj[base + '_zh'])
  : (obj[base] ?? obj[base + '_zh']);

export function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}
export function wireLangToggle(onChange) {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  btn.textContent = t('lang_btn');
  btn.onclick = () => {
    setLang(LANG === 'zh' ? 'en' : 'zh');
    btn.textContent = t('lang_btn');
    applyStatic();
    onChange();
  };
}
