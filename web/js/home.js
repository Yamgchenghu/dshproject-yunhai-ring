/* ===== 首页 · 转盘库 ===== */
'use strict';

let pressTimer = null, pressFired = false;

function wheelColors(w){
  let h = 0;
  const s = w.id + w.title;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const out = [];
  for (let i = 0; i < 4; i++) out.push(PALETTE[(h + i * 3) % PALETTE.length]);
  return out;
}

function filteredWheels(){
  const q = NAV.query.trim().toLowerCase();
  return db.wheels.filter(function(w){
    if (NAV.category && NAV.category !== 'all' && w.category !== NAV.category) return false;
    if (!q) return true;
    if (w.title.toLowerCase().indexOf(q) >= 0) return true;
    for (let i = 0; i < w.items.length; i++) if (w.items[i].text.toLowerCase().indexOf(q) >= 0) return true;
    return false;
  });
}

function wheelCardHtml(w){
  const c = wheelColors(w);
  const avoid = w.avoid && remainingCount(w) !== w.items.length
    ? '<span class="tag accent">剩 ' + remainingCount(w) + '</span>' : '';
  return '<div class="wheel-card" data-id="' + esc(w.id) + '">' +
    '<div class="mini-wheel" style="--c1:' + c[0] + ';--c2:' + c[1] + ';--c3:' + c[2] + ';--c4:' + c[3] + '"></div>' +
    '<div class="card-main">' +
      '<div class="card-title">' + esc(w.title) + '</div>' +
      '<div class="card-sub"><span class="tag">' + esc(w.category) + '</span>' + w.items.length + ' 个选项' +
        (w.avoid ? ' · 避重' : '') + avoid + '</div>' +
    '</div>' +
    (NAV.sorting
      ? '<div class="sort-arrows"><button data-action="up" data-id="' + esc(w.id) + '" aria-label="上移">' + ICON.chevUp + '</button>' +
        '<button data-action="down" data-id="' + esc(w.id) + '" aria-label="下移">' + ICON.chevDown + '</button></div>'
      : '<button class="card-play" data-action="play" data-id="' + esc(w.id) + '" aria-label="开始">' + ICON.play + '</button>') +
  '</div>';
}

function homeListHtml(){
  const all = filteredWheels();
  const limit = NAV.homeLimit || HOME_PAGE;
  const list = all.slice(0, limit);
  if (!all.length){
    if (!db.wheels.length){
      return '<div class="empty"><div class="big-wheel"></div><h3>还没有转盘</h3><p>从 .pwh 文件导入，或者新建一个</p>' +
        '<button class="btn primary" data-action="new">＋ 新建转盘</button></div>';
    }
    return '<div class="empty"><div class="big-wheel" style="filter:grayscale(1);opacity:.4"></div><h3>没有找到</h3><p>换个关键词或分类试试</p></div>';
  }
  let html = list.map(wheelCardHtml).join('');
  if (all.length > list.length){
    html += '<button class="load-more" data-action="more">加载更多 <span>' + list.length + ' / ' + all.length + '</span></button>';
  }
  return html;
}

