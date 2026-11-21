/* ===== 转盘页 · 旋转 / 结果 / 自动跳转 ===== */
'use strict';

let wheelCtl = null;
let wheelSession = { id: null, count: 0 };

function enterWheelSession(id, fromPage){
  if (!wheelSession || wheelSession.id !== id || fromPage === 'home' || fromPage === 'editor'){
    wheelSession = { id: id || null, count: 0 };
  }
}

let jumpCtl = null;

function remainingLabel(w){
  if (!w) return '';
  const n = remainingCount(w);
  return (w.avoid ? '剩余 <b>' + n + '</b> 项' : '共 <b>' + n + '</b> 项');
}

function renderWheel(){
  const w = currentWheel();
  if (!w) { NAV.page = 'home'; renderHome(); return; }
  const n = w.items.length;
  const app = $('#app');
  app.innerHTML =
  '<div class="page wheel-page">' +
    '<div class="wheel-top">' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + ICON.gear + '</button>' +
      '<button class="title-pill" data-action="switch-wheel" aria-label="切换转盘">' + ICON.list + '<span>' + esc(w.title) + '</span></button>' +
      '<button class="icon-btn" data-action="wheel-menu" aria-label="更多">' + ICON.more + '</button>' +
    '</div>' +
    '<div class="wheel-body">' +
      '<div class="remaining" id="remaining">' + remainingLabel(w) + '</div>' +
      (w.items.length > 90 ? '<div class="tiny muted" style="position:absolute;left:22px;top:56px">选项较多，仅显示扇区</div>' : '') +
      '<div class="wheel-stage" id="wheelStage">' +
        '<canvas id="wheelCanvas"></canvas>' +
        '<div class="pointer"><svg viewBox="0 0 50 40"><path d="M8 3h34c4.6 0 7.4 5 5 9L28.4 35.7c-1.5 2.7-5.3 2.7-6.8 0L2.9 12C.6 8 3.4 3 8 3z" fill="#fff"/><path d="M9.5 6h31c2 0 3.2 2.2 2.2 4L26.2 32.7c-.5.9-1.9.9-2.4 0L7.3 10c-1-1.8.2-4 2.2-4z" fill="#FCFCFA"/></svg></div>' +
        '<div class="hub-label">转</div>' +
      '</div>' +
    '</div>' +
    '<div class="wheel-foot">' +
      '<button class="icon-btn" data-action="edit" aria-label="编辑选项">' + ICON.sliders + '</button>' +
      '<button class="spin-btn" data-action="spin">点击旋转</button>' +
      '<button class="icon-btn" data-action="rules" aria-label="自动跳转规则">' + ICON.spark + '</button>' +
    '</div>' +
  '</div>';

  const root = $('#app');
  root.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.getAttribute('data-action');
    if (a === 'spin') spinWheel();
    else if (a === 'edit') go('editor', w.id);
    else if (a === 'rules') go('rules', w.id);
    else if (a === 'settings') go('settings');
    else if (a === 'switch-wheel') openWheelPicker(function(t){ go('wheel', t.id); }, { currentId: w.id });
    else if (a === 'wheel-menu') openWheelMenu();
  };

  mountWheelCanvas();
}

function mountWheelCanvas(){
  const w = currentWheel();
  const stage = $('#wheelStage');
  const canvas = $('#wheelCanvas');
  if (!w || !stage || !canvas) return;
  let size = stage.clientWidth;
  if (!size) size = Math.min(window.innerWidth * 0.88, 430);
  const dpr = Math.min(window.devicePixelRatio || 2, 2.5);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wheelCtl = { canvas: canvas, ctx: ctx, size: size, dpr: dpr, rotation: 0, spinning: false, wheelId: w.id, raf: null, cache: null, cacheDirty: true };
  drawWheel();
  scheduleAvoidReset(w);
  if (!stage.clientWidth){
    requestAnimationFrame(function(){
      if (!wheelCtl || wheelCtl.wheelId !== w.id) return;
      const s2 = stage.clientWidth;
      if (s2 && Math.abs(s2 - wheelCtl.size) > 1) {
        const r = wheelCtl.rotation;
        mountWheelCanvas();
        if (wheelCtl) { wheelCtl.rotation = r; drawWheel(); }
      }
    });
  }
}

function inkFor(hex){
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#2B2723' : '#FFFFFF';
}

