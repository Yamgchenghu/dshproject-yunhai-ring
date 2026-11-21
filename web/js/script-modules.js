/* ===== 脚本模块：time / turtle / requests / tkinter（子集） ===== */
'use strict';

/* ---------- time ---------- */
function pyTimeTuple(ms){
  const d = new Date(ms);
  return {
    tm_year:d.getFullYear(), tm_mon:d.getMonth()+1, tm_mday:d.getDate(),
    tm_hour:d.getHours(), tm_min:d.getMinutes(), tm_sec:d.getSeconds(),
    tm_wday:d.getDay(), tm_yday:0, tm_isdst:0
  };
}
function pyStrftime(fmt, t){
  const d = t && typeof t === 'object' && t.tm_year ? new Date(t.tm_year, t.tm_mon-1, t.tm_mday, t.tm_hour||0, t.tm_min||0, t.tm_sec||0) : new Date();
  const p = function(n){ return n < 10 ? '0' + n : '' + n; };
  return String(fmt == null ? '%Y-%m-%d %H:%M:%S' : fmt).replace(/%[YmdHMSaAbBp]/g, function(m){
    if (m === '%Y') return d.getFullYear();
    if (m === '%m') return p(d.getMonth()+1);
    if (m === '%d') return p(d.getDate());
    if (m === '%H') return p(d.getHours());
    if (m === '%M') return p(d.getMinutes());
    if (m === '%S') return p(d.getSeconds());
    if (m === '%a') return ['日','一','二','三','四','五','六'][d.getDay()];
    if (m === '%A') return ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()];
    if (m === '%b') return (d.getMonth()+1) + '月';
    if (m === '%B') return (d.getMonth()+1) + '月';
    if (m === '%p') return d.getHours() < 12 ? 'AM' : 'PM';
    return m;
  });
}
const timeModule = {
  __pyModule: true,
  sleep: function(sec){ return new Promise(function(r){ setTimeout(r, Math.max(0, Number(sec)||0) * 1000); }); },
  time: function(){ return Date.now() / 1000; },
  monotonic: function(){ return performance.now() / 1000; },
  perf_counter: function(){ return performance.now() / 1000; },
  localtime: function(sec){ return pyTimeTuple(sec === undefined ? Date.now() : Number(sec) * 1000); },
  gmtime: function(sec){ return pyTimeTuple(sec === undefined ? Date.now() : Number(sec) * 1000); },
  strftime: pyStrftime,
  ctime: function(sec){ return new Date(sec === undefined ? Date.now() : Number(sec) * 1000).toLocaleString('zh-CN'); },
  asctime: function(t){ return pyStrftime('%Y-%m-%d %H:%M:%S', t); }
};

/* ---------- turtle ---------- */
let turtleCanvas = null, turtleCtx = null, turtleDefault = null;
function ensureTurtleCanvas(){
  if (turtleCanvas && turtleCanvas.parentNode) return turtleCtx;
  const c = document.createElement('canvas');
  c.className = 'turtle-canvas';
  document.body.appendChild(c);
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  turtleCanvas = c; turtleCtx = ctx;
  return ctx;
}
function clearTurtleCanvas(){
  if (turtleCanvas && turtleCanvas.parentNode) turtleCanvas.parentNode.removeChild(turtleCanvas);
  turtleCanvas = null; turtleCtx = null; turtleDefault = null;
}
function tScreenX(x){ return window.innerWidth / 2 + Number(x); }
function tScreenY(y){ return window.innerHeight / 2 - Number(y); }
function turtleRad(d){ return d * Math.PI / 180; }