function renderHome(){
  const cats = db.categories.map(function(c){
    const n = db.wheels.filter(function(w){ return w.category === c; }).length;
    if (!n && NAV.category !== c) return '';
    return '<button class="chip' + (NAV.category === c ? ' on' : '') + '" data-action="cat" data-cat="' + esc(c) + '">' + esc(c) +
      (n ? ' <span style="opacity:.5;font-size:12px">' + n + '</span>' : '') + '</button>';
  }).join('');
  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + ICON.gear + '</button>' +
      '<button class="icon-btn" data-action="games" aria-label="小游戏" style="margin-left:6px">' + ICON.game + '</button>' +
      '<div class="spacer"></div>' +
      '<button class="icon-btn" data-action="toggle-search" aria-label="搜索">' + ICON.search + '</button>' +
      '<button class="icon-btn" data-action="home-menu" aria-label="更多">' + ICON.more + '</button>' +
    '</div>' +
    '<div class="home-head">' +
      '<div class="home-title-row"><h1 class="h1">云海转盘</h1><span class="count-pill">' +
        db.wheels.length + ' 个转盘</span></div>' +
      '<div class="chips">' +
        '<button class="chip' + (!NAV.category || NAV.category === 'all' ? ' on' : '') + '" data-action="cat" data-cat="all">全部</button>' +
        cats +
        '<button class="chip add" data-action="categories">＋ 分类</button>' +
      '</div>' +
      (NAV.searchOpen
        ? '<div class="search-wrap">' + ICON.search + '<input id="homeSearch" type="text" placeholder="搜索转盘或选项" value="' + esc(NAV.query) + '"><button class="clear" data-action="clear-search">清除</button></div>'
        : '') +
    '</div>' +
    (NAV.sorting ? '<div class="tiny muted" style="padding:2px 22px 8px">排序模式：用 ↑ ↓ 调整顺序，完成后点右下角「完成」</div>' : '') +
    '<div class="wheel-list" id="wheelList">' + homeListHtml() + '</div>' +
    '<div class="bottom-bar"><div class="inner">' +
      (NAV.sorting
        ? '<button class="btn primary" data-action="done-sort">' + ICON.check + ' 完成排序</button>'
        : '<button class="btn primary" data-action="new">＋ 新建转盘</button>' +
          '<button class="btn" data-action="import">' + ICON.upload + ' 导入文件</button>') +
    '</div></div>' +
  '</div>';

  const root = $('#app');
  $$('.wheel-card', root).forEach(function(card){
    card.addEventListener('pointerdown', function(e){
      if (e.target.closest('[data-action]')) return;
      pressFired = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function(){
        pressFired = true;
        haptic(16);
        openLibraryWheelMenu(card.getAttribute('data-id'));
      }, 520);
    });
    ['pointerup','pointercancel','pointerleave','pointermove'].forEach(function(ev){
      card.addEventListener(ev, function(){ clearTimeout(pressTimer); });
    });
    card.addEventListener('click', function(e){
      if (e.target.closest('[data-action]')) return;
      if (pressFired) { pressFired = false; return; }
      go('wheel', card.getAttribute('data-id'));
    });
  });

  root.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.getAttribute('data-action');
    if (a === 'cat'){
      NAV.category = el.getAttribute('data-cat');
      NAV.homeLimit = HOME_PAGE;
      renderHome();
      try { window.scrollTo(0, 0); } catch(err){}
    } else if (a === 'play'){
      go('wheel', el.getAttribute('data-id'));
    } else if (a === 'up' || a === 'down'){
      moveWheel(el.getAttribute('data-id'), a === 'up' ? -1 : 1);
    } else if (a === 'new'){
      NAV.wheelId = null;
      go('editor');
    } else if (a === 'import'){
      pickImportFile();
    } else if (a === 'settings'){
      go('settings');
    } else if (a === 'games'){
      go('games');
    } else if (a === 'categories'){
      go('categories');
    } else if (a === 'toggle-search'){
      NAV.searchOpen = !NAV.searchOpen;
      if (!NAV.searchOpen) NAV.query = '';
      renderHome();
      if (NAV.searchOpen) setTimeout(function(){ const i = $('#homeSearch'); if (i) i.focus(); }, 80);
    } else if (a === 'clear-search'){
      NAV.query = '';
      renderHome();
      setTimeout(function(){ const i = $('#homeSearch'); if (i) i.focus(); }, 80);
    } else if (a === 'more'){
      NAV.homeLimit = (NAV.homeLimit || HOME_PAGE) + HOME_PAGE;
      const list = $('#wheelList');
      if (list) list.innerHTML = homeListHtml();
      bindCardsOnly();
    } else if (a === 'home-menu'){
      openHomeMenu();
    } else if (a === 'done-sort'){
      NAV.sorting = false;
      renderHome();
      toast('顺序已保存');
    }
  };

  const input = $('#homeSearch');
  if (input){
    input.addEventListener('input', function(){
      NAV.query = input.value;
      NAV.homeLimit = HOME_PAGE;
      const list = $('#wheelList');
      if (list) list.innerHTML = homeListHtml();
      bindCardsOnly();
    });
  }
}

function bindCardsOnly(){
  const root = $('#app');
  $$('.wheel-card', root).forEach(function(card){
    if (card.__bound) return;
    card.__bound = true;
    card.addEventListener('click', function(e){
      if (e.target.closest('[data-action]')) return;
      go('wheel', card.getAttribute('data-id'));
    });
    card.addEventListener('pointerdown', function(e){
      if (e.target.closest('[data-action]')) return;
      pressFired = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function(){ pressFired = true; haptic(16); openLibraryWheelMenu(card.getAttribute('data-id')); }, 520);
    });
    ['pointerup','pointercancel','pointermove'].forEach(function(ev){
      card.addEventListener(ev, function(){ clearTimeout(pressTimer); });
    });
  });
}