function fitLabel(ctx, text, maxW){
  text = String(text || '');
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function drawWheel(){
  const w = currentWheel();
  if (!w || !wheelCtl) return;
  const ctx = wheelCtl.ctx, size = wheelCtl.size;
  const R = size / 2 - 3, cx = size / 2, cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(25,25,30,.13)';
  ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  ctx.fill();
  ctx.restore();

  const items = w.items;
  if (!items.length){
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#F2F2EE'; ctx.fill();
    ctx.setLineDash([6, 7]); ctx.lineWidth = 2; ctx.strokeStyle = '#D9D9D2'; ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#A6A6A0'; ctx.textAlign = 'center';
    ctx.font = '700 15px ' + fontStack();
    ctx.fillText('还没有选项', cx, cy - 6);
    ctx.font = '500 12px ' + fontStack();
    ctx.fillText('点右下角添加', cx, cy + 16);
    ctx.restore();
    return;
  }

  if (!wheelCtl.cache || wheelCtl.cacheDirty) buildWheelCache(w);

  const rot = wheelCtl.rotation * Math.PI / 180;
  if (wheelCtl.cache){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.drawImage(wheelCtl.cache, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 1; ctx.stroke();
}

function paintWheel(ctx, size, w){
  const R = size / 2 - 3, cx = size / 2, cy = size / 2;
  const items = w.items;
  const n = items.length, seg = Math.PI * 2 / n;

  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < n; i++){
    const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
    const drawn = w.avoid && w.drawn.indexOf(i) >= 0;
    const off = drawn || (w.disabled || []).indexOf(i) >= 0;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R - 1, a0, a1);
    ctx.closePath();
    ctx.fillStyle = off ? '#EBEBE6' : PALETTE[i % PALETTE.length];
    ctx.fill();
    if (n <= 46){
      ctx.strokeStyle = 'rgba(255,255,255,.92)';
      ctx.lineWidth = n > 30 ? 0.9 : 1.3;
      ctx.stroke();
    }
  }

  const fs = Math.max(9, Math.min(21, seg * R * 0.60));
  for (let i = 0; i < n && n <= 90; i++){
    const mid = -Math.PI / 2 + (i + 0.5) * seg;
    const drawn = w.avoid && w.drawn.indexOf(i) >= 0;
    const off = drawn || (w.disabled || []).indexOf(i) >= 0;
    ctx.save();
    ctx.rotate(mid);
    ctx.font = '700 ' + fs.toFixed(1) + 'px ' + fontStack();
    ctx.textBaseline = 'middle';
    const ink = off ? '#B4B4AE' : inkFor(PALETTE[i % PALETTE.length]);
    ctx.fillStyle = ink;
    const isLight = ink !== '#FFFFFF';
    ctx.shadowColor = off || isLight ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.18)';
    ctx.shadowBlur = off || isLight ? 0 : 2;
    ctx.shadowOffsetY = off || isLight ? 0 : 1;
    const maxW = R * 0.66;
    const label = fitLabel(ctx, items[i].text, maxW);
    const deg = ((mid * 180 / Math.PI) % 360 + 360) % 360;
    if (deg > 90 && deg < 270){
      ctx.rotate(Math.PI);
      ctx.textAlign = 'left';
      ctx.fillText(label, -(R - 13), 0);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(label, R - 13, 0);
    }
    ctx.restore();
  }
  ctx.restore();
}

function buildWheelCache(w){
  const size = wheelCtl.size;
  const dpr = wheelCtl.dpr || 2;
  const c = document.createElement('canvas');
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  const cctx = c.getContext('2d');
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintWheel(cctx, size, w);
  wheelCtl.cache = c;
  wheelCtl.cacheDirty = false;
}

function invalidateWheelCache(){
  if (wheelCtl) wheelCtl.cacheDirty = true;
}

function updateRemaining(){
  const w = currentWheel();
  const el = $('#remaining');
  if (w && el) el.innerHTML = remainingLabel(w);
}

function uiSpinState(on){
  const b = $('.spin-btn');
  const page = $('.wheel-page');
  if (b){
    b.classList.toggle('disabled', on);
    b.innerHTML = on ? '旋转中…' : '点击旋转';
  }
  if (page) page.classList.toggle('spinning', on);
}

function itemGroup(it){
  const g = Number(it && it.group);
  return Number.isInteger(g) && g >= 0 ? g : 1;
}
function resetExhaustedGroups(w){
  if (!w || !w.avoid) return false;
  const by = {};
  w.items.forEach(function(it, i){
    const g = itemGroup(it);
    if (g <= 0) return;
    if (w.disabled && w.disabled.indexOf(i) >= 0) return;
    if (!by[g]) by[g] = [];
    by[g].push(i);
  });
  let changed = false;
  Object.keys(by).forEach(function(k){
    const arr = by[k];
    if (arr.length && arr.every(function(i){ return w.drawn.indexOf(i) >= 0; })){
      const set = new Set(arr);
      w.drawn = w.drawn.filter(function(i){ return !set.has(i); });
      changed = true;
    }
  });
  return changed;
}

let pendingPicks = {};

function weightedPick(w, pool){
  let total = 0;
  pool.forEach(function(i){ total += Math.max(0, Number(w.items[i].weight) || 0); });
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (total > 0){
    let r = Math.random() * total;
    for (let k = 0; k < pool.length; k++){
      r -= Math.max(0, Number(w.items[pool[k]].weight) || 0);
      if (r <= 0){ pick = pool[k]; break; }
    }
  }
  return pick;
}