function Turtle(){
  ensureTurtleCanvas();
  this.__pyTurtle = true;
  this.x = 0; this.y = 0; this.heading = 0;
  this.pen = true; this.color = '#17171A'; this.fillColor = '#17171A';
  this.width = 2; this.filling = false; this.fillPath = [];
}
Turtle.prototype._moveTo = function(nx, ny){
  const ctx = ensureTurtleCanvas();
  const sx = tScreenX(this.x), sy = tScreenY(this.y);
  const ex = tScreenX(nx), ey = tScreenY(ny);
  if (this.pen){
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  }
  if (this.filling) this.fillPath.push([ex, ey]);
  this.x = nx; this.y = ny;
};
Turtle.prototype.forward = function(d){ const r = turtleRad(this.heading); this._moveTo(this.x + Math.cos(r)*Number(d), this.y + Math.sin(r)*Number(d)); return this; };
Turtle.prototype.backward = function(d){ return this.forward(-Number(d)); };
Turtle.prototype.back = Turtle.prototype.backward;
Turtle.prototype.right = function(a){ this.heading -= Number(a); return this; };
Turtle.prototype.left = function(a){ this.heading += Number(a); return this; };
Turtle.prototype.goto = function(x, y){ this._moveTo(Number(x), Number(y)); return this; };
Turtle.prototype.setpos = Turtle.prototype.goto;
Turtle.prototype.setposition = Turtle.prototype.goto;
Turtle.prototype.setheading = function(a){ this.heading = Number(a); return this; };
Turtle.prototype.seth = Turtle.prototype.setheading;
Turtle.prototype.home = function(){ this.x = 0; this.y = 0; this.heading = 0; return this; };
Turtle.prototype.penup = function(){ this.pen = false; return this; };
Turtle.prototype.pu = Turtle.prototype.penup;
Turtle.prototype.pendown = function(){ this.pen = true; return this; };
Turtle.prototype.pd = Turtle.prototype.pendown;
Turtle.prototype.pensize = function(w){ this.width = Math.max(1, Number(w)); return this; };
Turtle.prototype.width = Turtle.prototype.pensize;
Turtle.prototype.pencolor = function(c){ if (c !== undefined) this.color = String(c); return this; };
Turtle.prototype.fillcolor = function(c){ if (c !== undefined) this.fillColor = String(c); return this; };
Turtle.prototype.color = function(a, b){ if (a !== undefined) this.color = String(a); if (b !== undefined) this.fillColor = String(b); else if (a !== undefined) this.fillColor = String(a); return this; };
Turtle.prototype.begin_fill = function(){ this.filling = true; this.fillPath = [[tScreenX(this.x), tScreenY(this.y)]]; return this; };
Turtle.prototype.end_fill = function(){
  const ctx = ensureTurtleCanvas();
  if (this.filling && this.fillPath.length > 2){
    ctx.fillStyle = this.fillColor;
    ctx.beginPath(); ctx.moveTo(this.fillPath[0][0], this.fillPath[0][1]);
    for (let i=1;i<this.fillPath.length;i++) ctx.lineTo(this.fillPath[i][0], this.fillPath[i][1]);
    ctx.closePath(); ctx.fill();
  }
  this.filling = false; this.fillPath = [];
  return this;
};
Turtle.prototype.circle = function(radius, extent, steps){
  const r = Number(radius), ext = extent === undefined ? 360 : Number(extent);
  if (!r) return this;
  const n = Math.max(12, Number(steps) || Math.ceil(Math.abs(ext) / 4));
  const start = turtleRad(this.heading);
  const cx = this.x - Math.sin(start) * r;
  const cy = this.y + Math.cos(start) * r;
  const a0 = Math.atan2(this.y - cy, this.x - cx);
  const dir = r > 0 ? 1 : -1;
  for (let i=1;i<=n;i++){
    const a = a0 + dir * turtleRad(ext) * i / n;
    this._moveTo(cx + Math.abs(r) * Math.cos(a), cy + Math.abs(r) * Math.sin(a));
  }
  this.heading += ext;
  return this;
};
Turtle.prototype.dot = function(size, color){
  const ctx = ensureTurtleCanvas();
  ctx.fillStyle = color === undefined ? this.color : String(color);
  ctx.beginPath(); ctx.arc(tScreenX(this.x), tScreenY(this.y), Math.max(1, Number(size)||4) / 2, 0, Math.PI*2); ctx.fill();
  return this;
};
Turtle.prototype.write = function(text, font){
  const ctx = ensureTurtleCanvas();
  ctx.fillStyle = this.color;
  const f = Array.isArray(font) ? font[1] + 'px ' + font[0] : '14px sans-serif';
  ctx.font = f;
  ctx.fillText(String(text), tScreenX(this.x), tScreenY(this.y));
  return this;
};
Turtle.prototype.clear = function(){
  if (turtleCtx) turtleCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  return this;
};
Turtle.prototype.reset = function(){ this.clear(); this.x=0; this.y=0; this.heading=0; this.pen=true; return this; };
Turtle.prototype.speed = function(){ return this; };
Turtle.prototype.hideturtle = function(){ return this; };
Turtle.prototype.showturtle = function(){ return this; };
Turtle.prototype.done = function(){ return this; };
Turtle.prototype.xcor = function(){ return this.x; };
Turtle.prototype.ycor = function(){ return this.y; };
Turtle.prototype.heading_ = function(){ return this.heading; };
Turtle.prototype.position = function(){ return [this.x, this.y]; };
Turtle.prototype.pos = Turtle.prototype.position;
Turtle.prototype.isdown = function(){ return this.pen; };

