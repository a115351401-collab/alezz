/* ═══════════════════════════════════════════════════════════
   currency.js — multi-currency engine for العز العالمي
   Base price from Carapis is USD. We convert to the visitor's
   chosen currency using LIVE daily rates (free, no key) with a
   hard-coded fallback so prices never break.

   Public API (window.CUR):
     CUR.code              → current currency code (e.g. 'SAR')
     CUR.set(code)         → switch currency (persists + emits 'currencychange')
     CUR.format(usd)       → HTML string: amount + symbol (SVG for SAR)
     CUR.list              → ordered list of {code, sym, ar, en, ko}
     CUR.onChange(fn)      → subscribe to changes
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // New Saudi Riyal symbol (U+20C1, Unicode 17.0) — most devices don't
  // render it yet, so we embed the official SAMA glyph as inline SVG.
  var SAR_SVG = '<svg class="sar-symbol" viewBox="0 0 1124.14 1256.39" width="0.92em" height="0.92em" fill="currentColor" style="display:inline-block;vertical-align:-0.12em;margin:0 0.06em;" aria-label="ريال سعودي"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>';

  // Ordered list — symbols exactly as the owner requested.
  // pos: 'before' → $1,234   'after' → 1,234 ﷼
  var LIST = [
    { code: 'USD', sym: '$',    pos: 'before', ar: 'دولار أمريكي',  en: 'US Dollar',      ko: '미국 달러' },
    { code: 'SAR', sym: SAR_SVG,pos: 'after',  ar: 'ريال سعودي',   en: 'Saudi Riyal',    ko: '사우디 리얄', svg: true },
    { code: 'KRW', sym: '₩',    pos: 'before', ar: 'وون كوري',     en: 'Korean Won',     ko: '대한민국 원' },
    { code: 'RUB', sym: '₽',    pos: 'before', ar: 'روبل روسي',    en: 'Russian Ruble',  ko: '러시아 루블' },
    { code: 'EGP', sym: 'ج.م',  pos: 'after',  ar: 'جنيه مصري',    en: 'Egyptian Pound', ko: '이집트 파운드' },
    { code: 'AED', sym: 'د.إ',  pos: 'after',  ar: 'درهم إماراتي', en: 'UAE Dirham',     ko: 'UAE 디르함' },
    { code: 'DZD', sym: 'د.ج',  pos: 'after',  ar: 'دينار جزائري', en: 'Algerian Dinar', ko: '알제리 디나르' },
    { code: 'KWD', sym: 'د.ك',  pos: 'after',  ar: 'دينار كويتي',  en: 'Kuwaiti Dinar',  ko: '쿠웨이트 디나르' },
    { code: 'QAR', sym: 'ر.ق',  pos: 'after',  ar: 'ريال قطري',    en: 'Qatari Riyal',   ko: '카타르 리얄' },
    { code: 'BHD', sym: 'د.ب',  pos: 'after',  ar: 'دينار بحريني', en: 'Bahraini Dinar', ko: '바레인 디나르' },
    { code: 'OMR', sym: 'ر.ع',  pos: 'after',  ar: 'ريال عماني',   en: 'Omani Rial',     ko: '오만 리알' }
  ];

  var BY_CODE = {};
  LIST.forEach(function (c) { BY_CODE[c.code] = c; });

  // Fallback rates per 1 USD (used until/if the live fetch lands).
  var FALLBACK = {
    USD: 1, SAR: 3.75, KRW: 1360, RUB: 92, EGP: 48,
    AED: 3.6725, DZD: 134, KWD: 0.307, QAR: 3.64, BHD: 0.376, OMR: 0.3845
  };
  // Currencies with no minor unit in typical pricing → 0 decimals.
  var ZERO_DEC = { KRW: 1, RUB: 1 };
  // High-value dinars → show whole numbers too (prices are large).
  var rates = Object.assign({}, FALLBACK);

  var listeners = [];
  function emit() {
    try { window.dispatchEvent(new CustomEvent('currencychange', { detail: { code: state.code } })); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(state.code); } catch (e) {} });
  }

  var state = { code: 'SAR' };
  try {
    var saved = localStorage.getItem('alezz_currency');
    if (saved && BY_CODE[saved]) state.code = saved;
  } catch (e) {}

  function decimals(code) { return ZERO_DEC[code] ? 0 : 0; } // all whole numbers — cleaner for car prices

  function convert(usd) {
    var r = rates[state.code] || FALLBACK[state.code] || 1;
    return (Number(usd) || 0) * r;
  }
  // Inverse: an amount typed in the chosen currency → USD (for price filters).
  function toUsd(amount) {
    var r = rates[state.code] || FALLBACK[state.code] || 1;
    return (Number(amount) || 0) / r;
  }
  // Convert amount from a specific currency code → USD.
  function fromCode(amount, code) {
    var r = rates[code] || FALLBACK[code] || 1;
    return (Number(amount) || 0) / r;
  }
  // Return the exchange rate for any currency code (units per 1 USD).
  function rateOf(code) { return rates[code] || FALLBACK[code] || 1; }

  function symbolHTML(code) {
    var c = BY_CODE[code] || BY_CODE.SAR;
    return c.svg ? c.sym : '<span class="cur-sym">' + c.sym + '</span>';
  }

  // Returns an HTML string (symbol is SVG for SAR) — use with innerHTML.
  function format(usd) {
    var c = BY_CODE[state.code] || BY_CODE.SAR;
    var val = convert(usd);
    var num = Math.round(val).toLocaleString('en-US');
    var sym = symbolHTML(state.code);
    return c.pos === 'before'
      ? sym + ' ' + '<span class="cur-amt">' + num + '</span>'
      : '<span class="cur-amt">' + num + '</span> ' + sym;
  }

  // Plain-text variant (no SVG) — for places that need textContent only.
  function formatText(usd) {
    var c = BY_CODE[state.code] || BY_CODE.SAR;
    var num = Math.round(convert(usd)).toLocaleString('en-US');
    var sym = c.svg ? '﷼' : c.sym; // U+FDFC legacy riyal glyph for plain text
    return c.pos === 'before' ? sym + ' ' + num : num + ' ' + sym;
  }

  // For decorative prices authored in SAR (auction samples, calculator):
  // convert the SAR amount to the chosen currency.
  function sarToUsd(sar) { return (Number(sar) || 0) / (rates.SAR || FALLBACK.SAR); }
  function formatSar(sar) { return format(sarToUsd(sar)); }
  function formatSarText(sar) { return formatText(sarToUsd(sar)); }

  // Auto-update every element carrying data-sar / data-usd on the page.
  function refreshDom() {
    var sarEls = document.querySelectorAll('[data-sar]');
    for (var i = 0; i < sarEls.length; i++) sarEls[i].innerHTML = formatSar(sarEls[i].getAttribute('data-sar'));
    var usdEls = document.querySelectorAll('[data-usd]');
    for (var j = 0; j < usdEls.length; j++) usdEls[j].innerHTML = format(usdEls[j].getAttribute('data-usd'));
  }

  function set(code) {
    if (!BY_CODE[code] || code === state.code) { if (BY_CODE[code]) emit(); return; }
    state.code = code;
    try { localStorage.setItem('alezz_currency', code); } catch (e) {}
    emit();
  }

  // ── Live rates: cache 12h in localStorage, refresh in background ──
  function loadRates() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('alezz_rates') || 'null'); } catch (e) {}
    if (cached && cached.rates && (Date.now() - cached.ts) < 12 * 3600 * 1000) {
      applyRates(cached.rates);
      return;
    }
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.result === 'success' && data.rates) {
          var picked = {};
          LIST.forEach(function (c) { if (data.rates[c.code] != null) picked[c.code] = data.rates[c.code]; });
          picked.USD = 1;
          applyRates(picked);
          try { localStorage.setItem('alezz_rates', JSON.stringify({ ts: Date.now(), rates: picked })); } catch (e) {}
        }
      })
      .catch(function () { /* keep fallback */ });
  }
  function applyRates(r) {
    Object.keys(r).forEach(function (k) { if (r[k]) rates[k] = r[k]; });
    emit(); // re-render any prices already on screen
  }

  window.CUR = {
    get code() { return state.code; },
    list: LIST,
    byCode: BY_CODE,
    set: set,
    format: format,
    formatText: formatText,
    formatSar: formatSar,
    formatSarText: formatSarText,
    symbolHTML: symbolHTML,
    convert: convert,
    toUsd: toUsd,
    fromCode: fromCode,
    rateOf: rateOf,
    refreshDom: refreshDom,
    onChange: function (fn) { listeners.push(fn); }
  };

  // Keep all static [data-sar]/[data-usd] prices in sync automatically.
  window.addEventListener('currencychange', refreshDom);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshDom);
  } else {
    refreshDom();
  }

  loadRates();
})();