function prefetchNextSpin(w){
  if (!w || !w.items || !w.items.length || pendingPicks[w.id]) return;
  if (typeof wheelCtl !== 'undefined' && wheelCtl && wheelCtl.spinning) return;
  if (window.__scriptSpinResolve) return;
  const pool = [];
  for (let i = 0; i < w.items.length; i++){
    if (w.disabled && w.disabled.indexOf(i) >= 0) continue;
    if (w.avoid && w.drawn && w.drawn.indexOf(i) >= 0) continue;
    pool.push(i);
  }
  if (!pool.length) return;
  const idx = weightedPick(w, pool);
  const item = w.items[idx];
  prepareSpeech(w, item);
  const plan = window.__speechPlan;
  if (!plan) return;
  pendingPicks[w.id] = { idx: idx, text: item.text, plan: plan, at: Date.now() };
}

function takePendingPick(w){
  const p = pendingPicks[w.id];
  if (!p) return null;
  delete pendingPicks[w.id];
  const item = w.items[p.idx];
  if (!item || item.text !== p.text) return null;
  if (w.disabled && w.disabled.indexOf(p.idx) >= 0) return null;
  if (w.avoid && w.drawn && w.drawn.indexOf(p.idx) >= 0) return null;
  return p;
}

function spinWheel(){
  const w = currentWheel();
  if (!w || !wheelCtl || wheelCtl.spinning) return;
  const items = w.items;
  if (!items.length){
    toast('先添加几个选项吧');
    go('editor', w.id);
    return;
  }
  if (w.avoid && resetExhaustedGroups(w)){
    save();
    invalidateWheelCache();
    drawWheel();
    updateRemaining();
  }
  const pool = [];
  for (let i = 0; i < items.length; i++){
    if (w.disabled && w.disabled.indexOf(i) >= 0) continue;
    if (!w.avoid || w.drawn.indexOf(i) < 0) pool.push(i);
  }
  if (!pool.length){
    confirmDialog({
      title: '已经抽完啦',
      desc: '「' + esc(w.title) + '」的选项都被抽过了，重置后会重新开始。',
      ok: '重置并继续'
    }).then(function(ok){
      if (!ok) return;
      w.drawn = [];
      save();
      invalidateWheelCache();
      drawWheel();
      updateRemaining();
      setTimeout(spinWheel, 80);
    });
    return;
  }

  let pick;
  const pending = takePendingPick(w);
  if (pending){
    pick = pending.idx;
    window.__speechPlan = pending.plan;
  } else {
    pick = weightedPick(w, pool);
    prepareSpeech(w, items[pick]);
  }

  const n = items.length, seg = 360 / n;
  const jitter = (Math.random() - 0.5) * seg * 0.5;
  const desired = ((360 - ((pick + 0.5) * seg + jitter)) % 360 + 360) % 360;
  const start = wheelCtl.rotation;
  const delta = ((desired - start) % 360 + 360) % 360;
  const explicitSpin = (w.spinSeconds != null && isFinite(Number(w.spinSeconds)) && Number(w.spinSeconds) > 0) ? Number(w.spinSeconds) : null;
  const spinBase = explicitSpin != null ? explicitSpin : db.settings.spinSeconds;
  const turns = Math.max(4, Math.round(spinBase * 1.35));
  const target = start + delta + 360 * turns;
  const effectiveSpin = explicitSpin != null ? explicitSpin : (window.__scriptRunning ? Math.min(1.5, db.settings.spinSeconds) : db.settings.spinSeconds);
  const dur = Math.max(0.5, effectiveSpin) * 1000;
  const t0 = performance.now();

  wheelCtl.spinning = true;
  uiSpinState(true);
  haptic(12);
  cancelJump();
  if (overlayCtl) closeOverlay(true);

  function frame(t){
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 4);
    wheelCtl.rotation = start + (target - start) * e;
    drawWheel();
    if (p < 1){
      wheelCtl.raf = requestAnimationFrame(frame);
    } else {
      wheelCtl.rotation = target % 360;
      wheelCtl.spinning = false;
      drawWheel();
      uiSpinState(false);
      haptic(24);
      finishSpin(w, pick);
    }
  }
  wheelCtl.raf = requestAnimationFrame(frame);
}

let avoidResetTimer = null;
function cancelAvoidReset(){
  if (avoidResetTimer){ clearTimeout(avoidResetTimer); avoidResetTimer = null; }
}
function scheduleAvoidReset(w){
  cancelAvoidReset();
  if (!w || NAV.page !== 'wheel' || !w.avoid) return;
  const delay = Number(db.settings.avoidReset);
  if (!(delay > 0)) return;
  if (remainingCount(w) > 0) return;
  avoidResetTimer = setTimeout(function(){
    avoidResetTimer = null;
    const t = getWheel(w.id);
    if (!t || !t.avoid || remainingCount(t) > 0) return;
    t.drawn = [];
    if (remainingCount(t) <= 0) t.disabled = [];
    t.updatedAt = Date.now();
    save();
    if (currentWheel() && currentWheel().id === t.id){
      invalidateWheelCache();
      drawWheel();
      updateRemaining();
    }
    toast('避重已自动复原');
  }, Math.min(60000, delay * 1000));
}