function moveWheel(id, dir){
  const list = filteredWheels();
  const i = list.findIndex(function(w){ return w.id === id; });
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  const a = list[i], b = list[j];
  const ia = db.wheels.indexOf(a), ib = db.wheels.indexOf(b);
  if (ia < 0 || ib < 0) return;
  db.wheels[ia] = b;
  db.wheels[ib] = a;
  save();
  const el = $('#wheelList');
  if (el) el.innerHTML = homeListHtml();
  bindCardsOnly();
  haptic(8);
}

function openHomeMenu(){
  const ov = openSheet(
    '<h3>转盘库</h3><div class="action-list">' +
      '<button class="action-item" data-m="sort">' + ICON.sliders + ' 排序<span class="hint">' + (NAV.sorting ? '进行中' : '手动 / 名称 / 数量') + '</span></button>' +
      '<button class="action-item" data-m="history">' + ICON.clock + ' 抽取记录<span class="hint">' + (db.history || []).length + ' 条</span></button>' +
      '<button class="action-item" data-m="cats">' + ICON.folder + ' 分类管理<span class="hint">' + db.categories.length + ' 个</span></button>' +
      '<button class="action-item" data-m="import">' + ICON.upload + ' 导入 .pwh / JSON</button>' +
      '<button class="action-item" data-m="export">' + ICON.download + ' 导出全部备份</button>' +
      '<div class="action-sep"></div>' +
      '<button class="action-item" data-m="settings">' + ICON.gear + ' 设置</button>' +
      '<button class="action-item" data-m="help">' + ICON.info + ' 使用说明</button>' +
    '</div>', {});
  $$('[data-m]', ov).forEach(function(b){
    b.onclick = function(){
      const m = b.getAttribute('data-m');
      closeOverlay(true);
      if (m === 'sort') openSortMenu();
      else if (m === 'history'){ NAV.historyWheelId = 'all'; NAV.historyFrom = 'home'; go('history'); }
      else if (m === 'cats') go('categories');
      else if (m === 'import') pickImportFile();
      else if (m === 'export') exportData();
      else if (m === 'settings') go('settings');
      else if (m === 'help') showHelp();
    };
  });
}

function openSortMenu(){
  const ov = openSheet(
    '<h3>排序</h3><p class="desc">选择一种方式，或手动调整每个转盘的位置。</p>' +
    '<div class="action-list">' +
      '<button class="action-item" data-s="manual">' + ICON.chevDown + ' 手动排序<span class="hint">用箭头调整</span></button>' +
      '<button class="action-item" data-s="name">' + ICON.list + ' 按名称</button>' +
      '<button class="action-item" data-s="count">' + ICON.wheel + ' 按选项数量</button>' +
      '<button class="action-item" data-s="time">' + ICON.clock + ' 按创建时间</button>' +
    '</div>', {});
  $$('[data-s]', ov).forEach(function(b){
    b.onclick = function(){
      const s = b.getAttribute('data-s');
      closeOverlay(true);
      if (s === 'manual'){
        NAV.sorting = true;
        NAV.category = 'all';
        renderHome();
        return;
      }
      if (s === 'name'){
        db.wheels.sort(function(a,b){ return a.title.localeCompare(b.title, 'zh-CN'); });
      } else if (s === 'count'){
        db.wheels.sort(function(a,b){ return b.items.length - a.items.length; });
      } else if (s === 'time'){
        db.wheels.sort(function(a,b){ return (a.createdAt||0) - (b.createdAt||0); });
      }
      save();
      NAV.sorting = false;
      renderHome();
      toast('已重新排序');
    };
  });
}

