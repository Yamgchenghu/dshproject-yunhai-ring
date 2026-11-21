/* ===== 新玩法：指尖轮盘 / 摇骰子 ===== */
'use strict';

function renderGames(){
  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">小游戏</div>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:6px 4px 16px;line-height:1.6">不使用转盘的小玩法。</p>' +
      '<div class="game-list">' +
        '<button class="game-card" data-game="fingertip">' +
          '<span class="game-icon">' + ICON.spark + '</span>' +
          '<span class="grow"><span class="game-title">指尖轮盘</span><span class="game-sub">多指按住屏幕，随机选中一只手指</span></span>' +
          ICON.chevRight + '</button>' +
        '<button class="game-card" data-game="dice">' +
          '<span class="game-icon">' + ICON.shuffle + '</span>' +
          '<span class="grow"><span class="game-title">摇骰子</span><span class="game-sub">硬币 / 6 / 10 / 12 / 20 面，1–20 个</span></span>' +
          ICON.chevRight + '</button>' +
        '<button class="game-card" data-game="aitrans">' +
          '<span class="game-icon">' + ICON.spark + '</span>' +
          '<span class="grow"><span class="game-title">AI 翻译器</span><span class="game-sub">8 种 AI 话风；本地或 LLM API</span></span>' +
          ICON.chevRight + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  app.onclick = function(e){
    const act = e.target.closest('[data-action]');
    if (act){ if (act.getAttribute('data-action') === 'back') back(); return; }
    const b = e.target.closest('[data-game]');
    if (!b) return;
    const g = b.getAttribute('data-game');
    if (g === 'fingertip') go('fingertip');
    else if (g === 'dice') go('dice');
    else if (g === 'aitrans') go('aitrans');
  };
}

let fingerState = null;

function stopFingertip(){
  if (!fingerState) return;
  const s = fingerState;
  if (s.stillTimer) clearInterval(s.stillTimer);
  if (s.spinTimer) clearInterval(s.spinTimer);
  fingerState = null;
}