function finishSpin(w, idx){
  const item = w.items[idx];
  if (!item) return;
  if (!wheelSession || wheelSession.id !== w.id) wheelSession = { id: w.id, count: 0 };
  wheelSession.count += 1;
  if (w.avoid && itemGroup(item) > 0 && w.drawn.indexOf(idx) < 0) w.drawn.push(idx);
  w.counts = w.counts || {};
  w.counts[String(idx)] = (w.counts[String(idx)] || 0) + 1;
  w.lastResult = item.text;
  db.history = db.history || [];
  db.history.unshift({ wheelId: w.id, wheelTitle: w.title, text: item.text, at: Date.now() });
  if (db.history.length > 3000) db.history.length = 3000;
  w.updatedAt = Date.now();
  save();
  updateRemaining();
  invalidateWheelCache();
  drawWheel();
  speakPrepared(w, item);
  showResult(w, idx, item);
  scheduleAvoidReset(w);
  const resolve = window.__scriptSpinResolve;
  window.__scriptSpinResolve = null;
  if (resolve) resolve({ text: item.text, index: idx });
}

function findJumpRule(w, item){
  const rules = w.rules || [];
  for (let i = 0; i < rules.length; i++){
    const r = rules[i];
    if (r.enabled === false) continue;
    if (r.itemText != null && r.itemText !== ''){
      if (r.itemText === item.text) return r;
    } else if (Number(r.itemIndex) === w.items.indexOf(item)) return r;
  }
  return null;
}

function showScriptResult(w, item){
  return new Promise(function(resolve){
    let done = false;
    const finish = function(){
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (window.__scriptResultClose === finish) window.__scriptResultClose = null;
      closeOverlay(true);
      resolve();
    };
    window.__scriptResultClose = finish;
    const ov = openSheet(
      '<div class="script-result-card">' +
        '<div class="result-eyebrow">脚本结果</div>' +
        '<div class="result-text">' + esc(item.text) + '</div>' +
        '<div class="result-sub">' + esc(w.title) + ' · 自动关闭</div>' +
      '</div>',
      { center: true });
    const timer = setTimeout(finish, 1500);
    ov.addEventListener('click', function(e){ if (e.target === ov) finish(); });
  });
}

function autoGotoAllowed(w){
  return db.settings.autoGoto !== false && (!w || w.autogoto !== false);
}

function parseAutoJumpDelay(value){
  let text = String(value == null ? '' : value).trim().replace(/＋/g, '+');
  if (!text) return { ok: true, read: false, seconds: 0, text: '' };
  if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)){
    return { ok: true, read: false, seconds: Math.min(60, Number(text)), text: text };
  }
  const m = text.match(/^\{(rf|readfinish|read_finish)\}(?:\s*\+\s*((?:\d+(?:\.\d*)?|\.\d+)))?$/i);
  if (!m) return { ok: false, read: false, seconds: 0, text: text };
  return { ok: true, read: true, seconds: m[2] ? Math.min(60, Number(m[2])) : 0, text: text };
}

function normalizeAutoJumpDelay(value){
  const p = parseAutoJumpDelay(value);
  if (!p.ok) return 0;
  return p.read || p.text.indexOf('+') >= 0 ? p.text : p.seconds;
}

function autoJumpDelayLabel(value){
  const p = parseAutoJumpDelay(value);
  if (!p.ok) return '无效等待时间';
  if (p.read) return p.seconds > 0 ? '朗读结束 + ' + p.seconds + ' 秒' : '朗读结束';
  return p.seconds > 0 ? p.seconds + ' 秒' : '立刻';
}

function waitUntilAutoGotoFinish(){
  const pending = window.__scriptJumpPromise;
  return Promise.resolve(pending).then(function(){
    return window.__scriptAutoGotoTarget || (currentWheel() ? currentWheel().title : '');
  });
}

function startScriptJump(rule, target){
  const parsed = parseAutoJumpDelay(rule.delay);
  if (!parsed.ok) toast('自动跳转等待时间无效');
  const promise = (async function(){
    if (parsed.read) await waitUntilReadFinish();
    const delay = Math.max(0, Math.min(60000, parsed.seconds * 1000));
    await new Promise(function(resolve){ setTimeout(resolve, delay); });
    const t = getWheel(rule.targetId);
    if (!t) return '';
    window.__autoJumpArriving = true;
    go('wheel', t.id);
    await new Promise(function(resolve){ setTimeout(resolve, 320); });
    window.__scriptAutoGotoTarget = t.title;
    return t.title;
  })();
  window.__scriptJumpPromise = promise;
  return promise;
}