function openLibraryWheelMenu(id){
  const w = getWheel(id);
  if (!w) return;
  const ov = openSheet(
    '<h3>' + esc(w.title) + '</h3><div class="action-list">' +
      '<button class="action-item" data-m="edit">' + ICON.edit + ' 编辑选项与权重</button>' +
      '<button class="action-item" data-m="cat">' + ICON.tag + ' 移动分类<span class="hint">' + esc(w.category) + '</span></button>' +
      '<button class="action-item" data-m="rules">' + ICON.spark + ' 自动跳转<span class="hint">' + (w.rules || []).length + ' 条</span></button>' +
      '<button class="action-item" data-m="sort">' + ICON.sliders + ' 手动排序</button>' +
      '<div class="action-sep"></div>' +
      '<button class="action-item danger" data-m="del">' + ICON.trash + ' 删除转盘</button>' +
    '</div>', {});
  $$('[data-m]', ov).forEach(function(b){
    b.onclick = function(){
      const m = b.getAttribute('data-m');
      closeOverlay(true);
      if (m === 'edit'){ go('editor', w.id); }
      else if (m === 'cat'){
        openCategoryPicker(w.category, function(cat){
          w.category = cat;
          w.updatedAt = Date.now();
          save();
          renderHome();
          toast('已移动到「' + cat + '」');
        });
      } else if (m === 'rules'){ go('rules', w.id); }
      else if (m === 'sort'){ NAV.sorting = true; renderHome(); }
      else if (m === 'del'){
        confirmDialog({ title: '删除「' + w.title + '」？', desc: '转盘和它的自动跳转规则都会删除，无法恢复。', ok: '删除', danger: true }).then(function(ok){
          if (!ok) return;
          const i = db.wheels.indexOf(w);
          if (i >= 0) db.wheels.splice(i, 1);
          save();
          renderHome();
          toast('已删除');
        });
      }
    };
  });
}

/* ---------- import picker ---------- */
function pickImportFile(){
  if (NATIVE && NATIVE.pickWheelFile){
    try { NATIVE.pickWheelFile(); toast('请选择 .pwh 或 JSON 文件', 1800); } catch(e){ toast('无法打开文件选择器'); }
    return;
  }
  let inp = $('#webFile');
  if (!inp){
    inp = document.createElement('input');
    inp.type = 'file';
    inp.id = 'webFile';
    inp.style.display = 'none';
    inp.accept = '.pwh,.json,application/json,application/zip,application/gzip,*/*';
    document.body.appendChild(inp);
    inp.addEventListener('change', function(){
      const f = inp.files && inp.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async function(){
        try {
          let buf = new Uint8Array(reader.result);
          let text = await decodeBytes(buf);
          importFromText(f.name, text);
        } catch(e){ toast('导入失败：' + e.message, 3500); }
      };
      reader.readAsArrayBuffer(f);
      inp.value = '';
    });
  }
  inp.click();
}

async function decodeBytes(buf){
  let start = 0;
  const head = String.fromCharCode.apply(null, buf.slice(0, 4));
  if (head.slice(0,3).toLowerCase() === 'pwh') start = 3;
  let bytes = buf.slice(start);
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isGzip && window.DecompressionStream){
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const ab = await new Response(stream).arrayBuffer();
    return decodeBytes(new Uint8Array(ab));
  }
  if (isZip) throw new Error('浏览器预览不支持 zip，请在 App 内导入');
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

/* ---------- help ---------- */
function showHelp(){
  openSheet(
    '<h3>使用说明</h3>' +
    '<div class="rule-flow" style="line-height:1.85">' +
    '<b>导入</b> 支持 .pwh 文件：去掉文件前缀后自动识别 zip / gzip，读取里面的 JSON。' +
    '也可以导入本 App 导出的 JSON 备份。<br><br>' +
    '<b>长按</b> 首页上的转盘，可以改名、分类、排序或删除。<br><br>' +
    '<b>避重</b> 在每个转盘的「⋯」菜单里开启后，抽过的选项不会再次出现，直到重置。<br><br>' +
    '<b>权重</b> 在编辑页里调整，权重越大的选项越容易被抽中。<br><br>' +
    '<b>自动跳转</b> 在「⋯ → 自动跳转」里设置：抽到某个选项后停顿 N 秒，自动跳到另一个转盘。<br><br>' +
    '<b>朗读</b> 设置里可切换系统 TTS 或 GPT-SoVITS 克隆音色。<br><br>' +
    '<b>克隆音色</b> 先在电脑上启动 GPT-SoVITS 的 api_v2.py（加 -a 0.0.0.0，默认 9880 端口），在 App 设置里填服务器地址、服务器上的参考音频路径和参考文本，即可用参考音频的音色朗读结果。' +
    '</div><div class="modal-actions"><button class="btn primary" id="helpOk">知道了</button></div>', { center: true });
  $('#helpOk').onclick = function(){ closeOverlay(true); };
}
