/* ===== 自动脚本：Python 风格子集 + 转盘 API + 变量统计 ===== */
'use strict';

let scriptLayerEls = {};

function scriptDelay(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function closeScriptResultPopup(){
  if (window.__scriptResultClose){
    const f = window.__scriptResultClose;
    window.__scriptResultClose = null;
    f();
  }
}
const PY_INT_MAX = 2147483647;
function formatPyNumber(n){
  if (Number.isNaN(n)) return 'nan';
  if (!isFinite(n)) return n > 0 ? 'inf' : '-inf';
  if (Number.isInteger(n) && Math.abs(n) <= PY_INT_MAX) return String(n);
  if (Math.abs(n) > PY_INT_MAX) return n.toExponential(7);
  return String(n);
}

function scriptStr(v){
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (Array.isArray(v)) return '[' + v.map(scriptStr).join(', ') + ']';
  if (v instanceof Error) return v.message;
  if (typeof v === 'number') return formatPyNumber(v);
  return String(v);
}

/* ---------- 代码高亮 ---------- */
const HL_KEYWORDS = new Set(['def','if','elif','else','try','except','finally','for','while','from','import','class','True','False','None','and','or','not','in','return','break','continue','raise','pass','as']);
function hlEsc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function hlDepthClass(d){
  const n = ((d - 1) % 3 + 3) % 3;
  return n === 0 ? 'hl-b1' : n === 1 ? 'hl-b2' : 'hl-b3';
}
function highlightScriptCode(code){
  code = String(code || '');
  let out = '', i = 0, depth = 0;
  while (i < code.length){
    const c = code[i];
    if (c === '#'){
      let j = code.indexOf('\n', i);
      if (j < 0) j = code.length;
      out += '<span class="hl-com">' + hlEsc(code.slice(i, j)) + '</span>';
      i = j;
      continue;
    }
    if (c === '"' || c === "'" || c === '“' || c === '”' || c === '‘' || c === '’'){
      const close = c === '“' || c === '”' ? '”' : c === '‘' || c === '’' ? '’' : c;
      let j = i + 1;
      while (j < code.length){
        if (code[j] === '\\' && c !== '“' && c !== '”' && c !== '‘' && c !== '’'){ j += 2; continue; }
        if (code[j] === close){ j++; break; }
        if (code[j] === '\n'){ break; }
        j++;
      }
      out += '<span class="hl-str">' + hlEsc(code.slice(i, j)) + '</span>';
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)){
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      if (j < code.length && (code[j] === 'e' || code[j] === 'E')){
        let k = j + 1;
        if (k < code.length && (code[k] === '+' || code[k] === '-')) k++;
        const d0 = k;
        while (k < code.length && /[0-9]/.test(code[k])) k++;
        if (k > d0) j = k;
      }
      const token = code.slice(i, j);
      out += '<span class="' + (/[.eE]/.test(token) ? 'hl-float' : 'hl-int') + '">' + hlEsc(token) + '</span>';
      i = j;
      continue;
    }
    if (/[A-Za-z_\u4e00-\u9fff]/.test(c)){
      let j = i;
      while (j < code.length && /[A-Za-z0-9_\u4e00-\u9fff]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (HL_KEYWORDS.has(word)){
        out += '<span class="hl-kw">' + hlEsc(word) + '</span>';
      } else if (/^\s*[\(（]/.test(code.slice(j))){
        out += '<span class="hl-fn">' + hlEsc(word) + '</span>';
      } else {
        out += hlEsc(word);
      }
      i = j;
      continue;
    }
    if ('([{（'.indexOf(c) >= 0){
      depth++;
      out += '<span class="' + hlDepthClass(depth) + '">' + hlEsc(c) + '</span>';
      i++;
      continue;
    }
    if (')]}）'.indexOf(c) >= 0){
      const d = depth || 1;
      out += '<span class="' + hlDepthClass(d) + '">' + hlEsc(c) + '</span>';
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    out += hlEsc(c);
    i++;
  }
  return out || ' ';
}

/* ---------- 页面 ---------- */
function renderScriptList(){
  const wheels = db.wheels.slice();
  const written = wheels.filter(function(w){ return (w.script || '').trim(); }).length;
  const rows = wheels.map(function(w, i){
    const code = (w.script || '').trim();
    const lines = code ? code.split(/\r?\n/).filter(function(x){ return x.trim(); }).length : 0;
    return '<button class="line-row link" data-sid="' + esc(w.id) + '" style="width:100%;text-align:left' + (i ? ';border-top:1px solid #F3F3F0' : '') + '">' +
      '<div class="lr-main"><div class="lr-title">' + esc(w.title) + '</div>' +
      '<div class="lr-sub">' + esc(w.category || '未分类') + ' · ' + (code ? lines + ' 行脚本' : '未编写') + '</div></div>' +
      (code ? '<span class="tag">已编写</span>' : '') + ICON.chevRight + '</button>';
  }).join('');
  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">自动脚本</div>' +
      '<div class="spacer"></div>' +
      '<button class="icon-btn" data-action="help" aria-label="API">' + ICON.info + '</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:4px 4px 12px;line-height:1.6">每个转盘一份 Python 风格脚本。点转盘编辑，运行时会自动操作该转盘。</p>' +
      '<div class="section-label">全部转盘 <span class="tiny muted" style="letter-spacing:0">' + written + ' / ' + wheels.length + ' 已编写</span></div>' +
      '<div class="card-box">' + (rows || '<div class="tiny muted" style="padding:14px">还没有转盘</div>') + '</div>' +
      '<div style="height:24px"></div>' +
    '</div>' +
  '</div>';
  app.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (el){
      const a = el.getAttribute('data-action');
      if (a === 'back') back();
      else if (a === 'help') showScriptHelp();
      return;
    }
    const row = e.target.closest('[data-sid]');
    if (!row) return;
    NAV.scriptFrom = 'scripts';
    go('script', row.getAttribute('data-sid'));
  };
}

function renderScript(){
  if (typeof normalizeScriptPunctuation === 'function'){
    const normalized = normalizeScriptPunctuation(db.globalScript || '');
    if (normalized !== db.globalScript){ db.globalScript = normalized; save(); }
  }
  const vars = db.scriptVars || {};
  const varKeys = Object.keys(vars);
  const varHtml = varKeys.length ? varKeys.map(function(k){
    return '<div class="stat-row"><span class="stat-key">' + esc(k) + '</span><span class="stat-val">' + esc(scriptStr(vars[k])) + '</span></div>';
  }).join('') : '<div class="tiny muted" style="padding:8px 2px">还没有变量</div>';

  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">自动脚本</div>' +
      '<div class="spacer"></div>' +
      '<button class="icon-btn" data-action="help" aria-label="API">' + ICON.info + '</button>' +
      '<button class="btn primary" data-action="run" style="padding:10px 16px;font-size:14px">运行</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:4px 4px 12px;line-height:1.6">全局只有一份脚本。使用 <b>ring</b> 或 <b>run()</b> 前必须先 <b>goto("转盘名")</b>；脚本内修改会在结束后全部回退。</p>' +
      '<div class="code-wrap">' +
        '<pre class="code-highlight" id="scriptHighlight" aria-hidden="true"><code id="scriptHighlightCode"></code></pre>' +
        '<textarea id="scriptCode" class="script-code" spellcheck="false" placeholder="' + esc(SCRIPT_EXAMPLE) + '">' + esc(db.globalScript || '') + '</textarea>' +
      '</div>' +
      '<div class="script-hint">' + ICON.info + '<span>支持 def / try / if / for 等；代码区自动缩进、分色高亮。点右上角「运行」开始。</span></div>' +
      '<button class="btn primary block" data-action="run" style="height:54px;margin-top:12px">' + ICON.play + ' 运行脚本</button>' +

      '<div class="section-label">变量统计</div>' +
      '<div class="card-box">' +
        '<div class="stat-head"><span>变量</span><button class="tiny link-btn" data-action="reset-vars">清空</button></div>' +
        varHtml +
      '</div>' +
      '<div style="height:24px"></div>' +
    '</div>' +
  '</div>';

  const ta = $('#scriptCode');
  const pre = $('#scriptHighlight');
  const hcode = $('#scriptHighlightCode');
  function paint(){
    hcode.innerHTML = highlightScriptCode(ta.value);
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  }
  function grow(){ ta.style.height = 'auto'; ta.style.height = Math.min(560, Math.max(220, ta.scrollHeight + 4)) + 'px'; }
  function changed(){
    if (typeof normalizeScriptPunctuation === 'function'){
      const normalized = normalizeScriptPunctuation(ta.value);
      if (normalized !== ta.value){
        const pos = ta.selectionStart;
        ta.value = normalized;
        ta.selectionStart = ta.selectionEnd = pos;
      }
    }
    db.globalScript = ta.value;
    save();
    paint();
    grow();
  }
  ta.addEventListener('input', changed);
  ta.addEventListener('scroll', function(){ pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', function(e){
    if (e.isComposing) return;
    if (e.key === 'Tab'){
      e.preventDefault();
      if (e.shiftKey){
        const pos = ta.selectionStart, lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
        const m = /^ {1,4}/.exec(ta.value.slice(lineStart));
        if (m) ta.setRangeText('', lineStart, lineStart + m[0].length, 'end');
      } else {
        ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end');
      }
      changed();
      paint();
      return;
    }
    if (e.key === 'Enter'){
      e.preventDefault();
      const pos = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
      const line = ta.value.slice(lineStart, pos);
      const indent = (line.match(/^[ \t]*/) || [''])[0];
      const bare = line.replace(/#.*$/, '').replace(/\s+$/, '');
      const extra = /[:：]$/.test(bare) ? '    ' : '';
      ta.setRangeText('\n' + indent + extra, pos, ta.selectionEnd, 'end');
      changed();
      return;
    }
    if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd){
      const pos = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
      const before = ta.value.slice(lineStart, pos);
      if (before.length && /^ +$/.test(before) && before.length % 4 === 0){
        e.preventDefault();
        ta.setRangeText('', pos - 4, pos, 'end');
        changed();
      }
    }
  });
  paint();
  setTimeout(grow, 30);

  app.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.getAttribute('data-action');
    if (a === 'back') back();
    else if (a === 'help') showScriptHelp();
    else if (a === 'run') startGlobalScript();
    else if (a === 'reset-vars'){
      confirmDialog({ title: '清空所有脚本变量？', desc: '变量统计会被重置，脚本代码保留。', ok: '清空', danger: true }).then(function(ok){
        if (!ok) return; db.scriptVars = {}; save(); renderScript(); toast('变量已清空');
      });
    }
  };
}

function startGlobalScript(){
  if (typeof normalizeScriptPunctuation === 'function') db.globalScript = normalizeScriptPunctuation(db.globalScript || '');
  const code = (db.globalScript || '').trim();
  if (!code){ toast('先写一点脚本'); return; }
  save();
  closeOverlay(true);
  go('home');
  setTimeout(function(){ runWheelScript(null, code); }, 320);
}

/* ---------- 运行状态 ---------- */
function scriptStatus(show){
  let el = $('#scriptStatus');
  if (!show){ if (el) el.remove(); return; }
  if (!el){
    el = document.createElement('div');
    el.id = 'scriptStatus';
    el.className = 'script-status';
    el.innerHTML = '<span class="script-dot"></span><span id="scriptStatusText">脚本运行中…</span><button id="scriptStop">停止</button>';
    document.body.appendChild(el);
    $('#scriptStop').onclick = function(){
      window.__scriptAbort = true;
      const t = $('#scriptStatusText'); if (t) t.textContent = '正在停止…';
    };
  }
}

function snapshotScriptState(){
  return JSON.parse(JSON.stringify({
    wheels: db.wheels,
    categories: db.categories,
    history: db.history,
    scriptVars: db.scriptVars,
    settings: db.settings
  }));
}

function restoreScriptState(snap){
  if (!snap) return;
  db.wheels = snap.wheels;
  db.categories = snap.categories;
  db.history = snap.history;
  db.scriptVars = snap.scriptVars || {};
  db.settings = snap.settings;
  scriptRingCache = {};
  if (typeof pendingPicks === 'object') pendingPicks = {};
  window.__speechPlan = null;
  if (NATIVE && NATIVE.resetHeldTts){ try { NATIVE.resetHeldTts(); } catch(e){} }
  if (typeof cancelAvoidReset === 'function') cancelAvoidReset();
  save();
  if (NAV.page === 'wheel' && !getWheel(NAV.wheelId)){
    NAV.wheelId = db.wheels.length ? db.wheels[0].id : null;
  }
  if (!window.__scriptResultClose) closeOverlay(true);
  if (typeof clearScriptShow === 'function') clearScriptShow();
  if (typeof clearDanmaku === 'function') clearDanmaku();
  if (typeof clearTurtleCanvas === 'function') clearTurtleCanvas();
  if (typeof closeAllTk === 'function') closeAllTk();
  if (typeof stopSpeech === 'function') stopSpeech();
  render();
}

async function runWheelScript(w, code){
  if (window.__scriptRunning){ toast('脚本已经在运行'); return; }
  window.__scriptRunning = true;
  window.__scriptAbort = false;
  window.__scriptNeedFullRead = /\b(wait_urf|wait_until_read_finish)\s*\(/.test(String(code || ''));
  if (typeof prefetchNextSpin === 'function') setTimeout(function(){
    if (!window.__scriptRunning) return;
    const m = String(code || '').match(/goto\s*\(\s*["“”']([^"”']+)/);
    const first = m ? db.wheels.find(function(x){ return x.title === m[1]; }) : null;
    prefetchNextSpin(first || currentWheel());
  }, 20);
  closeScriptResultPopup();
  window.__scriptResultPromise = null;
  window.__scriptAutoGotoTarget = '';
  scriptStatus(true);
  clearScriptShow();
  if (typeof clearDanmaku === 'function') clearDanmaku();
  scriptRingCache = {};
  const appSnap = snapshotScriptState();
  if (typeof clearTurtleCanvas === 'function') clearTurtleCanvas();
  if (typeof closeAllTk === 'function') closeAllTk();
  const started = Date.now();

  const ctx = {
    env: {},
    wheel: w || null,
    gotoDone: false,
    steps: 0,
    funcDepth: 0,
    logs: [],
    userName: new Set(),
    check: function(){
      this.steps++;
      if (window.__scriptAbort) throw new Error('脚本已停止');
      if (this.steps > 120000) throw new Error('执行步数过多，已停止');
      if (Date.now() - started > 180000) throw new Error('运行超时，已停止');
    }
  };

  window.__activeScriptCtx = ctx;
  let errorMsg = '';
  let stopped = false;
  try {
    const nodes = parseScript(code);
    ctx.env = makeScriptEnv(ctx);
    await execScriptNodes(nodes, ctx);
    persistScriptVars(ctx);
    if (!ctx.logs.length) toast('脚本运行完成', 2200);
  } catch (e){
    persistScriptVars(ctx);
    const msg = e && e.message ? e.message : String(e);
    if (msg.indexOf('脚本已停止') >= 0) stopped = true;
    else errorMsg = msg;
  } finally {
    window.__activeScriptCtx = null;
    window.__scriptRunning = false;
    window.__scriptAbort = false;
    window.__scriptNeedFullRead = false;
    window.__scriptSpinResolve = null;
    window.__scriptResultPromise = null;
    restoreScriptState(appSnap);
    scriptStatus(false);
    if (stopped) toast('脚本已停止');
    else if (errorMsg) showScriptError(errorMsg);
  }
}

function persistScriptVars(ctx){
  const out = {};
  ctx.userName.forEach(function(k){
    if (k === 'ring' || k === 'goto' || k === 'run' || k === 'show' || k === '_autogoto' || k === '_reset') return;
    const v = ctx.env[k];
    if (typeof v === 'function' || v === undefined) return;
    if (v && (v.__scriptHandle || v.__pyModule || v.__pyTk || v.__pyWidget || v.__pyTurtle || v.__pyResponse || v.__pyFunc || v.__pyRing)) return;
    try { out[k] = JSON.parse(JSON.stringify(v)); } catch(e){ out[k] = scriptStr(v); }
  });
  // 保留之前存在、但本次没有赋值的变量
  Object.keys(db.scriptVars || {}).forEach(function(k){ if (!ctx.userName.has(k) && !(k in out)) out[k] = db.scriptVars[k]; });
  db.scriptVars = out;
  save();
}

function showScriptError(msg){
  openSheet('<h3>脚本出错</h3><p class="desc" style="white-space:pre-wrap">' + esc(msg) + '</p><div class="modal-actions"><button class="btn primary" id="seOk">知道了</button></div>', { center: true });
  const b = $('#seOk'); if (b) b.onclick = function(){ closeOverlay(true); };
}

/* ---------- 环境与 API ---------- */
let scriptRingCache = {};
function scriptRingVarName(name){
  return 'ring_' + String(name || 'wheel').replace(/[^A-Za-z0-9_\u4e00-\u9fff]/g, '_');
}
function ringRefresh(w){
  save();
  if (currentWheel() && currentWheel().id === w.id) refreshWheelNow();
  else if (typeof invalidateWheelCache === 'function') invalidateWheelCache();
}
function getScriptRing(w, ctx, targetEnv){
  if (!w) throw new Error('没有当前转盘');
  const envRef = targetEnv || (ctx && ctx.env) || null;
  let ring = scriptRingCache[w.id];
  if (ring){
    if (envRef) envRef[scriptRingVarName(w.title)] = ring;
    return ring;
  }
  const ringBase = {};
  Object.defineProperty(ringBase, 'unique', {
    get: function(){ return !!w.avoid; },
    set: function(v){ w.avoid = !!v; if (!w.avoid) w.drawn = []; ringRefresh(w); }
  });
  Object.defineProperty(ringBase, 'count', { get: function(){ return w.items.length; } });
  function setSpinTime(v){
    const n = Number(v);
    if (!isFinite(n) || n <= 0) throw new Error('ring.spin_time 需要大于 0 的秒数');
    w.spinSeconds = Math.max(0.5, Math.min(30, n));
    ringRefresh(w);
    return w.spinSeconds;
  }
  Object.defineProperty(ringBase, 'length', {
    get: function(){ return w.items.length; },
    set: function(){ throw new Error('ring.length 只读；请用 ring.spin_time 设置旋转时长'); }
  });
  Object.defineProperty(ringBase, 'spin_time', {
    get: function(){ return w.spinSeconds != null ? w.spinSeconds : db.settings.spinSeconds; },
    set: setSpinTime
  });
  Object.defineProperty(ringBase, 'remaining', { get: function(){ return remainingCount(w); } });
  Object.defineProperty(ringBase, 'title', { get: function(){ return w.title; } });
  Object.defineProperty(ringBase, 'name', { get: function(){ return w.title; } });
  Object.defineProperty(ringBase, 'autogoto', {
    get: function(){ return w.autogoto !== false; },
    set: function(v){ w.autogoto = !(v === false || v === 0 || v === '' || v == null); save(); }
  });
  Object.defineProperty(ringBase, 'items', { get: function(){ return w.items.map(function(i){ return i.text; }); } });
  Object.defineProperty(ringBase, 'result', { get: function(){ return w.lastResult || null; } });
  ringBase.reset = function(){
    w.drawn = []; w.disabled = []; ringRefresh(w); return true;
  };
  ringBase.unable = function(arg){
    scriptDisable(w, arg, true); ringRefresh(w); return w.disabled.length;
  };
  ringBase.enable = function(arg){
    scriptDisable(w, arg, false); ringRefresh(w); return w.disabled.length;
  };
  ringBase.index = function(value){
    const s = String(value);
    return w.items.findIndex(function(it){ return it.text === s; });
  };
  ringBase.set = function(value, value1){
    const next = String(value1 == null ? '' : value1);
    let changed = 0;
    if (typeof value === 'number' && Number.isInteger(value)){
      let i = value < 0 ? value + w.items.length : value;
      if (i >= 0 && i < w.items.length){ w.items[i].text = next; changed = 1; }
    } else {
      const old = String(value);
      w.items.forEach(function(it){ if (it.text === old){ it.text = next; changed++; } });
    }
    if (changed){ w.updatedAt = Date.now(); ringRefresh(w); }
    return changed;
  };
  ring = new Proxy(ringBase, {
    get: function(target, prop, receiver){
      if (typeof prop === 'string' && /^-?\d+$/.test(prop)){
        let i = Number(prop);
        if (i < 0) i += w.items.length;
        return (i >= 0 && i < w.items.length) ? w.items[i].text : undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
    set: function(target, prop, value){
      if (typeof prop === 'string' && /^-?\d+$/.test(prop)){
        let i = Number(prop);
        if (i < 0) i += w.items.length;
        if (i < 0 || i >= w.items.length || !w.items[i]) throw new Error('索引越界：' + prop);
        w.items[i].text = String(value == null ? '' : value);
        w.updatedAt = Date.now();
        ringRefresh(w);
        return true;
      }
      return Reflect.set(target, prop, value);
    }
  });
  ring.__pyRing = true;
  scriptRingCache[w.id] = ring;
  if (envRef) envRef[scriptRingVarName(w.title)] = ring;
  return ring;
}

function makeScriptEnv(ctx){
  function rw(){ return currentWheel() || ctx.wheel; }
  const env = Object.assign({}, db.scriptVars || {});
  Object.keys(env).forEach(function(k){ ctx.userName.add(k); });

  function setUser(name, value){
    env[name] = value;
    if (!(name in BUILTIN_NAMES)) ctx.userName.add(name);
  }

  let ringValue = null;
  Object.defineProperty(env, 'ring', {
    enumerable: true,
    configurable: true,
    get: function(){
      if (!ringValue) throw new Error('先 goto 一个转盘，再使用 ring');
      return ringValue;
    },
    set: function(v){ ringValue = v; }
  });

  env._autogoto = db.settings.autoGoto !== false;
  env._reset = Number(db.settings.avoidReset) || 0;
  env.True = true; env.False = false; env.None = null;
  env.len = function(x){
    if (x == null) throw new Error('len 不能用于空值');
    if (typeof x === 'string' || Array.isArray(x)) return x.length;
    if (typeof x.length === 'number') return x.length;
    if (typeof x === 'object') return Object.keys(x).length;
    throw new Error('len 需要列表、字符串或字典');
  };
  env.str = scriptStr;
  env.int = function(x){
    if (x === true) return 1;
    if (x === false) return 0;
    if (typeof x === 'number'){ if (!isFinite(x)) throw new Error('无法转换成整数'); return Math.trunc(x); }
    const s = String(x).trim();
    if (!/^[+-]?\d+$/.test(s)) throw new Error('无法转换成整数：' + s);
    return parseInt(s, 10);
  };
  env.float = function(x){
    if (x === true) return 1;
    if (x === false) return 0;
    if (typeof x === 'number') return x;
    const s = String(x).trim();
    const v = Number(s);
    if (!isFinite(v)) throw new Error('无法转换成小数：' + s);
    return v;
  };
  env.abs = Math.abs;
  env.min = Math.min;
  env.max = Math.max;
  env.range = function(a,b,c){
    let start=0, stop=a, step=1;
    if (b !== undefined){ start=a; stop=b; step=c===undefined?1:c; }
    if (!step) step=1;
    const out=[];
    if (step>0){ for(let x=start;x<stop && out.length<10000;x+=step) out.push(x); }
    else { for(let x=start;x>stop && out.length<10000;x+=step) out.push(x); }
    return out;
  };
  env.random = function(){ return Math.random(); };
  env.randint = function(a,b){ return Math.floor(Math.random()*(b-a+1))+a; };
  env.print = function(){
    const parts = Array.prototype.slice.call(arguments).map(scriptStr);
    const msg = parts.join(' ');
    ctx.logs.push(msg);
    if (msg) danmakuPush(msg);
  };

  env.show = function(text,x,y){ return scriptShow(String(text == null ? '' : text), Number(x)||20, Number(y)||20, env); };
  env.get_location = function(){ return appGetLocation(); };
  env.help = function(){ return scriptHelpAsync(); };
  env.input = function(prompt){ return scriptInput(prompt == null ? '' : String(prompt)); };
  env.goto = async function(name){
    const target = db.wheels.find(function(x){ return x.title === String(name); });
    if (!target) throw new Error('找不到转盘：' + name);
    closeScriptResultPopup();
    go('wheel', target.id);
    await scriptDelay(260);
    window.__scriptAutoGotoTarget = '';
    ctx.wheel = target;
    ctx.gotoDone = true;
    if (ctx.env) ctx.env.ring = getScriptRing(target, ctx);
    if (typeof prefetchNextSpin === 'function') prefetchNextSpin(target);
    return target.title;
  };
  env.run = async function(){
    if (!ctx.gotoDone || !ctx.wheel) throw new Error('先 goto 一个转盘，再调用 run()');
    const res = await scriptSpinWait(ctx);
    return res ? res.text : null;
  };

  env.wait_until_read_finish = async function(){
    await waitUntilReadFinish();
    return null;
  };
  env.wait_urf = env.wait_until_read_finish;

  env.wait_until_autogo_finish = async function(){
    return await waitUntilAutoGotoFinish();
  };
  env.wait_uaf = env.wait_until_autogo_finish;

  Object.keys(env).forEach(function(k){ if (!BUILTIN_NAMES.has(k)) ctx.userName.add(k); });
  return env;
}

function refreshWheelNow(){
  if (typeof invalidateWheelCache === 'function') invalidateWheelCache();
  if (NAV.page === 'wheel' && typeof wheelCtl !== 'undefined' && wheelCtl){ drawWheel(); updateRemaining(); }
  if (typeof scheduleAvoidReset === 'function') scheduleAvoidReset(currentWheel());
}

function scriptDisable(w, arg, disable){
  if (!w.disabled) w.disabled = [];
  const list = Array.isArray(arg) ? arg : [arg];
  list.forEach(function(v){
    let idx = -1;
    if (typeof v === 'number') idx = v;
    else {
      const s = String(v);
      const n = Number(s);
      if (s.trim() !== '' && Number.isInteger(n)) idx = n;
      else idx = w.items.findIndex(function(it){ return it.text === s; });
    }
    if (idx < 0 || idx >= w.items.length) return;
    if (disable){
      if (w.disabled.indexOf(idx) < 0) w.disabled.push(idx);
    } else {
      w.disabled = w.disabled.filter(function(i){ return i !== idx; });
    }
  });
}

async function scriptSpinWait(ctx){
  const w = currentWheel();
  if (!w) return null;
  if (!wheelCtl){ await scriptDelay(150); }
  if (!wheelCtl) return null;
  while (wheelCtl.spinning){ await scriptDelay(80); }
  const pool = [];
  for (let i=0;i<w.items.length;i++){
    if (w.disabled && w.disabled.indexOf(i)>=0) continue;
    if (!w.avoid || w.drawn.indexOf(i)<0) pool.push(i);
  }
  if (!pool.length){ ctx.logs.push('没有可抽的选项'); return null; }
  const res = await new Promise(function(resolve, reject){
    let done = false;
    const timer = setTimeout(function(){
      if (done) return;
      done = true;
      window.__scriptSpinResolve = null;
      reject(new Error('等待抽奖结果超时'));
    }, 20000);
    window.__scriptSpinResolve = function(r){
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.__scriptSpinResolve = null;
      resolve(r);
    };
    closeScriptResultPopup();
    spinWheel();
  });
  if (window.__scriptJumpPromise){
    const p = window.__scriptJumpPromise;
    window.__scriptJumpPromise = null;
    await p;
  }
  return res;
}

/* ---------- 多行弹幕（print） ---------- */
let danmakuVisible = [];
let danmakuQueue = [];
const DANMAKU_MAX = 5;
const DANMAKU_MS = 2000;

function ensureDanmakuLayer(){
  let layer = document.getElementById('danmakuLayer');
  if (!layer){
    layer = document.createElement('div');
    layer.id = 'danmakuLayer';
    layer.className = 'danmaku-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function clearDanmaku(){
  danmakuVisible.slice().forEach(function(item){ clearTimeout(item.timer); if (item.el.parentNode) item.el.parentNode.removeChild(item.el); });
  danmakuVisible = [];
  danmakuQueue = [];
}

function showDanmakuLine(msg){
  const layer = ensureDanmakuLayer();
  const el = document.createElement('div');
  el.className = 'danmaku-line';
  el.textContent = msg;
  layer.appendChild(el);
  const item = { el: el, timer: null };
  danmakuVisible.push(item);
  item.timer = setTimeout(function(){
    if (el.parentNode) el.parentNode.removeChild(el);
    danmakuVisible = danmakuVisible.filter(function(x){ return x !== item; });
    if (danmakuQueue.length) showDanmakuLine(danmakuQueue.shift());
  }, DANMAKU_MS);
}

function danmakuPush(msg){
  msg = String(msg == null ? '' : msg);
  if (!msg) return;
  if (danmakuVisible.length >= DANMAKU_MAX){
    danmakuQueue.push(msg);
    if (danmakuQueue.length > 100) danmakuQueue.shift();
    return;
  }
  showDanmakuLine(msg);
}

/* ---------- 全屏输入 ---------- */
function scriptInput(prompt){
  return new Promise(function(resolve){
    const old = document.getElementById('scriptInputScreen');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'scriptInputScreen';
    el.className = 'script-input-screen';
    el.innerHTML = '<div class="script-input-top">' +
        '<div style="width:42px;flex:none"></div>' +
        '<div class="script-input-title">输入</div>' +
        '<button class="btn primary" data-i="ok" style="padding:9px 18px;font-size:14px">确定</button>' +
      '</div>' +
      '<div class="script-input-body">' +
        '<div class="script-input-prompt" id="scriptInputPrompt"></div>' +
        '<input id="scriptInputField" class="script-input-field" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<div class="script-input-hint">输入后按回车或「确定」继续</div>' +
      '</div>';
    document.body.appendChild(el);
    const field = $('#scriptInputField');
    $('#scriptInputPrompt').textContent = prompt || '请输入内容';
    let done = false;
    window.__scriptInputOpen = true;
    function finish(v){
      if (done) return;
      done = true;
      window.__scriptInputOpen = false;
      if (el.parentNode) el.parentNode.removeChild(el);
      resolve(v);
    }
    el.onclick = function(e){
      const b = e.target.closest('[data-i]');
      if (!b) return;
      if (b.getAttribute('data-i') === 'ok') finish(field.value);
    };
    field.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ e.preventDefault(); finish(field.value); }
    });
    setTimeout(function(){ try { field.focus(); } catch(e){} }, 120);
  });
}

/* ---------- 定位 / 城市 ---------- */
let locationCallbacks = {};

function appGetLocation(){
  return new Promise(function(resolve){
    const id = 'loc' + Date.now() + Math.random().toString(36).slice(2);
    let done = false;
    function finish(city){
      if (done) return;
      done = true;
      delete locationCallbacks[id];
      resolve(city || null);
    }
    locationCallbacks[id] = finish;
    const timer = setTimeout(function(){ finish(null); }, 30000);
    const old = locationCallbacks[id];
    locationCallbacks[id] = function(city){ clearTimeout(timer); old(city); };
    if (typeof NATIVE !== 'undefined' && NATIVE && typeof NATIVE.getLocation === 'function'){
      try { NATIVE.getLocation(id); } catch(e){ finish(null); }
    } else {
      browserGetLocation().then(finish).catch(function(){ finish(null); });
    }
  });
}

window.__onLocation = function(id, json){
  const cb = locationCallbacks[id];
  if (!cb) return;
  let city = null;
  try {
    const d = JSON.parse(json);
    window.__lastLocation = d;
    if (d && d.ok) city = d.city || d.province || null;
  } catch(e) {}
  cb(city);
};

async function browserGetLocation(){
  if (!navigator.geolocation) return null;
  const pos = await new Promise(function(resolve, reject){
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  });
  const lat = pos.coords.latitude, lng = pos.coords.longitude;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(function(){ ctrl.abort(); }, 8000);
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&zoom=10&accept-language=zh-CN', { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    clearTimeout(timer);
    const d = await r.json();
    const a = d && d.address ? d.address : {};
    return a.city || a.town || a.county || a.state || null;
  } catch(e){ return null; }
}

/* ---------- 富文本 show ---------- */
function ensureScriptLayer(){
  let layer = $('#scriptLayer');
  if (!layer){
    layer = document.createElement('div');
    layer.id = 'scriptLayer';
    layer.className = 'script-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function clearScriptShow(){
  const layer = $('#scriptLayer');
  if (layer) layer.innerHTML = '';
  scriptLayerEls = {};
}

let scriptShowHandles = {};

function scriptShow(text, x, y, env){
  const layer = ensureScriptLayer();
  const key = Math.round(x) + ',' + Math.round(y);
  let h = scriptShowHandles[key];
  if (h && h.el && h.el.parentNode){
    h.text = text;
    h.env = env;
    renderShowHandle(h);
    return h;
  }
  const el = document.createElement('div');
  el.className = 'script-show';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layer.appendChild(el);
  h = {
    __scriptHandle: true,
    el: el,
    text: text,
    env: env,
    deleted: false,
    render: function(){ renderShowHandle(h); }
  };
  Object.defineProperty(h, 'change_str', {
    value: function(s){
      h.text = String(s == null ? '' : s);
      if (!h.deleted) renderShowHandle(h);
      return h;
    }
  });
  Object.defineProperty(h, 'invisible', {
    get: function(){ if (!h.deleted) h.el.style.display = 'none'; return function(){ if (!h.deleted) h.el.style.display = 'none'; }; },
    set: function(v){ if (v && !h.deleted) h.el.style.display = 'none'; }
  });
  Object.defineProperty(h, 'visible', {
    get: function(){ if (!h.deleted) h.el.style.display = ''; return function(){ if (!h.deleted) h.el.style.display = ''; }; },
    set: function(v){ if (v && !h.deleted) h.el.style.display = ''; }
  });
  Object.defineProperty(h, 'delete', {
    get: function(){ removeShowHandle(h); return function(){ removeShowHandle(h); }; },
    set: function(v){ if (v) removeShowHandle(h); }
  });
  scriptShowHandles[key] = h;
  renderShowHandle(h);
  return h;
}

function removeShowHandle(h){
  if (!h || h.deleted) return;
  h.deleted = true;
  if (h.el && h.el.parentNode) h.el.parentNode.removeChild(h.el);
  Object.keys(scriptShowHandles).forEach(function(k){ if (scriptShowHandles[k] === h) delete scriptShowHandles[k]; });
}

function renderShowHandle(h){
  if (!h || h.deleted) return;
  h.el.innerHTML = '';
  const nodes = parseRichText(h.text);
  renderRichNodes(nodes, h.el, '#17171A', h.env || {});
}

function refreshScriptShows(env){
  Object.keys(scriptShowHandles).forEach(function(k){
    const h = scriptShowHandles[k];
    if (!h || h.deleted) return;
    if (env) h.env = env;
    renderShowHandle(h);
  });
}

function clearScriptShow(){
  const layer = $('#scriptLayer');
  if (layer) layer.innerHTML = '';
  scriptShowHandles = {};
  scriptLayerEls = {};
}

function parseRichText(text){
  let i = 0;
  function parse(stop){
    const nodes = [];
    let buf = '';
    while (i < text.length){
      if (text[i] === '<'){
        const m = /^<\s*(\/?)\s*(RET|CIR|color)\b([^>]*)>/i.exec(text.slice(i));
        if (m){
          if (buf){ nodes.push({ type:'text', text:buf }); buf = ''; }
          const closing = !!m[1], tag = m[2].toUpperCase(), attrs = (m[3] || '').trim();
          i += m[0].length;
          if (closing){
            if (stop && tag === stop) return { nodes: nodes, closed: true };
            continue;
          }
          const child = parse(tag);
          nodes.push({ type:'tag', tag:tag, attrs:attrs, children:child.nodes });
          continue;
        }
      }
      buf += text[i++];
    }
    if (buf) nodes.push({ type:'text', text:buf });
    return { nodes: nodes, closed:false };
  }
  return parse(null).nodes;
}

function renderRichNodes(nodes, parent, inheritedColor, env){
  nodes.forEach(function(n){
    if (n.type === 'text'){
      parent.appendChild(document.createTextNode(scriptInterp(n.text, env)));
      return;
    }
    if (n.tag === 'COLOR'){
      const span = document.createElement('span');
      const c = parseScriptColor(n.attrs, '');
      span.style.color = c || inheritedColor;
      renderRichNodes(n.children, span, span.style.color, env);
      parent.appendChild(span);
      return;
    }
    const span = document.createElement('span');
    span.className = 'rt-shape';
    const args = splitTagArgs(n.attrs);
    const style = parseShapeStyle(n.tag, args);
    span.style.background = style.fill;
    span.style.borderRadius = (n.tag === 'CIR') ? '999px' : style.radius + 'px';
    if (style.borderWidth > 0){
      span.style.border = style.borderWidth + 'px solid ' + style.borderColor;
    }
    span.style.padding = '2px 6px';
    renderRichNodes(n.children, span, inheritedColor, env);
    parent.appendChild(span);
  });
}

function scriptInterp(text, env){
  return String(text).replace(/\{([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*(?:\.[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*)*)\}/g, function(m,k){
    if (!env) return m;
    let v = env;
    const parts = k.split('.');
    for (let i = 0; i < parts.length; i++){
      if (v === null || v === undefined) return m;
      v = v[parts[i]];
    }
    return v !== undefined ? scriptStr(v) : m;
  });
}

function splitTagArgs(s){
  const out = [];
  const re = /rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}|-?\d+(?:\.\d+)?|[^\s,]+/g;
  let m;
  while ((m = re.exec(s))) out.push(m[0]);
  return out;
}

function isScriptColor(s){
  if (!s) return false;
  if (/^(rgba?|hsla?)\(/i.test(s)) return true;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return true;
  return /^(transparent|white|black|red|green|blue|yellow|orange|pink|purple|gray|grey)$/i.test(s);
}

function parseScriptColor(s, fallback){
  if (!s) return fallback;
  s = s.trim();
  let m = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,\s/]\s*([\d.]+%?))?\s*\)$/i.exec(s);
  if (m){
    const r = Math.max(0,Math.min(255,Math.round(Number(m[1]))));
    const g = Math.max(0,Math.min(255,Math.round(Number(m[2]))));
    const b = Math.max(0,Math.min(255,Math.round(Number(m[3]))));
    let a = m[4] === undefined ? 1 : Number(String(m[4]).replace('%',''));
    if (String(m[4]||'').endsWith('%')) a = a / 100;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0,Math.min(1,a)) + ')';
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(s) || /^[a-zA-Z]+$/.test(s)) return s;
  return fallback;
}

function parseShapeStyle(tag, args){
  let fill = 'rgba(255,255,255,.92)', borderWidth = 0, borderColor = 'rgba(0,0,0,.2)', radius = 0;
  const list = args.slice();
  if (tag === 'CIR') radius = 999;
  if (list.length && isScriptColor(list[0])){ fill = parseScriptColor(list[0], fill); list.shift(); }
  if (list.length && /^-?\d+(\.\d+)?$/.test(list[0])){ borderWidth = Math.max(0, Number(list.shift())); }
  if (list.length && isScriptColor(list[0])){ borderColor = parseScriptColor(list[0], borderColor); list.shift(); }
  if (tag !== 'CIR' && list.length && /^-?\d+(\.\d+)?$/.test(list[0])){ radius = Math.max(0, Number(list.shift())); }
  return { fill: fill, borderWidth: borderWidth, borderColor: borderColor, radius: radius };
}

/* ---------- 脚本帮助 ---------- */
function scriptHelpAsync(){
  return new Promise(function(resolve){
    let done = false;
    const finish = function(){
      if (done) return;
      done = true;
      window.__scriptHelpDone = null;
      resolve(true);
    };
    showScriptHelp();
    window.__scriptHelpDone = finish;
  });
}

const HELP_PAGES = {
  ring: '<div class="script-help">' +
    '<p><code>ring</code> 指当前转盘，<code>goto()</code> 后自动切换。</p>' +
    '<p class="tiny muted">全局只有一份脚本；访问 <code>ring</code> 或调用 <code>run()</code> 前必须先 <code>goto("转盘名")</code>。运行结束后转盘、设置、抽奖记录和脚本变量全部回退。</p>' +
    '<p><code>r = ring</code> 保存的是转盘引用；跳转后 <code>ring</code> 指向新转盘，<code>r</code> 仍指旧转盘。访问过的转盘还会存为 <code>ring_转盘名</code>。</p>' +
    '<p><code>ring.unique = True/False</code> 避重；<code>ring.reset()</code> 重置已抽与禁用。</p>' +
    '<p><code>ring.unable(3)</code> / <code>ring.unable("火锅")</code> / <code>ring.unable([1,2])</code> 禁用；<code>ring.enable(...)</code> 恢复。</p>' +
    '<p><code>ring.set("火锅","烧烤")</code> 改值；<code>ring[0]="新值"</code> 按下标改；<code>ring.index("火锅")</code> 取索引（找不到 -1）。</p>' +
    '<p><code>ring.result</code> 最近结果；<code>ring.items</code> / <code>len(ring)</code> / <code>ring.remaining</code> / <code>ring.name</code>。</p>' +
    '<p><code>ring.spin_time = 2.5</code> 设置本转盘旋转时长（秒）；<code>ring.length</code> 只读，返回选项数。不设置用全局时长。</p>' +
    '<p><code>ring.autogoto = True/False</code> 本转盘自动跳转；<code>_autogoto = True/False</code> 全局自动跳转。</p>' +
    '<p><code>_reset = 3.0</code> 避重抽完后自动复原的秒数（0 = 不自动）。设置页也可调。</p>' +
    '<p class="tiny muted">脚本内所有修改（转盘、设置、记录、脚本变量）只对本次运行有效，结束后全部恢复。</p>' +
    '<p><code>goto("转盘名称")</code> 跳转；<code>run()</code> 抽一次并返回结果。</p>' +
    '<p><code>wait_until_read_finish()</code> / <code>wait_urf()</code> 等朗读结束；<code>wait_until_autogo_finish()</code> / <code>wait_uaf()</code> 等自动跳转完成并返回目标转盘名。</p>' +
    '<p><code>show(text, x, y)</code> 显示文字，<code>{变量}</code>、<code>{ring.result}</code> 自动更新；返回句柄可 <code>change_str / invisible / visible / delete</code>。</p>' +
    '<p>标签：<code>&lt;RET 填充 边框宽 边框色 圆角&gt;文字&lt;/RET&gt;</code>；<code>&lt;CIR 填充 边框宽 边框色&gt;文字&lt;/CIR&gt;</code>（前三个同 RET，圆角半宽）；<code>&lt;color rgba&gt;文字&lt;/color&gt;</code>。</p>' +
    '</div>',
  python: '<div class="script-help">' +
    '<p>内置 <code>ring / goto / run / show / help / get_location / wait_urf</code>，不需要再 import。</p>' +
    '<p>支持变量、数字、字符串、列表、字典、索引、算术、<code>if/elif/else</code>、<code>for/while</code>、<code>break/continue</code>。</p>' +
    '<p>列表方法：<code>a.append(x)</code>、<code>a.pop()</code> / <code>a.pop(i)</code>、<code>a.remove(x)</code>、<code>a.index(x)</code>（从 0 开始，找不到会报错）。</p>' +
    '<p>字符串：<code>s.split()</code> 按空白拆，<code>s.split(",")</code> 按分隔符拆，<code>s.split(",", 1)</code> 限制次数；空分隔符会报错。</p>' +
    '<p>支持 <code>try / except / else / finally</code>；除以零会抛错，可被捕获。中文括号、引号、逗号、冒号、方括号【】可以直接写，会转成半角；字符串里的内容不改，f-string 花括号内也会转。</p>' +
    '<p>整数超过 21.47 亿时，用 8 位有效数字的科学计数法显示。</p>' +
    '<p>代码区自动缩进；函数名、括号层级、字符串、数字和关键字会分色高亮。</p>' +
    '<p>支持 <code>def 函数名(参数):</code> 和 <code>return</code>；函数名、参数名、变量名可以用中文。不能使用内置名（如 ring、len、time）作为自定义名。</p>' +
    '<p><code>print("文字")</code> 底部提示 2 秒；<code>input("提示")</code> 全屏输入，必须按回车或「确定」继续。</p>' +
    '<p class="tiny muted">def 支持默认参数和关键字参数；暂不支持 class；可用模块见上方标签。</p>' +
    '</div>',
  turtle: '<div class="script-help">' +
    '<p><code>import turtle</code>，直接用应用界面当画布。</p>' +
    '<p><code>forward / backward / right / left / goto / setheading / home</code></p>' +
    '<p><code>penup / pendown / pensize / pencolor / fillcolor / color</code></p>' +
    '<p><code>begin_fill / end_fill / circle / dot / write</code></p>' +
    '<p><code>clear / reset / done</code>；也可以 <code>t = turtle.Turtle()</code> 后 <code>t.forward(100)</code>。</p>' +
    '</div>',
  time: '<div class="script-help">' +
    '<p><code>import time</code></p>' +
    '<p><code>time.sleep(1.5)</code> 等待；<code>time.time()</code> 时间戳；<code>time.strftime("%Y-%m-%d %H:%M:%S")</code>。</p>' +
    '<p><code>time.localtime()</code>、<code>time.ctime()</code>、<code>time.monotonic()</code>。</p>' +
    '</div>',
  random: '<div class="script-help">' +
    '<p><code>import random</code></p>' +
    '<p><code>random.random()</code>、<code>random.randint(1,6)</code>、<code>random.randrange(0,10,2)</code></p>' +
    '<p><code>random.choice(["A","B"])</code>、<code>random.shuffle(list)</code>、<code>random.uniform(0,1)</code>、<code>random.sample(list,2)</code></p>' +
    '</div>',
  request: '<div class="script-help">' +
    '<p><code>import requests</code> 或 <code>import request</code></p>' +
    '<p><code>r = requests.get("https://...")</code><br><code>r = requests.post(url, json={"a":1})</code></p>' +
    '<p>支持 <code>headers={...}</code>、<code>params={...}</code>、<code>data=...</code>、<code>timeout=...</code>。</p>' +
    '<p>结果：<code>r.status_code</code>、<code>r.text</code>、<code>r.json()</code>、<code>r.headers</code>、<code>r.ok</code>。</p>' +
    '</div>',
  tkinter: '<div class="script-help">' +
    '<p><code>import tkinter as tk</code>，在应用内弹出 Tk 子集窗口。</p>' +
    '<p><code>root = tk.Tk()</code>；<code>root.title("标题")</code>；<code>root.geometry("320x220")</code>；<code>root.mainloop()</code>。</p>' +
    '<p><code>tk.Label / tk.Button / tk.Entry / tk.Text / tk.Frame / tk.Canvas</code>，用 <code>.pack()</code> 或 <code>.grid()</code> 布局。</p>' +
    '<p>按钮示例：<code>tk.Button(root, text="关闭", command=root.destroy).pack()</code>。</p>' +
    '<p class="tiny muted">这是 Tk 子集，不是完整桌面 tkinter；按钮 command 可以绑定 def 函数。</p>' +
    '</div>'
};

function showScriptHelp(){
  const tabs = [['ring','ring'],['python','Python'],['turtle','turtle'],['time','time'],['random','random'],['request','request'],['tkinter','tkinter']];
  const tabHtml = tabs.map(function(t, i){ return '<button data-htab="' + t[0] + '" class="' + (i === 0 ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
  const ov = openSheet(
    '<h3>脚本 API</h3>' +
    '<div class="help-tabs" id="helpTabs">' + tabHtml + '</div>' +
    '<div class="help-page" id="helpPage">' + HELP_PAGES.ring + '</div>' +
    '<div class="modal-actions"><button class="btn primary" id="shOk">开始执行</button></div>',
    { center: true });
  const page = ov.querySelector('#helpPage');
  const tabEls = ov.querySelectorAll('[data-htab]');
  tabEls.forEach(function(b){
    b.onclick = function(){
      tabEls.forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      page.innerHTML = HELP_PAGES[b.getAttribute('data-htab')] || '';
      page.scrollTop = 0;
    };
  });
  const ok = ov.querySelector('#shOk'); if (ok) ok.onclick = function(){ closeOverlay(true); };
}

const SCRIPT_EXAMPLE = 'goto("今天吃什么")\n\n# 抽一次，把结果显示在转盘上\nresult = run()\nshow("<CIR><color rgba(30,30,30,1)>结果：{result}</color></CIR>", 24, 120)\n';

const BUILTIN_NAMES = new Set(['ring','goto','run','show','get_location','help','input','wait_until_read_finish','wait_urf','wait_until_autogo_finish','wait_uaf','True','False','None','len','str','int','float','abs','min','max','range','random','randint','print']);
/* ---------- 运行状态 ---------- */
function scriptStatus(show){
  let el = $('#scriptStatus');
  if (!show){ if (el) el.remove(); return; }
  if (!el){
    el = document.createElement('div');
    el.id = 'scriptStatus';
    el.className = 'script-status';
    el.innerHTML = '<span class="script-dot"></span><span id="scriptStatusText">脚本运行中…</span><button id="scriptStop">停止</button>';
    document.body.appendChild(el);
    $('#scriptStop').onclick = function(){
      window.__scriptAbort = true;
      const t = $('#scriptStatusText'); if (t) t.textContent = '正在停止…';
    };
  }
}