function speechPartsFor(result, wheel, item){
  const tpl = db.settings.ttsTemplate || '抽到 {result}';
  const vars = templateVars(result, wheel || currentWheel());
  vars.value = optionSpeechValue(item, result);
  const parts = [];
  function add(text, category){
    let s = String(text == null ? '' : text);
    if (!s) return;
    s = ttsConvertNumbers(s);
    const last = parts[parts.length - 1];
    if (last && last.category === category) last.text += s;
    else parts.push({ text: s, category: category });
  }
  function addDynamic(value){
    const s = String(value == null ? '' : value);
    const re = /(?:\d+(?:\.\d*)?|\.\d+)/g;
    let last = 0, m;
    while ((m = re.exec(s))){
      if (m.index > last) add(s.slice(last, m.index), 'dynamic');
      add(m[0], 'number');
      last = re.lastIndex;
    }
    if (last < s.length) add(s.slice(last), 'dynamic');
  }
  function addTime(value){
    const s = String(value == null ? '' : value);
    const re = /(\d+)(年|月|日|时|分|秒)?/g;
    let last = 0, m;
    while ((m = re.exec(s))){
      if (m.index > last) add(s.slice(last, m.index), 'time');
      add(m[1], 'number');
      if (m[2]) add(m[2], 'time');
      last = re.lastIndex;
    }
    if (last < s.length) add(s.slice(last), 'time');
  }
  const re = /\{(result|count|last|time|value)\}/g;
  let last = 0, m;
  while ((m = re.exec(tpl))){
    add(tpl.slice(last, m.index), 'template');
    const key = m[1];
    if (key === 'time') addTime(vars.time);
    else if (key === 'count' || key === 'last') addDynamic(vars[key]);
    else addDynamic(key === 'value' ? vars.value : vars.result);
    last = re.lastIndex;
  }
  add(tpl.slice(last), 'template');
  return parts;
}

function customSegmentPayload(parts, s, text, hold){
  return JSON.stringify({
    parts: parts,
    provider: s.customTtsProvider || 'openai',
    mode: s.customTtsMode || 'clone',
    url: String(s.customTtsUrl || '').trim(),
    key: s.customTtsKey || '',
    model: s.customTtsModel || '',
    voice: s.customTtsVoice || '',
    format: s.customTtsFormat || 'mp3',
    design: s.customTtsDesign || '',
    refPath: s.customTtsRefPath || '',
    speed: s.ttsRate || 1.0,
    fallback: text,
    hold: !!hold
  });
}

function truncateSpeechText(text, limit){
  const chars = Array.from(String(text == null ? '' : text));
  if (chars.length <= limit) return chars.join('');
  const head = chars.slice(0, Math.max(1, limit));
  const punct = '，。！？；：、,.!?;:';
  let cut = -1;
  for (let i = head.length - 1; i >= Math.floor(limit * 0.55); i--){
    if (punct.indexOf(head[i]) >= 0){ cut = i + 1; break; }
  }
  return head.slice(0, cut > 0 ? cut : head.length).join('').replace(/\s+$/, '');
}

function speechPlanFor(w, item){
  const fullText = speechText(item.text, w, item);
  let mode = 'full';
  let pSeconds = 0;
  if (!window.__scriptNeedFullRead){
    const rule = autoGotoAllowed(w) ? findJumpRule(w, item) : null;
    const target = rule ? getWheel(rule.targetId) : null;
    if (rule && target){
      const p = parseAutoJumpDelay(rule.delay);
      if (p.ok && !p.read){
        pSeconds = p.seconds;
        if (p.seconds < 1) mode = 'skip';
        else if (p.seconds < 2) mode = 'short';
      }
    }
  }
  let text = fullText;
  if (mode === 'short'){
    const rate = Math.max(0.5, Number(db.settings.ttsRate) || 1);
    const limit = Math.max(1, Math.round(6 + 5 * pSeconds * rate));
    text = truncateSpeechText(fullText, limit);
  }
  return { mode: mode, text: text, prefetch: false };
}