function defaultTurtle(){ if (!turtleDefault) turtleDefault = new Turtle(); return turtleDefault; }
const turtleModule = {
  __pyModule: true,
  Turtle: function(){ return new Turtle(); },
  Screen: function(){ return {
    bgcolor:function(){ return this; }, title:function(){ return this; }, setup:function(){ return this; },
    bye:function(){ return null; }, mainloop:function(){ return null; }, tracer:function(){ return this; }, update:function(){ return null; }
  }; },
  forward:function(d){ return defaultTurtle().forward(d); },
  backward:function(d){ return defaultTurtle().backward(d); },
  right:function(a){ return defaultTurtle().right(a); },
  left:function(a){ return defaultTurtle().left(a); },
  goto:function(x,y){ return defaultTurtle().goto(x,y); },
  setpos:function(x,y){ return defaultTurtle().goto(x,y); },
  setposition:function(x,y){ return defaultTurtle().goto(x,y); },
  setheading:function(a){ return defaultTurtle().setheading(a); },
  seth:function(a){ return defaultTurtle().setheading(a); },
  home:function(){ return defaultTurtle().home(); },
  penup:function(){ return defaultTurtle().penup(); },
  pu:function(){ return defaultTurtle().penup(); },
  pendown:function(){ return defaultTurtle().pendown(); },
  pd:function(){ return defaultTurtle().pendown(); },
  pensize:function(w){ return defaultTurtle().pensize(w); },
  width:function(w){ return defaultTurtle().pensize(w); },
  color:function(a,b){ return defaultTurtle().color(a,b); },
  pencolor:function(c){ return defaultTurtle().pencolor(c); },
  fillcolor:function(c){ return defaultTurtle().fillcolor(c); },
  begin_fill:function(){ return defaultTurtle().begin_fill(); },
  end_fill:function(){ return defaultTurtle().end_fill(); },
  circle:function(r,e,s){ return defaultTurtle().circle(r,e,s); },
  dot:function(s,c){ return defaultTurtle().dot(s,c); },
  write:function(t,f){ return defaultTurtle().write(t,f); },
  clear:function(){ if (turtleCtx) turtleCtx.clearRect(0,0,window.innerWidth,window.innerHeight); return null; },
  reset:function(){ if (turtleDefault) turtleDefault.reset(); else clearTurtleCanvas(); return null; },
  speed:function(){ return null; }, tracer:function(){ return null; }, update:function(){ return null; },
  done:function(){ return null; }, exitonclick:function(){ return null; }, bye:function(){ return null; },
  hideturtle:function(){ return null; }, showturtle:function(){ return null; },
  xcor:function(){ return defaultTurtle().x; }, ycor:function(){ return defaultTurtle().y; },
  position:function(){ return defaultTurtle().position(); }, pos:function(){ return defaultTurtle().position(); },
  heading:function(){ return defaultTurtle().heading; },
  isdown:function(){ return defaultTurtle().pen; }
};

