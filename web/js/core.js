/* ===== 云海转盘 · core ===== */
'use strict';

const NATIVE = (typeof window.Android !== 'undefined' && window.Android) ? window.Android : null;
const APP_VERSION = '0.2.8.13';
const DB_KEY = 'wheelapp.db.v2';
const PALETTE = ['#E8544A','#F08A3C','#F2C94C','#8CC152','#35BFA3','#2FA8DA','#4C7FE0','#6C63CE','#A45FCB','#D95AA0','#E05A6B','#B7CE3D'];
const SYSTEM_FONT = '-apple-system,BlinkMacSystemFont,"PingFang SC","HarmonyOS Sans SC","Noto Sans SC","Source Han Sans SC",system-ui,sans-serif';
let customFontUrl = null;
let customFontFormat = null;
let customFontFamily = null;
let customFontFace = null;

const ICON = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.3c0-1 1.1-1.6 2-1.1l11 6.7c.9.5.9 1.7 0 2.2l-11 6.7c-.9.5-2-.1-2-1.1V5.3z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chevUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  chevRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.4"/><circle cx="9" cy="16" r="2.4"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5A1.5 1.5 0 0 0 5.5 16H8l4 3.5c.7.6 1.8.1 1.8-.8V5.3c0-.9-1.1-1.4-1.8-.8L8 8H5.5A1.5 1.5 0 0 0 4 9.5z"/><path d="M17 9c1.4 1.7 1.4 4.3 0 6M19.5 6.5c2.5 3 2.5 8 0 11"/></svg>',
  speakerOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5A1.5 1.5 0 0 0 5.5 16H8l4 3.5c.7.6 1.8.1 1.8-.8V5.3c0-.9-1.1-1.4-1.8-.8L8 8H5.5A1.5 1.5 0 0 0 4 9.5z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.5c1.6 0 3.1 1 4 2.4l3 5.2c.9 1.4 2.4 2.4 4 2.4H21M18 14l3 3-3 3M3 17h3.5c1.6 0 3.1-1 4-2.4l.7-1.2M17 7h4M18 4l3 3-3 3"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-10z"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h7l9 9-7 7-9-9V4z"/><circle cx="8.5" cy="8.5" r="1.3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.7"/><path d="M12 11v5M12 8h.01"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7 10v4M5 12h4M16 11h.01M18.5 13h.01"/></svg>',
  wheel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2M3.4 12h17.2M5.9 5.9l12.2 12.2M18.1 5.9L5.9 18.1"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z"/></svg>'
};