function prepareSpeech(w, item){
  const plan = speechPlanFor(w, item);
  window.__speechPlan = plan;
  const s = db.settings;
  if (!s.ttsEnabled) return;
  if (plan.mode === 'skip'){
    if (NATIVE && NATIVE.resetHeldTts){ try { NATIVE.resetHeldTts(); } catch(e){} }
    return;
  }
  if (!(NATIVE && NATIVE.resetHeldTts && NATIVE.playHeldTts)) return;
  try { NATIVE.resetHeldTts(); } catch(e){}
  plan.prefetch = true;
  if (s.ttsEngine === 'custom'){
    if (!String(s.customTtsUrl || '').trim()){ plan.prefetch = false; return; }
    if (s.customTtsMode === 'clone' && s.customTtsSegmentClone && plan.mode === 'full' && NATIVE.speakCustomSegments){
      const parts = speechPartsFor(item.text, w, item);
      if (parts.length){
        try { NATIVE.speakCustomSegments(customSegmentPayload(parts, s, plan.text, true)); return; }
        catch(e){ plan.prefetch = false; try { NATIVE.resetHeldTts(); } catch(err){} }
      }
    }
    try {
      NATIVE.customTts(JSON.stringify({
        provider: s.customTtsProvider || 'openai',
        mode: s.customTtsMode || 'builtin',
        url: String(s.customTtsUrl || '').trim(),
        key: s.customTtsKey || '',
        model: s.customTtsModel || '',
        voice: s.customTtsVoice || '',
        format: s.customTtsFormat || 'mp3',
        design: s.customTtsDesign || '',
        refPath: s.customTtsRefPath || '',
        text: plan.text,
        fallback: plan.text,
        speed: s.ttsRate || 1.0,
        hold: true
      }));
    } catch(e){ plan.prefetch = false; }
    return;
  }
  if (s.ttsEngine === 'sovits'){
    const canDirect = !!(s.sovitsUrl && s.sovitsRef && NATIVE.sovits);
    if (s.sovitsMode === 'direct'){
      if (canDirect){
        try { NATIVE.sovits(JSON.stringify(Object.assign(sovitsPayload(plan.text, plan.text), { hold: true }))); return; }
        catch(e){ plan.prefetch = false; }
      }
      plan.prefetch = false; return;
    }
    const t = s.sovitsMode === 'phone' ? 'phone' : 'pc';
    const v = activeVoice(t);
    const url = targetUrl(t);
    const canClone = !!(v && url && NATIVE.cloneSpeak);
    if (canClone){
      try { NATIVE.cloneSpeak(JSON.stringify(Object.assign(clonePayload(plan.text, plan.text, t), { hold: true }))); return; }
      catch(e){ plan.prefetch = false; }
    }
    if (canDirect){
      try { NATIVE.sovits(JSON.stringify(Object.assign(sovitsPayload(plan.text, plan.text), { hold: true }))); return; }
      catch(e){ plan.prefetch = false; }
    }
    plan.prefetch = false;
    return;
  }
  if (s.ttsEngine === 'system'){
    if (s.systemTtsSegment && plan.mode === 'full' && NATIVE.speakSystemSegments){
      const parts = speechPartsFor(item.text, w, item);
      if (parts.length){
        try {
          NATIVE.speakSystemSegments(JSON.stringify({
            parts: parts, rate: s.ttsRate || 1.0, pitch: s.ttsPitch || 1.0, hold: true, fallback: plan.text
          }));
          return;
        } catch(e){}
      }
    }
    if (NATIVE.speakSystemCached){
      try {
        NATIVE.speakSystemCached(JSON.stringify({
          text: plan.text, fallback: plan.text, rate: s.ttsRate || 1.0, pitch: s.ttsPitch || 1.0, hold: true
        }));
        return;
      } catch(e){ plan.prefetch = false; }
    }
  }
  plan.prefetch = false;
}

function speakPrepared(w, item){
  const plan = window.__speechPlan;
  window.__speechPlan = null;
  if (!plan || plan.mode === 'skip' || !db.settings.ttsEnabled) return;
  if (plan.prefetch && NATIVE && NATIVE.playHeldTts){
    stopSpeech();
    speechStarted();
    try { NATIVE.playHeldTts(); return; } catch(e){ speechFinished(); }
  }
  speakResult(item.text, w, item, plan.text);
}

function showResult(w, idx, item){
  const script = !!window.__scriptRunning;
  const rule = autoGotoAllowed(w) ? findJumpRule(w, item) : null;
  const target = rule ? getWheel(rule.targetId) : null;
  if (script){
    window.__scriptResultPromise = showScriptResult(w, item);
    if (rule && target) startScriptJump(rule, target);
    return;
  }
  const drawnInfo = w.avoid ? ('已抽 ' + w.drawn.length + ' / ' + w.items.length + ' 项') : ('共 ' + w.items.length + ' 个选项');
  const jumpHtml = (rule && target)
    ? '<div class="jump-hint" id="jumpHint">' + ICON.arrowRight + '<span id="jumpText">即将跳转到「' + esc(target.title) + '」</span><button id="jumpCancel">取消</button></div>'
    : '';
  const len = Array.from(String(item.text)).length;
  const rfs = len <= 4 ? 42 : len <= 6 ? 36 : len <= 9 ? 30 : len <= 14 ? 25 : 21;
  const ov = openSheet(
    '<div class="result-card">' +
      '<div class="result-eyebrow">结果</div>' +
      '<div class="result-text" style="font-size:' + rfs + 'px">' + esc(item.text) + '</div>' +
      '<div class="result-sub">' + esc(w.title) + ' · ' + drawnInfo + '</div>' +
      jumpHtml +
      '<div class="result-actions">' +
        '<button class="btn" id="resDone">完成</button>' +
        '<button class="btn primary" id="resAgain">再抽一次</button>' +
      '</div>' +
    '</div>',
    { onClose: cancelJump }
  );
  $('#resDone', ov).onclick = function(){ closeOverlay(); cancelJump(); };
  $('#resAgain', ov).onclick = function(){ closeOverlay(); cancelJump(); setTimeout(spinWheel, 60); };
  if (rule && target) startJump(rule, target);
}