/* ---------- random ---------- */
const randomModule = {
  __pyModule: true,
  random: function(){ return Math.random(); },
  randint: function(a, b){ a = Number(a); b = Number(b); return Math.floor(Math.random() * (b - a + 1)) + a; },
  randrange: function(start, stop, step){
    let a = 0, b = Number(start), s = 1;
    if (stop !== undefined){ a = Number(start); b = Number(stop); s = step === undefined ? 1 : Number(step); }
    if (!s) s = 1;
    const n = Math.max(0, Math.floor((b - a) / s));
    return a + Math.floor(Math.random() * n) * s;
  },
  choice: function(list){
    if (!list || !list.length) throw new Error('choice 不能用于空列表');
    return list[Math.floor(Math.random() * list.length)];
  },
  shuffle: function(list){
    if (!list) return null;
    for (let i = list.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
    return null;
  },
  uniform: function(a, b){ a = Number(a); b = Number(b); return a + Math.random() * (b - a); },
  seed: function(){ return null; },
  sample: function(list, k){
    const a = list.slice(); const out = [];
    k = Math.min(Number(k)||0, a.length);
    for (let i=0;i<k;i++) out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]);
    return out;
  }
};

/* ---------- requests（request 同义） ---------- */
let httpCallbacks = {};
function nativeHttp(payload){
  return new Promise(function(resolve, reject){
    if (typeof NATIVE === 'undefined' || !NATIVE || typeof NATIVE.httpRequest !== 'function'){
      reject(new Error('native http unavailable'));
      return;
    }
    const id = 'h' + Date.now() + Math.random().toString(36).slice(2);
    const timer = setTimeout(function(){ delete httpCallbacks[id]; reject(new Error('请求超时')); }, 25000);
    httpCallbacks[id] = function(err, data){
      clearTimeout(timer); delete httpCallbacks[id];
      if (err) reject(new Error(err)); else resolve(data);
    };
    try { NATIVE.httpRequest(id, JSON.stringify(payload)); } catch(e){ reject(e); }
  });
}
window.__onHttp = function(id, json){
  const cb = httpCallbacks[id];
  if (!cb) return;
  try {
    const d = JSON.parse(json);
    if (d && d.ok) cb(null, d);
    else cb((d && d.error) || '网络请求失败');
  } catch(e){ cb('网络响应解析失败'); }
};

function makeResponse(status, text, headers, url){
  return {
    __pyResponse: true,
    status_code: status,
    status: status,
    text: text == null ? '' : String(text),
    headers: headers || {},
    url: url || '',
    ok: status >= 200 && status < 300,
    json: function(){ return JSON.parse(this.text); },
    raise_for_status: function(){ if (this.status_code >= 400) throw new Error('HTTP ' + this.status_code); return null; }
  };
}

async function pyRequest(method, url, args){
  const kw = pyKw(args);
  let u = String(url);
  const headers = Object.assign({}, kw.headers || {});
  if (kw.params && typeof kw.params === 'object'){
    const q = Object.keys(kw.params).map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(kw.params[k]); }).join('&');
    if (q) u += (u.indexOf('?') >= 0 ? '&' : '?') + q;
  }
  let body = null;
  if (kw.json !== undefined){
    body = JSON.stringify(kw.json);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  } else if (kw.data !== undefined){
    if (typeof kw.data === 'string') body = kw.data;
    else if (kw.data && typeof kw.data === 'object'){
      body = Object.keys(kw.data).map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(kw.data[k]); }).join('&');
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  const payload = { method: method, url: u, headers: headers, body: body, timeout: kw.timeout || 20 };
  try {
    if (typeof NATIVE !== 'undefined' && NATIVE && typeof NATIVE.httpRequest === 'function'){
      const d = await nativeHttp(payload);
      return makeResponse(d.status, d.body, d.headers || {}, u);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(function(){ ctrl.abort(); }, (kw.timeout || 20) * 1000);
    const r = await fetch(u, { method: method, headers: headers, body: body, signal: ctrl.signal });
    clearTimeout(timer);
    const text = await r.text();
    const h = {}; r.headers.forEach(function(v,k){ h[k] = v; });
    return makeResponse(r.status, text, h, u);
  } catch(e){
    throw new Error('请求失败：' + (e && e.message ? e.message : e));
  }
}
const requestsModule = {
  __pyModule: true,
  request: function(method, url){ return pyRequest(String(method).toUpperCase(), url, Array.prototype.slice.call(arguments, 2)); },
  get: function(url){ return pyRequest('GET', url, Array.prototype.slice.call(arguments, 1)); },
  post: function(url){ return pyRequest('POST', url, Array.prototype.slice.call(arguments, 1)); },
  put: function(url){ return pyRequest('PUT', url, Array.prototype.slice.call(arguments, 1)); },
  delete: function(url){ return pyRequest('DELETE', url, Array.prototype.slice.call(arguments, 1)); }
};