/* ---------- utils ---------- */
function $(sel, root){ return (root || document).querySelector(sel); }
function $$(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function uid(p){ return (p || 'w') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clamp(n, a, b){ n = Number(n); if (!isFinite(n)) n = a; return Math.max(a, Math.min(b, n)); }
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function toast(msg, ms){
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, ms || 2300);
}
function haptic(ms){
  try { if (NATIVE && NATIVE.vibrate) NATIVE.vibrate(ms || 12); else if (navigator.vibrate) navigator.vibrate(ms || 12); } catch(e){}
}
function pad2(n){ return n < 10 ? '0' + n : '' + n; }
function dateStamp(d){
  d = d || new Date();
  return d.getFullYear() + pad2(d.getMonth()+1) + pad2(d.getDate()) + '_' + pad2(d.getHours()) + pad2(d.getMinutes());
}
function normalizeCategoryName(s){
  s = String(s || '').trim().replace(/\s+/g, ' ');
  return s.slice(0, 16);
}

/* ---------- settings / db ---------- */
function defaultSettings(){
  return {
    spinSeconds: 4.2,
    defaultAvoid: false,
    ttsEnabled: true,
    ttsEngine: 'system',
    customTtsProvider: 'openai',
    customTtsMode: 'builtin',
    customTtsUrl: '',
    customTtsKey: '',
    customTtsModel: 'tts-1',
    customTtsVoice: 'alloy',
    customTtsFormat: 'mp3',
    customTtsDesign: '',
    customTtsRefPath: '',
    customTtsRefName: '',
    customTtsSegmentClone: false,
    customTtsShowHint: true,
    systemTtsSegment: false,
    aiTransMode: 'local',
    aiTransStyle: 'qwen',
    aiTransProvider: 'qwen',
    aiTransUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    aiTransKey: '',
    aiTransModel: 'qwen-plus',
    ttsTemplate: '抽到 {result}',
    ttsRate: 1.0,
    ttsPitch: 1.0,
    sovitsUrl: '',
    sovitsRef: '',
    sovitsPromptText: '',
    sovitsPromptLang: 'zh',
    sovitsTextLang: 'zh',
    sovitsSplit: 'cut5',
    sovitsMode: 'pc',
    cloneUrl: '',
    cloneKey: '',
    phoneUrl: 'http://127.0.0.1:9881',
    phoneKey: '',
    deployUrl: 'https://gptsovit.rainstone103.top',
    defaultJumpDelay: 2.0,
    autoGoto: true,
    avoidReset: 3.0,
    fontMode: 'system',
    fontScope: 'wheel',
    fontName: '',
    fontFormat: '',
    onboarded: false
  };
}

function newWheel(title, items, category){
  return {
    id: uid('w'),
    title: title || '未命名转盘',
    category: category || '未分类',
    items: (items || []).map(function(it){
      if (typeof it === 'string') return { text: it, weight: 100, group: 1 };
      const g = Number(it.group);
      const out = { text: String(it.text != null ? it.text : ''), weight: Math.max(0, Number(it.weight != null ? it.weight : 100) || 0), group: Number.isInteger(g) && g >= 0 ? g : 1 };
      const val = Number(it.value);
      if (it.value != null && it.value !== '' && isFinite(val)) out.value = val;
      return out;
    }),
    avoid: false,
    autogoto: true,
    drawn: [],
    disabled: [],
    counts: {},
    script: '',
    lastResult: '',
    rules: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function seedDb(){
  const a = newWheel('今天吃什么', ['火锅','烧烤','日料','麻辣烫','汉堡','面条','沙拉','炒饭'], '示例');
  a.avoid = true;
  const b = newWheel('现在做什么', ['摸鱼五分钟','喝杯水','站起来走走','继续写代码','听一首歌','收拾桌面'], '示例');
  return {
    version: 2,
    categories: ['未分类', '示例'],
    wheels: [a, b],
    settings: defaultSettings(),
    createdAt: Date.now()
  };
}

function readRaw(){
  let raw = null;
  try { if (NATIVE && NATIVE.loadData) raw = NATIVE.loadData(); } catch(e){}
  if (!raw) { try { raw = localStorage.getItem(DB_KEY); } catch(e){} }
  return raw;
}

function loadDb(){
  let d = null;
  const raw = readRaw();
  if (raw) { try { d = JSON.parse(raw); } catch(e){} }
  if (!d || !Array.isArray(d.wheels)) d = seedDb();
  d.version = 2;
  d.settings = Object.assign(defaultSettings(), d.settings || {});
  d.settings.spinSeconds = clamp(d.settings.spinSeconds, 1.5, 10);
  (d.wheels || []).forEach(function(w){ if (w.spinSeconds != null && isFinite(Number(w.spinSeconds))) w.spinSeconds = clamp(Number(w.spinSeconds), 0.5, 30); });
  d.settings.ttsRate = clamp(d.settings.ttsRate, 0.5, 2);
  d.settings.ttsPitch = clamp(d.settings.ttsPitch, 0.5, 2);
  d.settings.defaultJumpDelay = clamp(d.settings.defaultJumpDelay, 0, 60);
  d.settings.autoGoto = d.settings.autoGoto !== false;
  d.settings.avoidReset = clamp(Number(d.settings.avoidReset) || 0, 0, 60);
  if (d.settings.fontMode === 'builtin'){ d.settings.fontMode = 'system'; d.settings.fontName = ''; d.settings.fontFormat = ''; }
  if (!Array.isArray(d.categories) || !d.categories.length) d.categories = ['未分类'];
  if (d.categories.indexOf('未分类') < 0) d.categories.unshift('未分类');
  if (!Array.isArray(d.voices)) d.voices = [];
  if (!d.scriptVars || typeof d.scriptVars !== 'object') d.scriptVars = {};
  if (typeof d.globalScript !== 'string' || !d.globalScript){
    const legacy = (d.wheels || []).find(function(w){ return (w.script || '').trim(); });
    d.globalScript = legacy ? String(legacy.script) : '';
  }
  if (typeof normalizeScriptPunctuation === 'function') d.globalScript = normalizeScriptPunctuation(d.globalScript);
  if (!Array.isArray(d.history)) d.history = [];
  d.history = d.history.filter(function(h){ return h && typeof h.text === 'string' && h.at; }).slice(0, 3000);
  if (d.settings.sovitsMode === 'clone') d.settings.sovitsMode = 'pc';
  if (!d.settings.sovitsMode) d.settings.sovitsMode = 'pc';
  if (!d.settings.phoneUrl) d.settings.phoneUrl = 'http://127.0.0.1:9881';
  d.voices.forEach(function(v){ v.target = v.target === 'phone' ? 'phone' : 'pc'; });
  d.activeVoiceIds = Object.assign({ pc: '', phone: '' }, d.activeVoiceIds || {});
  if (!d.activeVoiceIds.pc && d.activeVoiceId) d.activeVoiceIds.pc = d.activeVoiceId;
  d.activeVoiceId = d.activeVoiceIds.pc || '';
  d.wheels.forEach(function(w){
    w.id = w.id || uid('w');
    w.title = String(w.title || '未命名转盘');
    w.category = String(w.category || '未分类');
    if (d.categories.indexOf(w.category) < 0) d.categories.push(w.category);
    w.items = (Array.isArray(w.items) ? w.items : []).map(function(it){
      if (typeof it === 'string') return { text: it, weight: 100, group: 1 };
      const g = Number(it && it.group);
      return { text: String(it && it.text != null ? it.text : ''), weight: Math.max(0, Number(it && it.weight != null ? it.weight : 100) || 0), group: Number.isInteger(g) && g >= 0 ? g : 1 };
    });
    w.avoid = !!w.avoid;
    w.autogoto = w.autogoto !== false;
    w.drawn = Array.isArray(w.drawn) ? w.drawn.filter(function(i){ return i >= 0 && i < w.items.length; }) : [];
    w.disabled = Array.isArray(w.disabled) ? w.disabled.filter(function(i){ return i >= 0 && i < w.items.length; }) : [];
    w.counts = (w.counts && typeof w.counts === 'object') ? w.counts : {};
    w.script = typeof w.script === 'string' ? w.script : '';
    w.lastResult = typeof w.lastResult === 'string' ? w.lastResult : '';
    w.rules = Array.isArray(w.rules) ? w.rules : [];
    w.createdAt = w.createdAt || Date.now();
    w.updatedAt = w.updatedAt || w.createdAt;
  });
  return d;
}

let db = loadDb();

let saveTimer = null;
const HOME_PAGE = 60;
let editDraft = null;
let editBaseJson = null;
let overlayCtl = null;
let toastTimer = null;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}
function flushSave(){
  clearTimeout(saveTimer);
  saveTimer = null;
  let text;
  try { text = JSON.stringify(db); } catch(e){ return; }
  try { localStorage.setItem(DB_KEY, text); } catch(e){}
  try { if (NATIVE && NATIVE.saveData) NATIVE.saveData(text); } catch(e){}
}
document.addEventListener('visibilitychange', function(){ if (document.hidden) flushSave(); });
window.addEventListener('pagehide', flushSave);

function getWheel(id){ return db.wheels.filter(function(w){ return w.id === id; })[0] || null; }
function currentWheel(){ return getWheel(NAV.wheelId); }
function remainingCount(w){
  if (!w) return 0;
  if (!w.avoid) return w.items.length;
  const disabled = (w.disabled || []).filter(function(i){ return w.drawn.indexOf(i) < 0; }).length;
  return Math.max(0, w.items.length - w.drawn.length - disabled);
}
function saveYes(){ flushSave(); }

/* ---------- navigation ---------- */
const NAV = { page: 'home', wheelId: null, sorting: false, searchOpen: false, query: '', homeLimit: 60 };

function render(){
  if (NAV.page === 'wheel' && !getWheel(NAV.wheelId)) NAV.page = 'home';
  if (NAV.page === 'home') renderHome();
  else if (NAV.page === 'wheel') renderWheel();
  else if (NAV.page === 'voices') renderVoices();
  else if (NAV.page === 'script') renderScript();
  else if (NAV.page === 'scripts') renderScriptList();
  else if (NAV.page === 'groups') renderGroups();
  else if (NAV.page === 'history') renderHistory();
  else if (NAV.page === 'ttsfiles') renderTtsFiles();
  else if (NAV.page === 'aitrans') renderAiTrans();
  else if (NAV.page === 'games') renderGames();
  else if (NAV.page === 'fingertip') renderFingertip();
  else if (NAV.page === 'dice') renderDice();
  else if (NAV.page === 'editor') renderEditor();
  else if (NAV.page === 'rules') renderRules();
  else if (NAV.page === 'settings') renderSettings();
  else if (NAV.page === 'categories') renderCategories();
  else { NAV.page = 'home'; renderHome(); }
}

function go(page, id){
  if (typeof cancelAvoidReset === 'function' && (page !== 'wheel' || (id && NAV.wheelId && id !== NAV.wheelId))) cancelAvoidReset();
  if (page !== 'fingertip' && typeof stopFingertip === 'function') stopFingertip();
  if (page !== 'dice' && typeof stopDice === 'function') stopDice();
  if (page !== 'wheel' && wheelCtl){
    try { if (wheelCtl.raf) cancelAnimationFrame(wheelCtl.raf); } catch(e){}
    if (wheelCtl.cache) wheelCtl.cache = null;
    wheelCtl = null;
  }
  if (page !== 'wheel' && !window.__scriptRunning){
    if (typeof clearScriptShow === 'function') clearScriptShow();
    if (typeof clearTurtleCanvas === 'function') clearTurtleCanvas();
    if (typeof closeAllTk === 'function') closeAllTk();
  }
  if (page === 'wheel' && NAV.wheelId && id && NAV.wheelId !== id && !window.__scriptRunning){
    if (typeof clearScriptShow === 'function') clearScriptShow();
    if (typeof clearTurtleCanvas === 'function') clearTurtleCanvas();
    if (typeof closeAllTk === 'function') closeAllTk();
  }
  if ((page === 'settings' || page === 'categories') && NAV.page !== page){
    NAV.origin = { page: NAV.page, wheelId: NAV.wheelId };
  }
  if (page === 'wheel' || page === 'rules' || page === 'script' || page === 'groups') NAV.wheelId = id || NAV.wheelId;
  if (page === 'editor') NAV.wheelId = id || null;
  if (page === 'wheel' && typeof enterWheelSession === 'function'){
    enterWheelSession(NAV.wheelId, NAV.page);
  }
  NAV.page = page;
  NAV.homeLimit = 60;
  NAV.sorting = false;
  NAV.searchOpen = false;
  NAV.query = '';
  closeOverlay(true);
  cancelJump();
  if (!window.__keepSpeechOnce) stopSpeech();
  window.__keepSpeechOnce = false;
  render();
  if (page === 'wheel' && typeof prefetchNextSpin === 'function' && (window.__scriptRunning || window.__autoJumpArriving)){
    const scriptPrefetch = !!window.__scriptRunning;
    setTimeout(function(){
      if (scriptPrefetch && !window.__scriptRunning) return;
      prefetchNextSpin(currentWheel());
    }, 380);
  }
  window.__autoJumpArriving = false;
  try { window.scrollTo(0, 0); } catch(e){}
}

function back(){
  if (overlayCtl) { closeOverlay(); return true; }
  if (NAV.page !== 'home') {
    if (NAV.page === 'editor') {
      const dirty = (typeof editIsDirty === 'function') && editIsDirty();
      if (dirty) {
        confirmDialog({ title: '放弃修改？', desc: '这次的改动还没有保存。', ok: '放弃', danger: true }).then(function(ok){
          if (!ok) return;
          editDraft = null;
          go(NAV.wheelId ? 'wheel' : 'home', NAV.wheelId);
        });
      } else {
        editDraft = null;
        go(NAV.wheelId ? 'wheel' : 'home', NAV.wheelId);
      }
    }
    else if (NAV.page === 'rules') go('wheel', NAV.wheelId);
    else if (NAV.page === 'groups') go('wheel', NAV.wheelId);
    else if (NAV.page === 'script') go('settings');
    else if (NAV.page === 'scripts') go(NAV.scriptsFrom || 'settings');
    else if (NAV.page === 'history'){
      if (NAV.historyFrom === 'wheel' && getWheel(NAV.historyWheelId)) go('wheel', NAV.historyWheelId);
      else go('home');
    }
    else if (NAV.page === 'fingertip' || NAV.page === 'dice') go('games');
    else if (NAV.page === 'games') go('home');
    else if (NAV.page === 'ttsfiles') go('settings');
    else if (NAV.page === 'aitrans') go('games');
    else if (NAV.page === 'voices') go('settings');
    else if (NAV.page === 'settings' || NAV.page === 'categories') {
      const origin = NAV.origin;
      NAV.origin = null;
      if (origin && origin.page === 'wheel' && getWheel(origin.wheelId)) go('wheel', origin.wheelId);
      else go('home');
    }
    else go('home');
    return true;
  }
  return false;
}

window.__handleBack = function(){
  try { return back() ? 'handled' : 'exit'; } catch(e){ return 'exit'; }
};

/* ---------- overlays ---------- */
function openSheet(html, opts){
  opts = opts || {};
  closeOverlay(true);
  const root = $('#overlay-root');
  const ov = document.createElement('div');
  ov.className = 'overlay' + (opts.center ? ' center' : '');
  ov.innerHTML = opts.center ? '<div class="modal">' + html + '</div>' : '<div class="sheet"><div class="sheet-handle"></div>' + html + '</div>';
  root.appendChild(ov);
  ov.addEventListener('click', function(e){
    if (e.target === ov && opts.dismissible !== false) closeOverlay();
  });
  overlayCtl = { el: ov, onClose: opts.onClose || null };
  return ov;
}
function closeOverlay(silent){
  const c = overlayCtl;
  if (!c) return;
  overlayCtl = null;
  if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
  if (!silent && c.onClose) { try { c.onClose(); } catch(e){} }
  if (window.__scriptHelpDone){ const f = window.__scriptHelpDone; window.__scriptHelpDone = null; try { f(); } catch(e){} }
}

function confirmDialog(opt){
  opt = opt || {};
  return new Promise(function(resolve){
    const ov = openSheet(
      '<h3>' + esc(opt.title || '确认') + '</h3>' +
      (opt.desc ? '<p class="desc">' + opt.desc + '</p>' : '') +
      '<div class="modal-actions">' +
        '<button class="btn" data-k="0">' + esc(opt.cancel || '取消') + '</button>' +
        '<button class="btn ' + (opt.danger ? 'accent' : 'primary') + '" data-k="1">' + esc(opt.ok || '确定') + '</button>' +
      '</div>', { center: true });
    $$('[data-k]', ov).forEach(function(b){
      b.onclick = function(){ const v = b.getAttribute('data-k') === '1'; closeOverlay(true); resolve(v); };
    });
  });
}

function promptDialog(opt){
  opt = opt || {};
  return new Promise(function(resolve){
    const ov = openSheet(
      '<h3>' + esc(opt.title || '输入') + '</h3>' +
      (opt.desc ? '<p class="desc">' + opt.desc + '</p>' : '') +
      '<div class="field"><label>' + esc(opt.label || '内容') + '</label>' +
      (opt.multiline
        ? '<textarea id="pv" placeholder="' + esc(opt.placeholder || '') + '">' + esc(opt.value || '') + '</textarea>'
        : '<input type="text" id="pv" value="' + esc(opt.value || '') + '" placeholder="' + esc(opt.placeholder || '') + '">') +
      '</div>' +
      '<div class="modal-actions"><button class="btn" data-k="0">取消</button><button class="btn primary" data-k="1">' + esc(opt.ok || '确定') + '</button></div>',
      { center: true });
    const inp = $('#pv', ov);
    setTimeout(function(){ try { inp.focus(); inp.select(); } catch(e){} }, 100);
    $$('[data-k]', ov).forEach(function(b){
      b.onclick = function(){
        const ok = b.getAttribute('data-k') === '1';
        const val = inp.value;
        closeOverlay(true);
        resolve(ok ? val : null);
      };
    });
  });
}

/* ---------- pickers ---------- */
function openWheelPicker(onPick, opt){
  opt = opt || {};
  let selCat = 'all';
  const catHtml = opt.withCategories
    ? '<div class="picker-cats" id="pkcats">' +
        '<button class="chip on" data-pkcat="all">全部分类</button>' +
        db.categories.map(function(c){ return '<button class="chip" data-pkcat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
      '</div>'
    : '';
  const ov = openSheet(
    '<h3>' + esc(opt.title || '选择转盘') + '</h3>' +
    catHtml +
    '<div class="picker-search">' + ICON.search + '<input id="pkq" type="text" placeholder="搜索转盘"></div>' +
    '<div class="picker-list" id="pklist"></div>',
    {});
  const input = $('#pkq', ov);
  const list = $('#pklist', ov);
  function draw(){
    const q = input.value.trim().toLowerCase();
    const arr = db.wheels.filter(function(w){
      if (opt.excludeId && w.id === opt.excludeId) return false;
      if (selCat !== 'all' && w.category !== selCat) return false;
      if (!q) return true;
      if (w.title.toLowerCase().indexOf(q) >= 0) return true;
      return false;
    });
    const shown = arr.slice(0, 80);
    let html = '';
    if (!shown.length) html = '<div class="empty" style="padding:30px 10px"><p>没有匹配的转盘</p></div>';
    shown.forEach(function(w){
      html += '<button class="picker-item' + (opt.currentId === w.id ? ' on' : '') + '" data-id="' + esc(w.id) + '">' +
        '<span class="ellipsis">' + esc(w.title) + '</span><span class="cnt">' + w.items.length + ' 项</span></button>';
    });
    if (arr.length > 80) html += '<div class="tiny muted" style="text-align:center;padding:12px">还有 ' + (arr.length - 80) + ' 个，请输入关键词</div>';
    list.innerHTML = html;
  }
  input.addEventListener('input', draw);
  const catBox = $('#pkcats', ov);
  if (catBox) catBox.addEventListener('click', function(e){
    const b = e.target.closest('[data-pkcat]');
    if (!b) return;
    selCat = b.getAttribute('data-pkcat');
    catBox.querySelectorAll('[data-pkcat]').forEach(function(x){ x.classList.toggle('on', x === b); });
    draw();
  });
  list.addEventListener('click', function(e){
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const w = getWheel(b.getAttribute('data-id'));
    if (w) { closeOverlay(true); onPick(w); }
  });
  draw();
}

function openOptionPicker(items, currentIndex, onPick){
  const ov = openSheet(
    '<h3>选择选项</h3>' +
    '<div class="picker-search">' + ICON.search + '<input id="oqp" type="text" placeholder="搜索选项"></div>' +
    '<div class="picker-list" id="oql"></div>',
    {});
  const input = $('#oqp', ov);
  const list = $('#oql', ov);
  function draw(){
    const q = input.value.trim().toLowerCase();
    const arr = [];
    items.forEach(function(it, i){
      if (q && String(it.text).toLowerCase().indexOf(q) < 0) return;
      arr.push({ it: it, i: i });
    });
    const shown = arr.slice(0, 100);
    let html = '';
    if (!shown.length) html = '<div class="empty" style="padding:30px 10px"><p>没有匹配的选项</p></div>';
    shown.forEach(function(x){
      html += '<button class="picker-item' + (x.i === currentIndex ? ' on' : '') + '" data-oi="' + x.i + '">' +
        '<span class="ellipsis">' + esc(x.it.text) + '</span><span class="cnt">#' + (x.i + 1) + '</span></button>';
    });
    if (arr.length > 100) html += '<div class="tiny muted" style="text-align:center;padding:12px">还有 ' + (arr.length - 100) + ' 个，请输入关键词</div>';
    list.innerHTML = html;
  }
  input.addEventListener('input', draw);
  list.addEventListener('click', function(e){
    const b = e.target.closest('[data-oi]');
    if (!b) return;
    const i = Number(b.getAttribute('data-oi'));
    closeOverlay(true);
    onPick(i);
  });
  draw();
}

function openCategoryPicker(current, onPick){
  const ov = openSheet(
    '<h3>选择分类</h3><div class="picker-list" id="catlist">' +
    db.categories.map(function(c){
      return '<button class="picker-item' + (c === current ? ' on' : '') + '" data-cat="' + esc(c) + '">' +
        '<span class="ellipsis">' + esc(c) + '</span><span class="cnt">' + db.wheels.filter(function(w){ return w.category === c; }).length + ' 个</span></button>';
    }).join('') +
    '</div><button class="btn block" id="newcat" style="margin-top:10px">＋ 新建分类</button>', {});
  $('#catlist', ov).addEventListener('click', function(e){
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    closeOverlay(true);
    onPick(b.getAttribute('data-cat'));
  });
  $('#newcat', ov).onclick = function(){
    closeOverlay(true);
    promptDialog({ title: '新建分类', label: '分类名称', placeholder: '最多 16 个字' }).then(function(name){
      name = normalizeCategoryName(name);
      if (!name) return;
      if (db.categories.indexOf(name) < 0) db.categories.push(name);
      save();
      onPick(name);
    });
  };
}

/* ---------- TTS ---------- */
function utc8TimeText(){
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = function(n){ return n < 10 ? '0' + n : '' + n; };
  return d.getUTCFullYear() + '年' + p(d.getUTCMonth() + 1) + '月' + p(d.getUTCDate()) + '日' +
    p(d.getUTCHours()) + '时' + p(d.getUTCMinutes()) + '分';
}

function templateVars(result, wheel){
  const total = wheel ? wheel.items.length : 0;
  const avoid = !!(wheel && wheel.avoid);
  const drawn = wheel && wheel.drawn ? wheel.drawn.length : 0;
  let count;
  if (avoid){
    count = drawn;
  } else if (wheel && typeof wheelSession !== 'undefined' && wheelSession && wheelSession.id === wheel.id){
    count = wheelSession.count || 0;
  } else {
    count = 0;
  }
  const last = avoid ? Math.max(0, total - drawn) : Math.max(0, total - count);
  return { result: String(result == null ? '' : result), count: count, last: last, time: utc8TimeText(), total: total };
}

function optionSpeechValue(item, result){
  if (item){
    const n = Number(item.value);
    if (item.value != null && item.value !== '' && isFinite(n)) return formatPyNumber(n);
  }
  const text = String(item && item.text != null ? item.text : (result == null ? '' : result)).trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return text;
  return String(item && item.text != null ? item.text : (result == null ? '' : result));
}

function isChineseLocale(){
  try { if (NATIVE && NATIVE.isChineseLocale) return !!NATIVE.isChineseLocale(); } catch(e){}
  return /^zh/i.test(String(navigator.language || navigator.userLanguage || ''));
}

function chineseInteger(n){
  n = Math.trunc(Math.abs(Number(n) || 0));
  if (n === 0) return '零';
  const digits = '零一二三四五六七八九';
  const units = ['', '十', '百', '千'];
  const big = ['', '万', '亿', '兆'];
  const groups = [];
  while (n > 0){ groups.push(n % 10000); n = Math.floor(n / 10000); }
  let out = '';
  for (let g = groups.length - 1; g >= 0; g--){
    const group = groups[g];
    if (group === 0){
      if (out && !out.endsWith('零')) out += '零';
      continue;
    }
    let s = '', zero = false;
    for (let i = 3; i >= 0; i--){
      const d = Math.floor(group / Math.pow(10, i)) % 10;
      if (d === 0){ if (s) zero = true; }
      else {
        if (zero){ s += '零'; zero = false; }
        s += digits[d] + units[i];
      }
    }
    if (out === '' && s.startsWith('一十') && groups.length === 1) s = s.slice(1);
    if (out && group < 1000 && !out.endsWith('零')) out += '零';
    out += s + big[g];
  }
  return out.replace(/零+/g, '零').replace(/零$/, '');
}

function chineseNumberText(value){
  let text = String(value);
  let sign = '';
  if (text.startsWith('-')){ sign = '负'; text = text.slice(1); }
  const parts = text.split('.');
  let out = sign + chineseInteger(parseInt(parts[0] || '0', 10));
  if (parts.length > 1) out += '点' + Array.from(parts[1]).map(function(d){ return '零一二三四五六七八九'[Number(d)] || '零'; }).join('');
  return out;
}

function ttsConvertNumbers(text){
  if (!isChineseLocale()) return String(text == null ? '' : text);
  return String(text == null ? '' : text).replace(/-?(?:\d+(?:\.\d*)?|\.\d+)/g, function(m){ return chineseNumberText(m); });
}

function speechText(result, wheel, item){
  const tpl = db.settings.ttsTemplate || '抽到 {result}';
  const v = templateVars(result, wheel || currentWheel());
  v.value = optionSpeechValue(item, result);
  return ttsConvertNumbers(tpl.replace(/\{(result|count|last|time|value)\}/g, function(m, k){ return String(v[k]); }));
}

let speechActive = false;
let speechWaiters = [];
function speechStarted(){ speechActive = true; }
function speechFinished(){
  speechActive = false;
  const list = speechWaiters;
  speechWaiters = [];
  list.forEach(function(fn){ try { fn(); } catch(e){} });
}
window.__onSpeechEnd = speechFinished;
function waitUntilReadFinish(){
  if (!speechActive) return Promise.resolve();
  return new Promise(function(resolve){
    let done = false;
    const finish = function(){
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 120000);
    speechWaiters.push(finish);
  });
}

function stopSpeech(){
  try { if (NATIVE && NATIVE.stopSpeaking) NATIVE.stopSpeaking(); } catch(e){}
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){}
  speechFinished();
}

function speakSystem(text){
  if (!text) return;
  const s = db.settings;
  speechStarted();
  try {
    if (NATIVE && NATIVE.speak) { NATIVE.speak(text, s.ttsRate, s.ttsPitch); return; }
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = s.ttsRate;
      u.pitch = s.ttsPitch;
      u.onend = speechFinished;
      u.onerror = speechFinished;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return;
    }
  } catch(e){}
  speechFinished();
}

function sovitsPayload(text, fallback){
  const s = db.settings;
  return {
    text: text,
    fallback: fallback || '',
    url: s.sovitsUrl || '',
    refAudio: s.sovitsRef || '',
    promptText: s.sovitsPromptText || '',
    promptLang: s.sovitsPromptLang || 'zh',
    textLang: s.sovitsTextLang || 'zh',
    split: s.sovitsSplit || 'cut5',
    speed: s.ttsRate || 1.0
  };
}

function cloneTarget(){
  const m = db.settings.sovitsMode;
  return m === 'phone' ? 'phone' : 'pc';
}

function targetUrl(t){
  t = t || cloneTarget();
  if (t === 'phone') return String(db.settings.phoneUrl || 'http://127.0.0.1:9881').trim();
  return String(db.settings.cloneUrl || '').trim();
}

function targetKey(t){
  t = t || cloneTarget();
  return t === 'phone' ? (db.settings.phoneKey || '') : (db.settings.cloneKey || '');
}

function activeVoice(t){
  t = t || cloneTarget();
  if (!db.activeVoiceIds || !db.activeVoiceIds[t]) return null;
  const id = db.activeVoiceIds[t];
  for (let i = 0; i < db.voices.length; i++){
    const v = db.voices[i];
    if (v.id === id && (v.target || 'pc') === t && v.uploaded && v.serverId) return v;
  }
  return null;
}

function clonePayload(text, fallback, t){
  t = t || cloneTarget();
  const v = activeVoice(t);
  return {
    url: targetUrl(t),
    key: targetKey(t),
    voiceId: v ? v.serverId : '',
    text: text || '',
    fallback: fallback || '',
    speed: db.settings.ttsRate || 1.0
  };
}

function speakResult(resultText, wheel, item, textOverride){
  const s = db.settings;
  if (!s.ttsEnabled) return;
  const text = textOverride || speechText(resultText, wheel || currentWheel(), item);
  if (s.ttsEngine === 'custom'){
    const url = String(s.customTtsUrl || '').trim();
    if (!url){ speakSystem(text); return; }
    if (s.customTtsMode === 'clone' && s.customTtsSegmentClone && !textOverride && NATIVE && NATIVE.speakCustomSegments){
      const parts = speechPartsFor(resultText, wheel || currentWheel(), item);
      if (parts.length){
        stopSpeech();
        speechStarted();
        try { NATIVE.speakCustomSegments(customSegmentPayload(parts, s, text, false)); return; }
        catch(e){ speechFinished(); }
      }
    }
    if (NATIVE && NATIVE.customTts){
      stopSpeech();
      speechStarted();
      try {
        NATIVE.customTts(JSON.stringify({
          provider: s.customTtsProvider || 'openai',
          mode: s.customTtsMode || 'builtin',
          url: url,
          key: s.customTtsKey || '',
          model: s.customTtsModel || '',
          voice: s.customTtsVoice || '',
          format: s.customTtsFormat || 'mp3',
          design: s.customTtsDesign || '',
          refPath: s.customTtsRefPath || '',
          text: text,
          fallback: text,
          speed: s.ttsRate || 1.0
        }));
        return;
      } catch(e){ speechFinished(); }
    }
    speakSystem(text);
    return;
  }
  if (s.ttsEngine === 'system'){
    if (s.systemTtsSegment && !textOverride && NATIVE && NATIVE.speakSystemSegments){
      const parts = speechPartsFor(resultText, wheel || currentWheel(), item);
      if (parts.length){
        stopSpeech();
        speechStarted();
        try {
          NATIVE.speakSystemSegments(JSON.stringify({ parts: parts, rate: s.ttsRate || 1.0, pitch: s.ttsPitch || 1.0, hold: false, fallback: text }));
          return;
        } catch(e){ speechFinished(); }
      }
    }
    if (NATIVE && NATIVE.speakSystemCached){
      stopSpeech();
      speechStarted();
      try {
        NATIVE.speakSystemCached(JSON.stringify({ text: text, fallback: text, rate: s.ttsRate || 1.0, pitch: s.ttsPitch || 1.0, hold: false }));
        return;
      } catch(e){ speechFinished(); }
    }
    speakSystem(text);
    return;
  }
  if (s.ttsEngine === 'sovits'){
    const canDirect = !!(s.sovitsUrl && s.sovitsRef && NATIVE && NATIVE.sovits);
    if (s.sovitsMode === 'direct'){
      if (canDirect){
        stopSpeech();
        speechStarted();
        try { NATIVE.sovits(JSON.stringify(sovitsPayload(text, text))); return; } catch(e){ speechFinished(); }
      }
      speakSystem(text);
      return;
    }
    const t = s.sovitsMode === 'phone' ? 'phone' : 'pc';
    const v = activeVoice(t);
    const url = targetUrl(t);
    const canClone = !!(v && url && NATIVE && NATIVE.cloneSpeak);
    if (canClone){
      stopSpeech();
      speechStarted();
      try { NATIVE.cloneSpeak(JSON.stringify(clonePayload(text, text, t))); return; } catch(e){ speechFinished(); }
    }
    if (canDirect){
      stopSpeech();
      speechStarted();
      try { NATIVE.sovits(JSON.stringify(sovitsPayload(text, text))); return; } catch(e){ speechFinished(); }
    }
    speakSystem(text);
    return;
  }
  speakSystem(text);
}

window.__onSovits = function(ok, msg){
  if (ok){
    if (window.__cloneTestPending){
      window.__cloneTestPending = false;
      toast('正在播放克隆语音');
    }
    return;
  }
  window.__cloneTestPending = false;
  toast(msg || '克隆语音失败，已改用系统语音', 3200);
};

window.__onAudioError = function(msg){
  toast(msg || '音频读取失败', 3200);
};

/* ---------- fonts ---------- */
function fontStack(){
  if (db.settings.fontMode === 'custom' && customFontUrl && customFontFamily){
    return '"' + customFontFamily + '", ' + SYSTEM_FONT;
  }
  return SYSTEM_FONT;
}

function applyFont(){
  const root = document.documentElement;
  const stack = fontStack();
  const active = stack !== SYSTEM_FONT && db.settings.fontScope === 'all';
  root.style.setProperty('--font-wheel', stack);
  root.style.setProperty('--font-ui', active ? stack : SYSTEM_FONT);
  if (typeof invalidateWheelCache === 'function') invalidateWheelCache();
  if (NAV.page === 'wheel' && wheelCtl) drawWheel();
}

function loadFontFace(url, format){
  return new Promise(function(resolve){
    let settled = false;
    function done(ok){
      if (settled) return;
      settled = true;
      if (!ok){
        customFontUrl = null; customFontFormat = null; customFontFamily = null;
      }
      resolve(ok);
    }
    try {
      if (customFontFace && document.fonts && document.fonts.delete){
        try { document.fonts.delete(customFontFace); } catch(e){}
      }
      customFontFace = null;
      customFontUrl = null;
      customFontFormat = null;
      customFontFamily = null;

      if (window.FontFace && document.fonts && document.fonts.add){
        const face = new FontFace('WheelCustom', 'url("' + url + '") format("' + format + '")');
        const timer = setTimeout(function(){ done(false); }, 20000);
        face.load().then(function(loaded){
          clearTimeout(timer);
          if (settled) return;
          try {
            document.fonts.add(loaded);
            customFontFace = loaded;
            customFontFamily = 'WheelCustom';
            customFontUrl = url;
            customFontFormat = format;
            done(true);
          } catch(e){ done(false); }
        }).catch(function(){ clearTimeout(timer); done(false); });
        return;
      }

      const family = 'WheelCustom';
      let st = document.getElementById('customFontStyle');
      if (!st){ st = document.createElement('style'); st.id = 'customFontStyle'; document.head.appendChild(st); }
      st.textContent = '@font-face{font-family:"' + family + '";src:url("' + url + '") format("' + format + '");font-display:block;}';
      customFontFamily = family;
      customFontUrl = url;
      customFontFormat = format;
      setTimeout(function(){ done(true); }, 500);
    } catch(e){ done(false); }
  });
}

async function activateFont(name, url, format, persist){
  const ok = await loadFontFace(url, format);
  if (!ok){
    db.settings.fontMode = 'system';
    db.settings.fontName = '';
    db.settings.fontFormat = '';
    applyFont();
    return false;
  }
  db.settings.fontMode = 'custom';
  db.settings.fontName = name || '自定义字体';
  db.settings.fontFormat = format || 'truetype';
  if (persist) save();
  applyFont();
  return true;
}

async function initFont(){
  if (db.settings.fontMode !== 'custom') { applyFont(); return; }
  if (NATIVE && NATIVE.getFontInfo){
    try {
      const info = JSON.parse(NATIVE.getFontInfo() || '{}');
      if (info && info.exists){
        const url = 'https://wheel.local/font?v=' + encodeURIComponent(String(info.version || Date.now()));
        const ok = await loadFontFace(url, info.format || 'truetype');
        if (ok){
          if (!db.settings.fontName && info.name) db.settings.fontName = info.name;
          applyFont();
          return;
        }
      }
    } catch(e){}
  }
  db.settings.fontMode = 'system';
  db.settings.fontName = '';
  db.settings.fontFormat = '';
  save();
  applyFont();
  toast('自定义字体加载失败，已改用系统字体');
}

function clearCustomFont(){
  if (NATIVE && NATIVE.removeFont){ try { NATIVE.removeFont(); } catch(e){} }
  if (customFontUrl && customFontUrl.indexOf('blob:') === 0){ try { URL.revokeObjectURL(customFontUrl); } catch(e){} }
  if (customFontFace && document.fonts && document.fonts.delete){ try { document.fonts.delete(customFontFace); } catch(e){} }
  customFontFace = null;
  customFontUrl = null; customFontFormat = null; customFontFamily = null;
  const st = document.getElementById('customFontStyle');
  if (st) st.textContent = '';
  db.settings.fontMode = 'system';
  db.settings.fontName = '';
  db.settings.fontFormat = '';
  save();
  applyFont();
  const y = window.scrollY;
  if (NAV.page === 'settings'){ renderSettings(); window.scrollTo(0, y); }
  toast('已恢复系统字体');
}

function pickFontFile(){
  if (NATIVE && NATIVE.pickFont){
    try { NATIVE.pickFont(); return; } catch(e){}
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = async function(){
    const f = input.files && input.files[0];
    if (input.parentNode) input.parentNode.removeChild(input);
    if (!f) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const fmt = ext === 'otf' ? 'opentype' : ext === 'woff' ? 'woff' : ext === 'woff2' ? 'woff2' : 'truetype';
    const url = URL.createObjectURL(f);
    const ok = await activateFont(f.name, url, fmt, true);
    if (!ok){
      URL.revokeObjectURL(url);
      toast('字体加载失败，请换一个 TTF / OTF 文件', 3600);
      return;
    }
    toast('已应用字体：' + f.name, 2300);
    if (NAV.page === 'settings'){
      const y = window.scrollY;
      renderSettings();
      setTimeout(function(){ window.scrollTo(0, y); }, 0);
    } else if (NAV.page === 'wheel') drawWheel();
  };
  input.click();
}

function setFontScope(scope){
  db.settings.fontScope = scope === 'all' ? 'all' : 'wheel';
  save();
  applyFont();
}

window.__onFontPicked = async function(name, format, version, size){
  const y = window.scrollY;
  const url = 'https://wheel.local/font?v=' + encodeURIComponent(String(version || Date.now()));
  const ok = await activateFont(name, url, format, true);
  if (!ok){
    toast('字体加载失败，请换一个 TTF / OTF 文件', 3600);
    return;
  }
  toast('已应用字体：' + (name || '自定义字体') + (size > 20 * 1024 * 1024 ? '（字体较大，如卡顿请换小字体）' : ''), size > 20 * 1024 * 1024 ? 4200 : 2300);
  if (NAV.page === 'settings'){
    renderSettings();
    setTimeout(function(){ window.scrollTo(0, y); }, 0);
  } else if (NAV.page === 'wheel'){
    drawWheel();
  }
};

window.__onFontError = function(msg){
  toast(msg || '字体导入失败', 3600);
};

/* ---------- import / export ---------- */
function parseWheelJson(text){
  let o;
  try { o = JSON.parse(text); }
  catch(e){
    const t = String(text || '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) o = JSON.parse(t.slice(a, b + 1));
    else throw new Error('文件不是有效的 JSON');
  }
  let arr = null;
  if (Array.isArray(o)) arr = o;
  else if (o && Array.isArray(o.wheels)) arr = o.wheels;
  else if (o && Array.isArray(o.data)) arr = o.data;
  else if (o && Array.isArray(o.list)) arr = o.list;
  else if (o && o.title && Array.isArray(o.items)) arr = [o];
  if (!arr) throw new Error('没有找到转盘数据');
  const out = [];
  arr.forEach(function(w){
    if (!w || typeof w !== 'object') return;
    const items = (Array.isArray(w.items) ? w.items : (Array.isArray(w.options) ? w.options : [])).map(function(it){
      if (typeof it === 'string' || typeof it === 'number') return { text: String(it), weight: 100 };
      const t = it.text != null ? it.text : (it.name != null ? it.name : (it.label != null ? it.label : (it.value != null ? it.value : '')));
      const wt = it.weight != null ? it.weight : (it.w != null ? it.w : 100);
      const g = Number(it.group);
      const rec = { text: String(t), weight: Math.max(0, Number(wt) || 0), group: Number.isInteger(g) && g >= 0 ? g : 1 };
      const val = Number(it.value);
      if (it.value != null && it.value !== '' && isFinite(val)) rec.value = val;
      return rec;
    }).filter(function(it){ return it.text.trim() !== ''; });
    const title = String(w.title != null ? w.title : (w.name != null ? w.name : '未命名转盘')).trim();
    if (!title && !items.length) return;
    const rules = (Array.isArray(w.rules) ? w.rules : []).map(function(r){
      return {
        itemText: String(r.itemText != null ? r.itemText : ''),
        delay: (typeof normalizeAutoJumpDelay === 'function' ? normalizeAutoJumpDelay(r.delay) : r.delay),
        targetId: r.targetId != null ? String(r.targetId) : '',
        targetTitle: r.targetTitle != null ? String(r.targetTitle) : '',
        autoSpin: !!r.autoSpin,
        enabled: r.enabled !== false
      };
    });
    const dis = Array.isArray(w.disabled) ? w.disabled.map(Number).filter(function(i){ return Number.isInteger(i) && i >= 0 && i < items.length; }) : [];
    out.push({
      title: title || '未命名转盘',
      items: items,
      category: String(w.category || '未分类').trim() || '未分类',
      avoid: !!w.avoid,
      spinSeconds: (w.spinSeconds != null && isFinite(Number(w.spinSeconds))) ? clamp(Number(w.spinSeconds), 0.5, 30) : null,
      autogoto: w.autogoto !== false,
      script: typeof w.script === 'string' ? w.script : '',
      counts: (w.counts && typeof w.counts === 'object') ? w.counts : {},
      drawn: Array.isArray(w.drawn) ? w.drawn.map(Number).filter(function(i){ return Number.isInteger(i) && i >= 0 && i < items.length; }) : [],
      disabled: dis,
      lastResult: typeof w.lastResult === 'string' ? w.lastResult : '',
      rules: rules
    });
  });
  if (!out.length) throw new Error('没有可导入的转盘');
  out.categories = (o && Array.isArray(o.categories)) ? o.categories.map(function(c){ return String(c || '').trim(); }).filter(Boolean) : [];
  out.settings = (o && o.settings && typeof o.settings === 'object') ? o.settings : null;
  out.globalScript = (o && typeof o.globalScript === 'string') ? o.globalScript : '';
  out.full = !!(o && o.app === 'yunhai-wheel' && Number(o.version) >= 2);
  return out;
}

function importFromText(fileName, text){
  let wheels;
  try { wheels = parseWheelJson(text); }
  catch(e){
    toast('导入失败：' + e.message, 3500);
    openSheet('<h3>导入失败</h3><p class="desc">' + esc(e.message) + '<br><br>支持 .pwh（自动去掉前缀 / 解压 zip 或 gzip 里的 JSON）以及普通 JSON 备份文件。</p><div class="modal-actions"><button class="btn primary" onclick="closeOverlay()">知道了</button></div>', { center: true });
    return;
  }
  const preview = wheels.slice(0, 3).map(function(w){ return esc(w.title) + '（' + w.items.length + ' 项）'; }).join('、');
  const totalItems = wheels.reduce(function(s, w){ return s + w.items.length; }, 0);
  const sameCount = wheels.filter(function(src){
    return db.wheels.some(function(w){ return w.title === src.title; });
  }).length;
  const ov = openSheet(
    '<h3>发现 ' + wheels.length + ' 个转盘</h3>' +
    '<p class="desc">共 ' + totalItems + ' 个选项' + (fileName ? '<br>文件：' + esc(fileName) : '') + '<br>' + preview + (wheels.length > 3 ? ' …' : '') + '</p>' +
    '<label class="line-row" style="border:1px solid var(--line);border-radius:14px;background:#fff;margin-bottom:14px">' +
      '<div class="lr-main"><div class="lr-title" style="font-size:14.5px">跳过同名转盘</div><div class="lr-sub">' +
        (sameCount ? '有 ' + sameCount + ' 个与现有转盘同名，开启后不重复添加' : '已存在同名转盘时不重复添加') +
      '</div></div>' +
      '<span class="switch" id="skipSame"></span>' +
    '</label>' +
    '<div class="modal-actions"><button class="btn" id="impCancel">取消</button><button class="btn primary" id="impOk">导入</button></div>',
    { center: true });
  const skipEl = $('#skipSame', ov);
  skipEl.onclick = function(){ skipEl.classList.toggle('on'); };
  $('#impCancel', ov).onclick = function(){ closeOverlay(true); };
  $('#impOk', ov).onclick = function(){
    const skipSame = skipEl.classList.contains('on');
    closeOverlay(true);
    if (wheels.full && wheels.globalScript) db.globalScript = normalizeScriptPunctuation(wheels.globalScript);
    const existing = {};
    const idByTitle = {};
    db.wheels.forEach(function(w){ existing[w.title] = true; idByTitle[w.title] = w.id; });
    (wheels.categories || []).forEach(function(c){
      const name = normalizeCategoryName(c);
      if (name && db.categories.indexOf(name) < 0) db.categories.push(name);
    });
    let added = 0, skipped = 0;
    const pairs = [];
    wheels.forEach(function(src){
      if (skipSame && existing[src.title]) { skipped++; return; }
      const cat = src.category || '未分类';
      if (db.categories.indexOf(cat) < 0) db.categories.push(cat);
      const w = newWheel(src.title, src.items, cat);
      w.avoid = src.avoid != null ? !!src.avoid : db.settings.defaultAvoid;
      w.spinSeconds = src.spinSeconds != null ? src.spinSeconds : null;
      w.autogoto = src.autogoto !== false;
      w.script = src.script || '';
      w.counts = src.counts || {};
      w.drawn = Array.isArray(src.drawn) ? src.drawn.filter(function(i){ return i >= 0 && i < w.items.length; }) : [];
      w.disabled = Array.isArray(src.disabled) ? src.disabled.filter(function(i){ return i >= 0 && i < w.items.length; }) : [];
      w.lastResult = src.lastResult || '';
      db.wheels.push(w);
      existing[src.title] = true;
      idByTitle[src.title] = w.id;
      pairs.push({ w: w, src: src });
      added++;
    });
    pairs.forEach(function(pair){
      const w = pair.w, src = pair.src;
      w.rules = (src.rules || []).map(function(r){
        let targetId = (r.targetId && getWheel(r.targetId)) ? r.targetId : '';
        if (!targetId && r.targetTitle) targetId = idByTitle[r.targetTitle] || '';
        if (!targetId) return null;
        let itemIndex = 0;
        for (let i = 0; i < w.items.length; i++){ if (w.items[i].text === r.itemText) { itemIndex = i; break; } }
        return {
          itemIndex: itemIndex,
          itemText: r.itemText,
          delay: (typeof normalizeAutoJumpDelay === 'function' ? normalizeAutoJumpDelay(r.delay) : r.delay),
          targetId: targetId,
          autoSpin: !!r.autoSpin,
          enabled: r.enabled !== false
        };
      }).filter(Boolean);
    });
    save();
    NAV.page = 'home';
    NAV.category = 'all';
    NAV.homeLimit = HOME_PAGE;
    NAV.query = '';
    NAV.searchOpen = false;
    render();
    toast('已导入 ' + added + ' 个转盘' + (skipped ? '，跳过 ' + skipped + ' 个同名' : ''), 3200);
  };
}

function buildPwhDataJson(wheels){
  return {
    exportTime: Date.now(),
    version: 5,
    wheels: wheels.map(function(w, i){
      return {
        dbId: i + 1,
        title: w.title,
        items: w.items.map(function(it){
          const o = { text: it.text };
          const wt = Number(it.weight);
          if (isFinite(wt) && wt !== 100) o.weight = wt;
          return o;
        })
      };
    })
  };
}

function buildFullJson(wheels){
  return {
    app: 'yunhai-wheel',
    version: 2,
    exportTime: Date.now(),
    categories: db.categories.slice(),
    globalScript: db.globalScript || '',
    settings: {
      autoGoto: db.settings.autoGoto !== false,
      avoidReset: Number(db.settings.avoidReset) || 0,
      defaultAvoid: !!db.settings.defaultAvoid
    },
    wheels: wheels.map(function(w){
      return {
        title: w.title,
        category: w.category,
        avoid: !!w.avoid,
        spinSeconds: w.spinSeconds != null ? Number(w.spinSeconds) : null,
        autogoto: w.autogoto !== false,
        items: w.items.map(function(it){
          const g = Number(it.group);
          const rec = { text: it.text, weight: Math.max(0, Number(it.weight) || 0), group: Number.isInteger(g) && g >= 0 ? g : 1 };
          if (it.value != null && it.value !== '' && isFinite(Number(it.value))) rec.value = Number(it.value);
          return rec;
        }),
        script: w.script || '',
        rules: (w.rules || []).map(function(r){
          const t = getWheel(r.targetId);
          return {
            itemText: r.itemText,
            delay: r.delay,
            targetId: r.targetId,
            targetTitle: t ? t.title : '',
            autoSpin: !!r.autoSpin,
            enabled: r.enabled !== false
          };
        }),
        counts: w.counts || {},
        drawn: (w.drawn || []).slice(),
        disabled: (w.disabled || []).slice(),
        lastResult: w.lastResult || '',
        createdAt: w.createdAt || 0,
        updatedAt: w.updatedAt || 0
      };
    })
  };
}

function downloadBlobFile(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 5000);
}

async function exportNoNative(kind, payload, name){
  if (kind === 'json'){
    downloadBlobFile(new Blob([payload], { type: 'application/json' }), name);
    toast('已导出 JSON');
    return;
  }
  if (kind === 'pwh'){
    try {
      if (!window.CompressionStream) throw new Error('当前浏览器不支持 gzip');
      const enc = new TextEncoder().encode(payload);
      const stream = new Blob([enc]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      const out = new Uint8Array(3 + buf.length);
      out[0] = 112; out[1] = 119; out[2] = 104;
      out.set(buf, 3);
      downloadBlobFile(new Blob([out], { type: 'application/octet-stream' }), name);
      toast('已导出 PWH');
      return;
    } catch(e){
      toast('当前环境无法生成 PWH，请在 App 内导出');
      return;
    }
  }
  toast('完整版 ZIP 请在 App 内导出');
}

function exportData(){
  const cats = db.categories.slice();
  const selected = new Set(cats);
  let scope = 'all';
  const cards = [
    { k:'json', t:'仅数据 JSON', d:'所有转盘的选项与权重，按大转盘小决定 PWH 内的 JSON 格式' },
    { k:'pwh', t:'仅数据 PWH', d:'按大转盘小决定 PWH 标准封装，可直接被大转盘小决定读取' },
    { k:'zip', t:'完整版 ZIP（2.0）', d:'含跳转、自动指令、避重组、抽取数据、权重和脚本' }
  ].map(function(c){
    return '<button class="line-row link" data-export="' + c.k + '" style="width:100%;text-align:left">' +
      '<div class="lr-main"><div class="lr-title">' + c.t + '</div><div class="lr-sub">' + c.d + '</div></div>' + ICON.download + '</button>';
  }).join('');
  const ov = openSheet(
    '<h3>导出</h3>' +
    '<div class="segmented" id="exportScope" style="margin-bottom:10px">' +
      '<button data-scope="all" class="on">全部</button><button data-scope="cats">指定转盘组</button>' +
    '</div>' +
    '<div id="exportCats" class="export-cats" style="display:none">' +
      cats.map(function(c){ return '<button class="chip on" data-ecat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
    '</div>' +
    '<div class="section-label">导出格式</div>' +
    '<div class="card-box" style="margin-bottom:14px">' + cards + '</div>' +
    '<div class="modal-actions"><button class="btn" id="exportCancel">取消</button></div>',
    { center: true });
  const catBox = $('#exportCats', ov);
  function scopeWheels(){
    if (scope === 'all') return db.wheels.slice();
    return db.wheels.filter(function(w){ return selected.has(w.category); });
  }
  ov.querySelectorAll('#exportScope [data-scope]').forEach(function(b){
    b.onclick = function(){
      scope = b.getAttribute('data-scope');
      ov.querySelectorAll('#exportScope [data-scope]').forEach(function(x){ x.classList.toggle('on', x === b); });
      catBox.style.display = scope === 'cats' ? 'flex' : 'none';
    };
  });
  catBox.addEventListener('click', function(e){
    const b = e.target.closest('[data-ecat]');
    if (!b) return;
    const c = b.getAttribute('data-ecat');
    if (selected.has(c)){ selected.delete(c); b.classList.remove('on'); }
    else { selected.add(c); b.classList.add('on'); }
  });
  ov.querySelectorAll('[data-export]').forEach(function(b){
    b.onclick = function(){
      const kind = b.getAttribute('data-export');
      const wheels = scopeWheels();
      if (!wheels.length){ toast('没有可导出的转盘'); return; }
      let payload, name;
      if (kind === 'zip'){
        payload = JSON.stringify(buildFullJson(wheels));
        name = '云海转盘-完整版2.0_' + dateStamp() + '.zip';
      } else {
        const obj = buildPwhDataJson(wheels);
        payload = kind === 'json' ? JSON.stringify(obj, null, 1) : JSON.stringify(obj);
        name = '云海转盘-数据_' + dateStamp() + (kind === 'json' ? '.json' : '.pwh');
      }
      closeOverlay(true);
      if (NATIVE && NATIVE.exportPackage){
        try { NATIVE.exportPackage(name, kind, payload); } catch(e){ toast('导出失败'); }
      } else {
        exportNoNative(kind, payload, name);
      }
    };
  });
  $('#exportCancel', ov).onclick = function(){ closeOverlay(true); };
}

window.__onTtsCacheEmpty = function(){ toast('还没有可导出的朗读缓存'); };
window.__onImportFile = function(name, text){ importFromText(name, text); };
window.__onImportError = function(msg){ toast('导入失败：' + (msg || '无法读取文件'), 3500); };
window.__onExportResult = function(ok){ toast(ok ? '已保存备份文件' : '保存失败'); };
window.__onTtsCacheEmpty = function(){ toast('还没有可导出的朗读缓存'); };
window.__onImportFile = function(name, text){ importFromText(name, text); };
window.__onImportError = function(msg){ toast('导入失败：' + (msg || '无法读取文件'), 3500); };
window.__onExportResult = function(ok){ toast(ok ? '已保存备份文件' : '保存失败'); };