function startJump(rule, target){
  if (jumpCtl){
    clearTimeout(jumpCtl.timer);
    clearInterval(jumpCtl.interval);
    jumpCtl = null;
  }
  const parsed = parseAutoJumpDelay(rule.delay);
  if (!parsed.ok){ toast('自动跳转等待时间无效'); }
  const ctl = { rule: rule, targetId: target.id, timer: null, interval: null };
  jumpCtl = ctl;
  const finish = function(){
    if (jumpCtl !== ctl) return;
    const t = getWheel(rule.targetId);
    cancelJump();
    if (!t){ toast('目标转盘已删除'); return; }
    closeOverlay(true);
    if (db.settings.ttsEnabled) window.__keepSpeechOnce = true;
    window.__autoJumpArriving = true;
    go('wheel', t.id);
    if (rule.autoSpin) setTimeout(function(){ spinWheel(); }, 550);
  };
  const begin = async function(){
    if (parsed.read){
      const el = $('#jumpText');
      if (el) el.textContent = '等待朗读结束…';
      await waitUntilReadFinish();
    }
    if (jumpCtl !== ctl) return;
    const total = Math.max(0, parsed.seconds) * 1000;
    const t0 = Date.now();
    function tick(){
      if (jumpCtl !== ctl) return;
      const el = $('#jumpText');
      if (!el){ cancelJump(); return; }
      const left = Math.max(0, total - (Date.now() - t0));
      if (total <= 0) el.textContent = '正在跳转到「' + target.title + '」…';
      else el.textContent = (left / 1000).toFixed(1) + ' 秒后跳转到「' + target.title + '」';
    }
    const cancel = $('#jumpCancel');
    if (cancel) cancel.onclick = function(){ cancelJump(); };
    ctl.interval = setInterval(tick, 100);
    ctl.timer = setTimeout(finish, Math.max(80, total));
    tick();
  };
  begin();
}

function cancelJump(){
  if (jumpCtl){
    clearTimeout(jumpCtl.timer);
    clearInterval(jumpCtl.interval);
    jumpCtl = null;
  }
  const h = $('#jumpHint');
  if (h && h.parentNode) h.parentNode.removeChild(h);
}

function renderGroups(){
  const w = currentWheel();
  if (!w){ NAV.page = 'wheel'; renderWheel(); return; }
  if (!w.avoid){ toast('先开启避重模式'); NAV.page = 'wheel'; renderWheel(); return; }
  const by = {};
  w.items.forEach(function(it, i){
    const g = itemGroup(it);
    if (!by[g]) by[g] = [];
    by[g].push({ it: it, i: i });
  });
  const keys = Object.keys(by).map(Number).sort(function(a,b){ return a-b; });
  const cards = keys.map(function(g){
    const rows = by[g].map(function(x){
      return '<div class="line-row" style="gap:10px">' +
        '<div class="lr-main"><div class="lr-title" style="font-size:14px">' + esc(x.it.text) + '</div>' +
        '<div class="lr-sub">第 ' + g + ' 组' + (g === 0 ? ' · 永不避重' : '') + '</div></div>' +
        '<input class="group-num" data-gid="' + x.i + '" type="number" min="0" step="1" value="' + g + '" style="width:68px;text-align:center">' +
      '</div>';
    }).join('');
    return '<div class="section-label">' + (g === 0 ? '第 0 组（永不避重）' : '第 ' + g + ' 组') + ' <span class="tiny muted" style="letter-spacing:0">' + by[g].length + ' 项</span></div>' +
      '<div class="card-box" style="margin-bottom:10px">' + rows + '</div>';
  }).join('');
  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">避重组</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn" data-action="reset" style="padding:10px 14px;font-size:13px">重置已抽</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:6px 4px 12px;line-height:1.6">相同组的选项都抽完后，下一次抽奖自动复原该组；组号 0 表示该选项永不避重。组号按数字从小到大排列。</p>' +
      (cards || '<div class="empty">还没有选项</div>') +
      '<div style="height:16px"></div>' +
    '</div>' +
  '</div>';
  app.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.getAttribute('data-action') === 'back') back();
    else if (el.getAttribute('data-action') === 'reset'){
      w.drawn = [];
      save();
      cancelAvoidReset();
      invalidateWheelCache();
      drawWheel();
      updateRemaining();
      toast('已重置所有已抽选项');
      renderGroups();
    }
  };
  app.onchange = function(e){
    const inp = e.target.closest('[data-gid]');
    if (!inp) return;
    const i = Number(inp.getAttribute('data-gid'));
    let g = Math.floor(Number(inp.value));
    if (!Number.isFinite(g) || g < 0) g = 0;
    if (w.items[i]) w.items[i].group = g;
    save();
    renderGroups();
  };
}