function renderFingertip(){
  stopFingertip();
  const max = Math.max(2, Math.min(10, Number(navigator.maxTouchPoints) || 10));
  const app = $('#app');
  app.innerHTML =
  '<div class="page fun-page finger-page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">指尖轮盘</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn" data-action="reset" style="padding:9px 14px;font-size:13px">重置</button>' +
    '</div>' +
    '<div class="finger-board" id="fingerBoard">' +
      '<div class="finger-hint" id="fingerHint">把 ' + max + ' 只以内手指按在屏幕上<br>保持不动 5 秒后开始随机选择</div>' +
      '<div class="finger-layer" id="fingerLayer"></div>' +
    '</div>' +
    '<div class="fun-foot"><span id="fingerStatus">等待手指…</span><span class="fun-tip">松手即取消</span></div>' +
  '</div>';

  const board = $('#fingerBoard');
  const layer = $('#fingerLayer');
  const hint = $('#fingerHint');
  const status = $('#fingerStatus');
  const s = { points: new Map(), max: max, seq: 0, stillAt: 0, stillTimer: null, spinTimer: null, spinEnd: 0, spinning: false, winner: null };
  fingerState = s;

  function dotFor(p){ return layer.querySelector('[data-pid="' + p.id + '"]'); }
  function createDot(p){
    const el = document.createElement('div');
    el.className = 'finger-dot';
    el.setAttribute('data-pid', p.id);
    el.style.background = p.color;
    el.textContent = p.label;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    layer.appendChild(el);
  }
  function renderDots(){
    s.points.forEach(function(p){
      const el = dotFor(p);
      if (el){ el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
    });
  }
  function clearSpin(){
    if (s.spinTimer){ clearInterval(s.spinTimer); s.spinTimer = null; }
    s.spinning = false;
    s.winner = null;
    layer.querySelectorAll('.finger-dot').forEach(function(el){ el.classList.remove('hot', 'winner'); });
  }
  function stopStill(){
    if (s.stillTimer){ clearInterval(s.stillTimer); s.stillTimer = null; }
  }
  function updateStatus(){
    if (s.points.size === 0){
      hint.style.display = 'block';
      status.textContent = '等待手指…';
      return;
    }
    hint.style.display = s.points.size < 2 ? 'block' : 'none';
    if (s.points.size < 2){ status.textContent = '再放一只手指'; return; }
    if (s.spinning){ status.textContent = '随机选择中…'; return; }
    const left = Math.max(0, s.stillAt - Date.now());
    status.textContent = '保持不动 ' + (left / 1000).toFixed(1) + ' 秒后开始';
  }
  function startSpin(){
    stopStill();
    clearSpin();
    s.spinning = true;
    s.spinEnd = Date.now() + 5000;
    const ids = Array.from(s.points.keys());
    s.spinTimer = setInterval(function(){
      if (!s.points.size){ clearSpin(); updateStatus(); return; }
      const id = ids[Math.floor(Math.random() * ids.length)];
      layer.querySelectorAll('.finger-dot').forEach(function(el){ el.classList.remove('hot'); });
      const el = dotFor(s.points.get(id));
      if (el) el.classList.add('hot');
      status.textContent = '随机选择中…';
      if (Date.now() >= s.spinEnd){
        clearInterval(s.spinTimer); s.spinTimer = null;
        const finalId = Array.from(s.points.keys())[Math.floor(Math.random() * s.points.size)];
        const f = s.points.get(finalId);
        layer.querySelectorAll('.finger-dot').forEach(function(x){ x.classList.remove('hot'); });
        const w = dotFor(f);
        if (w) w.classList.add('winner');
        s.winner = finalId;
        s.spinning = false;
        status.textContent = '选中 ' + f.label + ' 号手指';
        haptic(24);
        if (db.settings.ttsEnabled){ try { speakSystem('选中 ' + f.label + ' 号手指'); } catch(e){} }
      }
    }, 80);
  }
  function resetCountdown(){
    stopStill();
    clearSpin();
    if (s.points.size >= 2){
      s.stillAt = Date.now() + 5000;
      s.stillTimer = setInterval(function(){
        if (s.spinning) return;
        if (Date.now() >= s.stillAt){ startSpin(); return; }
        updateStatus();
      }, 100);
    } else {
      s.stillAt = 0;
    }
    updateStatus();
  }
  function add(e){
    if (s.points.has(e.pointerId)) return;
    if (s.points.size >= s.max){ toast('最多 ' + s.max + ' 只手指'); return; }
    const r = board.getBoundingClientRect();
    const p = {
      id: e.pointerId, label: ++s.seq, color: PALETTE[(s.seq - 1) % PALETTE.length],
      x: e.clientX - r.left, y: e.clientY - r.top
    };
    p.sx = p.x; p.sy = p.y;
    s.points.set(e.pointerId, p);
    createDot(p);
    resetCountdown();
  }
  function move(e){
    const p = s.points.get(e.pointerId);
    if (!p) return;
    const r = board.getBoundingClientRect();
    p.x = e.clientX - r.left;
    p.y = e.clientY - r.top;
    renderDots();
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8){
      p.sx = p.x; p.sy = p.y;
      resetCountdown();
    }
  }
  function remove(e){
    const p = s.points.get(e.pointerId);
    if (!p) return;
    s.points.delete(e.pointerId);
    const el = dotFor(p); if (el) el.remove();
    resetCountdown();
  }
  board.addEventListener('pointerdown', function(e){
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch(err){}
    add(e);
  });
  board.addEventListener('pointermove', function(e){ if (s.points.has(e.pointerId)) move(e); });
  board.addEventListener('pointerup', remove);
  board.addEventListener('pointercancel', remove);
  board.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  app.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.getAttribute('data-action') === 'back') back();
    else if (el.getAttribute('data-action') === 'reset'){
      stopStill(); clearSpin(); s.points.clear(); s.seq = 0; layer.innerHTML = ''; resetCountdown(); toast('已重置');
    }
  };
  updateStatus();
}

/* ---------- 摇骰子 ---------- */
let diceState = { count: 2, sides: 6, values: [], rolling: false };

function stopDice(){
  if (diceState && diceState.timer){ clearInterval(diceState.timer); diceState.timer = null; }
}