function callScriptCallback(cmd){
  try {
    if (typeof cmd === 'function'){ const r = cmd(); if (r && r.catch) r.catch(function(){}); return; }
    if (cmd && cmd.__pyFunc && window.__activeScriptCtx){
      const r = callPyFunction(cmd, [], {}, window.__activeScriptCtx);
      if (r && r.catch) r.catch(function(){});
    }
  } catch(e){ console.error(e); }
}

/* ---------- tkinter（子集，应用内新窗口） ---------- */
let tkWindows = [];
function closeAllTk(){
  tkWindows.slice().forEach(function(w){ try { w.destroy(); } catch(e){} });
  tkWindows = [];
}
function TkWindow(){
  ensureTkLayer();
  const el = document.createElement('div');
  el.className = 'tk-window';
  const bar = document.createElement('div');
  bar.className = 'tk-bar';
  const title = document.createElement('div');
  title.className = 'tk-title'; title.textContent = 'Tk';
  const close = document.createElement('button');
  close.className = 'tk-close'; close.textContent = '×';
  bar.appendChild(title); bar.appendChild(close);
  const body = document.createElement('div');
  body.className = 'tk-body';
  el.appendChild(bar); el.appendChild(body);
  document.body.appendChild(el);
  let closed = false, resolveMain = null;
  const win = {
    __pyTk: true, el: el, body: body, titleEl: title, closed: false,
    title: function(t){ if (t !== undefined) title.textContent = String(t); return win; },
    geometry: function(g){
      if (g !== undefined){
        const m = /^(\d+)x(\d+)/.exec(String(g));
        if (m){ el.style.width = m[1] + 'px'; el.style.height = m[2] + 'px'; }
      }
      return win;
    },
    resizable: function(){ return win; },
    configure: function(){ return win; },
    config: function(){ return win; },
    destroy: function(){
      if (closed) return null;
      closed = true; win.closed = true;
      if (el.parentNode) el.parentNode.removeChild(el);
      tkWindows = tkWindows.filter(function(x){ return x !== win; });
      if (resolveMain){ const r = resolveMain; resolveMain = null; r(); }
      return null;
    },
    quit: function(){ return win.destroy(); },
    mainloop: function(){
      return new Promise(function(resolve){ if (closed) resolve(); else resolveMain = resolve; });
    },
    update: function(){ return null; },
    after: function(ms, fn){ setTimeout(function(){ callScriptCallback(fn); }, Math.max(0, Number(ms)||0)); return null; },
    withdraw: function(){ el.style.display = 'none'; return win; },
    deiconify: function(){ el.style.display = 'flex'; return win; },
    lift: function(){ return win; }
  };
  close.onclick = function(){ win.destroy(); };
  tkWindows.push(win);
  return win;
}
function ensureTkLayer(){
  let l = document.getElementById('tkLayer');
  if (!l){ l = document.createElement('div'); l.id = 'tkLayer'; l.className = 'tk-layer'; document.body.appendChild(l); }
  return l;
}
function tkHost(parent){ return (parent && (parent.body || parent.el)) || ensureTkLayer(); }
function TkWidget(parent, tag, cls){
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  const host = tkHost(parent);
  host.appendChild(el);
  const w = { __pyWidget: true, el: el, parent: parent };
  w.pack = function(){
    const kw = pyKw(Array.prototype.slice.call(arguments));
    el.style.margin = (Number(kw.pady)||0) + 'px ' + (Number(kw.padx)||0) + 'px';
    if (kw.fill === 'x' || kw.fill === 'both') el.style.width = '100%';
    if (kw.fill === 'both') el.style.flex = '1';
    if (kw.side === 'left') el.style.alignSelf = 'flex-start';
    if (kw.side === 'right') el.style.alignSelf = 'flex-end';
    return w;
  };
  w.grid = function(){
    const kw = pyKw(Array.prototype.slice.call(arguments));
    host.style.display = 'grid';
    host.style.gridTemplateColumns = 'auto';
    el.style.gridRow = (Number(kw.row)||0) + 1;
    el.style.gridColumn = (Number(kw.column)||0) + 1;
    return w;
  };
  w.configure = function(){
    const kw = pyKw(Array.prototype.slice.call(arguments));
    if (kw.text !== undefined) el.textContent = String(kw.text);
    if (kw.bg !== undefined) el.style.background = String(kw.bg);
    if (kw.fg !== undefined) el.style.color = String(kw.fg);
    if (kw.state !== undefined) el.disabled = (String(kw.state) === 'disabled');
    return w;
  };
  w.config = w.configure;
  w.destroy = function(){ if (el.parentNode) el.parentNode.removeChild(el); return null; };
  w.pack_info = function(){ return {}; };
  return w;
}
function TkLabel(parent){
  const kw = pyKw(Array.prototype.slice.call(arguments, 1));
  const w = TkWidget(parent, 'div', 'tk-label');
  w.el.textContent = kw.text === undefined ? '' : String(kw.text);
  if (kw.bg) w.el.style.background = String(kw.bg);
  if (kw.fg) w.el.style.color = String(kw.fg);
  return w;
}
function TkButton(parent){
  const kw = pyKw(Array.prototype.slice.call(arguments, 1));
  const w = TkWidget(parent, 'button', 'tk-button');
  w.el.type = 'button';
  w.el.textContent = kw.text === undefined ? '按钮' : String(kw.text);
  if (kw.state === 'disabled') w.el.disabled = true;
  if (typeof kw.command === 'function' || (kw.command && kw.command.__pyFunc)){
    w.el.onclick = function(){ callScriptCallback(kw.command); };
  }
  return w;
}
function TkEntry(parent){
  const kw = pyKw(Array.prototype.slice.call(arguments, 1));
  const w = TkWidget(parent, 'input', 'tk-entry');
  w.el.type = 'text';
  if (kw.width) w.el.style.width = (Number(kw.width) * 9) + 'px';
  w.get = function(){ return w.el.value; };
  w.insert = function(i, s){ w.el.value = w.el.value.slice(0, Number(i)||0) + String(s == null ? '' : s) + w.el.value.slice(Number(i)||0); return null; };
  w.delete = function(){ w.el.value = ''; return null; };
  return w;
}
function TkText(parent){
  const kw = pyKw(Array.prototype.slice.call(arguments, 1));
  const w = TkWidget(parent, 'textarea', 'tk-text');
  if (kw.width) w.el.style.width = (Number(kw.width) * 9) + 'px';
  if (kw.height) w.el.style.height = (Number(kw.height) * 18) + 'px';
  w.get = function(){ return w.el.value; };
  w.insert = function(i, s){ const pos = i === 'end' ? w.el.value.length : (Number(i)||0); w.el.value = w.el.value.slice(0,pos) + String(s == null ? '' : s) + w.el.value.slice(pos); return null; };
  w.delete = function(){ w.el.value = ''; return null; };
  return w;
}
function TkFrame(parent){
  const w = TkWidget(parent, 'div', 'tk-frame');
  w.body = w.el;
  return w;
}
function TkCanvas(parent){
  const kw = pyKw(Array.prototype.slice.call(arguments, 1));
  const w = TkWidget(parent, 'canvas', 'tk-canvas');
  const width = Number(kw.width) || 280, height = Number(kw.height) || 180;
  w.el.width = width; w.el.height = height;
  w.el.style.width = width + 'px'; w.el.style.height = height + 'px';
  const ctx = w.el.getContext('2d');
  w.create_line = function(){
    const a = pyPos(Array.prototype.slice.call(arguments)); const kw2 = pyKw(Array.prototype.slice.call(arguments));
    ctx.strokeStyle = kw2.fill || '#17171A'; ctx.lineWidth = Number(kw2.width) || 1;
    ctx.beginPath(); ctx.moveTo(Number(a[0]), Number(a[1])); ctx.lineTo(Number(a[2]), Number(a[3])); ctx.stroke(); return null;
  };
  w.create_rectangle = function(){
    const a = pyPos(Array.prototype.slice.call(arguments)); const kw2 = pyKw(Array.prototype.slice.call(arguments));
    if (kw2.fill) { ctx.fillStyle = kw2.fill; ctx.fillRect(Number(a[0]),Number(a[1]),Number(a[2])-Number(a[0]),Number(a[3])-Number(a[1])); }
    if (kw2.outline) { ctx.strokeStyle = kw2.outline; ctx.strokeRect(Number(a[0]),Number(a[1]),Number(a[2])-Number(a[0]),Number(a[3])-Number(a[1])); }
    return null;
  };
  w.create_oval = function(){
    const a = pyPos(Array.prototype.slice.call(arguments)); const kw2 = pyKw(Array.prototype.slice.call(arguments));
    ctx.beginPath(); ctx.ellipse((Number(a[0])+Number(a[2]))/2, (Number(a[1])+Number(a[3]))/2, Math.abs(Number(a[2])-Number(a[0]))/2, Math.abs(Number(a[3])-Number(a[1]))/2, 0, 0, Math.PI*2);
    if (kw2.fill){ ctx.fillStyle = kw2.fill; ctx.fill(); }
    if (kw2.outline){ ctx.strokeStyle = kw2.outline; ctx.stroke(); }
    return null;
  };
  w.create_text = function(){
    const a = pyPos(Array.prototype.slice.call(arguments)); const kw2 = pyKw(Array.prototype.slice.call(arguments));
    ctx.fillStyle = kw2.fill || '#17171A'; ctx.font = '14px sans-serif'; ctx.fillText(String(kw2.text || ''), Number(a[0]), Number(a[1])); return null;
  };
  w.delete = function(){ ctx.clearRect(0,0,width,height); return null; };
  return w;
}
function StringVar(){ this.v = ''; }
StringVar.prototype.get = function(){ return this.v; };
StringVar.prototype.set = function(v){ this.v = String(v); return null; };
function IntVar(){ this.v = 0; }
IntVar.prototype.get = function(){ return this.v; };
IntVar.prototype.set = function(v){ this.v = Number(v)||0; return null; };
function TkMessage(){
  const win = TkWindow();
  win.title('提示');
  win.geometry('300x160');
  const kw = pyKw(Array.prototype.slice.call(arguments, 1));
  TkLabel(win, { text: String(arguments[0] == null ? '' : arguments[0]) }).pack();
  TkLabel(win, { text: String(kw.message || '') }).pack();
  TkButton(win, { text: '确定', command: win.destroy }).pack();
  return win;
}
const tkModule = {
  __pyModule: true,
  Tk: TkWindow, Toplevel: TkWindow,
  Label: TkLabel, Button: TkButton, Entry: TkEntry, Text: TkText, Frame: TkFrame, Canvas: TkCanvas,
  StringVar: function(){ return new StringVar(); }, IntVar: function(){ return new IntVar(); },
  messagebox: { showinfo: TkMessage, showerror: TkMessage, showwarning: TkMessage },
  END: 'end', LEFT: 'left', RIGHT: 'right', TOP: 'top', BOTTOM: 'bottom', BOTH: 'both', X: 'x', Y: 'y'
};
tkModule.ttk = { Label: TkLabel, Button: TkButton, Entry: TkEntry, Frame: TkFrame, Canvas: TkCanvas };

function getScriptModule(name){
  if (name === 'time') return timeModule;
  if (name === 'turtle') return turtleModule;
  if (name === 'tkinter') return tkModule;
  if (name === 'tkinter.ttk') return tkModule.ttk;
  if (name === 'requests' || name === 'request') return requestsModule;
  if (name === 'random') return randomModule;
  return null;
}