function openWheelMenu(){
  const w = currentWheel();
  if (!w) return;
  const ov = openSheet(
    '<h3>' + esc(w.title) + '</h3><div class="action-list">' +
      (w.avoid ? '<button class="action-item" data-m="groups">' + ICON.tag + ' 避重组<span class="hint">' + (new Set(w.items.map(itemGroup))).size + ' 组</span></button>' : '') +
      '<button class="action-item" data-m="history">' + ICON.clock + ' 抽取记录<span class="hint">' + (db.history || []).filter(function(x){ return x.wheelId === w.id; }).length + ' 条</span></button>' +
      '<button class="action-item" data-m="autogoto">' + ICON.arrowRight + ' 本转盘自动跳转<span class="hint">' + (w.autogoto === false ? '关闭' : '开启') + '</span></button>' +
      '<button class="action-item" data-m="edit">' + ICON.edit + ' 编辑选项与权重</button>' +
      '<button class="action-item" data-m="rules">' + ICON.spark + ' 自动跳转<span class="hint">' + (w.rules || []).length + ' 条</span></button>' +
      '<button class="action-item" data-m="avoid">' + ICON.shuffle + ' 避重模式<span class="hint">' + (w.avoid ? '已开启' : '关闭') + '</span>' +
        '<span class="switch' + (w.avoid ? ' on' : '') + '" style="margin-left:8px;pointer-events:none"></span></button>' +
      '<button class="action-item" data-m="tts">' + (db.settings.ttsEnabled ? ICON.speaker : ICON.speakerOff) + ' 朗读结果<span class="hint">' + (db.settings.ttsEnabled ? (db.settings.ttsEngine === 'sovits' ? '克隆语音' : '系统语音') : '已关闭') + '</span></button>' +
      '<button class="action-item" data-m="reset">' + ICON.refresh + ' 重置已抽<span class="hint">' + w.drawn.length + ' 项</span></button>' +
      '<div class="action-sep"></div>' +
      '<button class="action-item danger" data-m="del">' + ICON.trash + ' 删除转盘</button>' +
    '</div>', {});
  $$('[data-m]', ov).forEach(function(b){
    b.onclick = function(){
      const m = b.getAttribute('data-m');
      if (m === 'groups'){ closeOverlay(true); go('groups', w.id); return; }
    if (m === 'history'){ closeOverlay(true); NAV.historyWheelId = w.id; NAV.historyFrom = 'wheel'; go('history'); return; }
    if (m === 'autogoto'){ w.autogoto = w.autogoto === false; save(); closeOverlay(true); toast(w.autogoto ? '本转盘自动跳转已开启' : '本转盘自动跳转已关闭'); return; }
    if (m === 'edit'){ closeOverlay(true); go('editor', w.id); return; }
      if (m === 'rules'){ closeOverlay(true); go('rules', w.id); return; }
      if (m === 'avoid'){
        w.avoid = !w.avoid;
        if (!w.avoid) w.drawn = [];
        save();
        closeOverlay(true);
        renderWheel();
        toast(w.avoid ? '已开启避重：抽过的选项不再出现' : '已关闭避重');
        return;
      }
      if (m === 'tts'){
        db.settings.ttsEnabled = !db.settings.ttsEnabled;
        save();
        closeOverlay(true);
        openWheelMenu();
        toast(db.settings.ttsEnabled ? '已开启朗读' : '已关闭朗读');
        return;
      }
      if (m === 'reset'){
        w.drawn = [];
        save();
        closeOverlay(true);
        invalidateWheelCache();
        drawWheel();
        updateRemaining();
        scheduleAvoidReset(w);
        toast('已重置，所有选项重新参与');
        return;
      }
      if (m === 'del'){
        closeOverlay(true);
        confirmDialog({ title: '删除「' + w.title + '」？', desc: '转盘和它的跳转规则都会删除，无法恢复。', ok: '删除', danger: true }).then(function(ok){
          if (!ok) return;
          const i = db.wheels.indexOf(w);
          if (i >= 0) db.wheels.splice(i, 1);
          save();
          go('home');
          toast('已删除');
        });
      }
    };
  });
}

window.addEventListener('resize', function(){
  if (NAV.page !== 'wheel' || !wheelCtl) return;
  const r = wheelCtl.rotation;
  mountWheelCanvas();
  if (wheelCtl){ wheelCtl.rotation = r; drawWheel(); }
});