function diceFaceLabel(sides, v){
  if (sides === 2) return v === 1 ? '正' : '反';
  return String(v);
}

function renderDice(){
  stopDice();
  const st = diceState;
  if (!Array.isArray(st.values) || st.values.length !== st.count){
    st.values = new Array(st.count).fill(0);
  }
  st.rolling = false;
  const types = [2, 6, 10, 12, 20];
  const app = $('#app');
  app.innerHTML =
  '<div class="page dice-page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">摇骰子</div>' +
    '</div>' +
    '<div class="form-page">' +
      '<div class="section-label">骰子数量</div>' +
      '<div class="card-box"><div class="line-row" style="justify-content:space-between">' +
        '<button class="icon-btn" data-action="minus" aria-label="减少">－</button>' +
        '<div class="dice-count" id="diceCount">' + st.count + '</div>' +
        '<button class="icon-btn" data-action="plus" aria-label="增加">＋</button>' +
      '</div></div>' +
      '<div class="section-label">骰子类型</div>' +
      '<div class="dice-types" id="diceTypes">' +
        types.map(function(n){
          const label = n === 2 ? '硬币' : n + ' 面';
          return '<button class="chip' + (st.sides === n ? ' on' : '') + '" data-sides="' + n + '">' + label + '</button>';
        }).join('') +
      '</div>' +
      '<div class="dice-grid" id="diceGrid"></div>' +
      '<div class="dice-sum" id="diceSum"></div>' +
      '<button class="btn primary block" data-action="roll" id="diceRoll" style="height:56px;font-size:17px;margin-top:6px">摇一摇</button>' +
      '<div style="height:20px"></div>' +
    '</div>' +
  '</div>';

  function paint(){
    const grid = $('#diceGrid');
    let html = '';
    for (let i=0;i<st.count;i++){
      const v = st.values[i] || 0;
      html += '<div class="die' + (st.sides === 2 ? ' coin' : '') + '">' + (v ? diceFaceLabel(st.sides, v) : '?') + '</div>';
    }
    grid.innerHTML = html;
    let sum = 0;
    st.values.forEach(function(v){ sum += v || 0; });
    const sumEl = $('#diceSum');
    if (st.sides === 2){
      const heads = st.values.filter(function(v){ return v === 1; }).length;
      const tails = st.values.filter(function(v){ return v === 2; }).length;
      sumEl.textContent = heads + ' 正 · ' + tails + ' 反';
    } else {
      sumEl.textContent = '合计 ' + sum;
    }
    $('#diceCount').textContent = st.count;
    const roll = $('#diceRoll');
    if (roll){ roll.disabled = st.rolling; roll.textContent = st.rolling ? '摇动中…' : '摇一摇'; }
  }
  function setCount(n){
    if (st.rolling) return;
    st.count = Math.max(1, Math.min(20, n));
    st.values = new Array(st.count).fill(0);
    paint();
  }
  function roll(){
    if (st.rolling) return;
    st.rolling = true;
    let ticks = 0;
    st.timer = setInterval(function(){
      st.values = st.values.map(function(){ return 1 + Math.floor(Math.random() * st.sides); });
      paint();
      ticks++;
      if (ticks >= 10){
        clearInterval(st.timer); st.timer = null;
        st.values = st.values.map(function(){ return 1 + Math.floor(Math.random() * st.sides); });
        st.rolling = false;
        paint();
        haptic(18);
      }
    }, 60);
    paint();
  }
  app.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (el){
      const a = el.getAttribute('data-action');
      if (a === 'back') back();
      else if (a === 'minus') setCount(st.count - 1);
      else if (a === 'plus') setCount(st.count + 1);
      else if (a === 'roll') roll();
      return;
    }
    const b = e.target.closest('[data-sides]');
    if (b){
      if (st.rolling) return;
      st.sides = Number(b.getAttribute('data-sides'));
      st.values = new Array(st.count).fill(0);
      paint();
      $$('#diceTypes .chip').forEach(function(x){ x.classList.toggle('on', x === b); });
    }
  };
  paint();
}
