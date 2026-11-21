/* ===== 编辑转盘 ===== */
'use strict';

let editorKey = null;

function editIsDirty(){
  if (!editDraft) return false;
  const cur = JSON.stringify({
    title: editDraft.title, category: editDraft.category,
    avoid: !!editDraft.avoid, items: editDraft.items
  });
  return cur !== editBaseJson;
}

function editSnapshot(){
  return JSON.stringify({
    title: editDraft.title, category: editDraft.category,
    avoid: !!editDraft.avoid, items: editDraft.items
  });
}

function renderEditor(){
  const existing = NAV.wheelId ? getWheel(NAV.wheelId) : null;
  const key = existing ? existing.id : 'new';
  if (!editDraft || editorKey !== key){
    editDraft = existing
      ? JSON.parse(JSON.stringify(existing))
      : newWheel('', [{ text: '', weight: 100 }], (db.categories[0] || '未分类'));
    editDraft.title = existing ? existing.title : '';
    editorKey = key;
    editBaseJson = editSnapshot();
  }
  if (!editDraft.items.length) editDraft.items.push({ text: '', weight: 100, group: 1 });

  const catOpts = db.categories.map(function(c){
    return '<option value="' + esc(c) + '"' + (c === editDraft.category ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('') + '<option value="__new">＋ 新建分类…</option>';

  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">' + (existing ? '编辑转盘' : '新建转盘') + '</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn primary" data-action="save" style="padding:10px 18px;font-size:14px">保存</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<div class="field"><label>名称</label><input id="edTitle" type="text" maxlength="40" placeholder="给转盘起个名字" value="' + esc(editDraft.title) + '"></div>' +
      '<div class="field"><label>分类</label><select id="edCat">' + catOpts + '</select></div>' +
      '<div class="card-box" style="margin-bottom:12px"><div class="line-row">' +
        '<div class="lr-main"><div class="lr-title">避重模式</div><div class="lr-sub">抽过的选项不再出现，直到重置</div></div>' +
        '<span class="switch' + (editDraft.avoid ? ' on' : '') + '" id="edAvoid"></span>' +
      '</div></div>' +
      '<div class="row" style="margin:18px 4px 8px"><div class="section-label" style="margin:0;flex:1">选项与权重</div>' +
        '<span class="tiny muted" id="edCount">' + editDraft.items.length + ' 项</span></div>' +
      '<div class="editor-items" id="edItems"></div>' +
      '<button class="add-item" data-action="add">' + ICON.plus + ' 添加选项</button>' +
      '<button class="bulk-link" data-action="bulk">批量编辑（每行一个，可写 文本|权重）</button>' +
      '<div style="height:14px"></div>' +
      '<button class="btn primary block" data-action="save" style="height:54px">保存转盘</button>' +
      '<p class="tiny muted" style="text-align:center;margin:14px 0 0">权重越大越容易被抽中，默认 100</p>' +
    '</div>' +
  '</div>';

  renderEditorItems();

  const root = $('#app');
  root.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.getAttribute('data-action');
    if (a === 'back') back();
    else if (a === 'save') saveEditor();
    else if (a === 'add') addEditorItem();
    else if (a === 'bulk') bulkEdit();
    else if (a === 'del-item') deleteEditorItem(Number(el.getAttribute('data-i')));
  };

  const title = $('#edTitle');
  title.addEventListener('input', function(){ editDraft.title = title.value; });

  const cat = $('#edCat');
  cat.addEventListener('change', function(){
    if (cat.value === '__new'){
      promptDialog({ title: '新建分类', label: '分类名称', placeholder: '最多 16 个字' }).then(function(name){
        name = normalizeCategoryName(name);
        if (!name){ cat.value = editDraft.category; return; }
        if (db.categories.indexOf(name) < 0) db.categories.push(name);
        editDraft.category = name;
        save();
        renderEditor();
      });
      return;
    }
    editDraft.category = cat.value;
  });

  const avoid = $('#edAvoid');
  avoid.onclick = function(){ editDraft.avoid = !editDraft.avoid; avoid.classList.toggle('on', editDraft.avoid); };

  const items = $('#edItems');
  items.addEventListener('input', function(e){
    const row = e.target.closest('.item-row');
    if (!row) return;
    const i = Number(row.getAttribute('data-i'));
    if (!editDraft.items[i]) return;
    if (e.target.classList.contains('text')){
      editDraft.items[i].text = e.target.value;
    } else if (e.target.classList.contains('weight')){
      let v = parseFloat(e.target.value);
      if (!isFinite(v) || v < 0) v = 0;
      editDraft.items[i].weight = v;
      refreshPcts();
    }
  });
  items.addEventListener('change', function(e){
    if (e.target.classList.contains('weight')){
      const row = e.target.closest('.item-row');
      const i = Number(row.getAttribute('data-i'));
      if (editDraft.items[i]) {
        e.target.value = Math.round(editDraft.items[i].weight * 10) / 10;
        refreshPcts();
      }
    }
  });
}

function itemRowHtml(it, i, total){
  const pct = total > 0 ? Math.round((Math.max(0, Number(it.weight) || 0) / total) * 1000) / 10 : 0;
  return '<div class="item-row" data-i="' + i + '">' +
    '<span class="idx">' + (i + 1) + '</span>' +
    '<input class="text" type="text" maxlength="60" placeholder="选项内容" value="' + esc(it.text) + '">' +
    '<div class="weight-wrap"><span>权重</span><input class="weight" type="number" min="0" step="1" inputmode="decimal" value="' + esc(it.weight) + '"></div>' +
    '<span class="pct">' + pct + '%</span>' +
    '<button class="del" data-action="del-item" data-i="' + i + '" aria-label="删除">' + ICON.x + '</button>' +
  '</div>';
}

function renderEditorItems(){
  const box = $('#edItems');
  if (!box || !editDraft) return;
  let total = 0;
  editDraft.items.forEach(function(it){ total += Math.max(0, Number(it.weight) || 0); });
  box.innerHTML = editDraft.items.map(function(it, i){ return itemRowHtml(it, i, total); }).join('');
  const c = $('#edCount');
  if (c) c.textContent = editDraft.items.length + ' 项';
}

function refreshPcts(){
  const box = $('#edItems');
  if (!box || !editDraft) return;
  let total = 0;
  editDraft.items.forEach(function(it){ total += Math.max(0, Number(it.weight) || 0); });
  $$('.item-row', box).forEach(function(row){
    const i = Number(row.getAttribute('data-i'));
    const pct = total > 0 ? Math.round((Math.max(0, Number(editDraft.items[i].weight) || 0) / total) * 1000) / 10 : 0;
    const el = $('.pct', row);
    if (el) el.textContent = pct + '%';
  });
}

function addEditorItem(){
  editDraft.items.push({ text: '', weight: 100, group: 1 });
  renderEditorItems();
  const rows = $$('.item-row');
  const last = rows[rows.length - 1];
  if (last) { const inp = $('.text', last); if (inp) { inp.focus(); inp.scrollIntoView({ block: 'center' }); } }
}

function deleteEditorItem(i){
  if (!editDraft || !editDraft.items[i]) return;
  editDraft.items.splice(i, 1);
  renderEditorItems();
  haptic(8);
}

function bulkEdit(){
  const val = editDraft.items.map(function(it){ return it.text + (Number(it.weight) !== 100 ? '|' + it.weight : ''); }).join('\n');
  promptDialog({
    title: '批量编辑选项',
    label: '每行一个选项',
    desc: '想指定权重就写成「选项|权重」，不写默认 100。',
    multiline: true,
    value: val
  }).then(function(text){
    if (text == null) return;
    const lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(function(l){ return l !== ''; });
    if (!lines.length){ toast('没有内容'); return; }
    const items = lines.map(function(line){
      const idx = line.lastIndexOf('|');
      if (idx > 0){
        const w = parseFloat(line.slice(idx + 1).trim());
        if (isFinite(w)){
          return { text: line.slice(0, idx).trim(), weight: Math.max(0, w), group: 1 };
        }
      }
      return { text: line, weight: 100, group: 1 };
    }).filter(function(it){ return it.text !== ''; });
    if (!items.length){ toast('没有有效选项'); return; }
    editDraft.items = items;
    renderEditorItems();
    toast('已替换为 ' + items.length + ' 个选项，记得保存');
  });
}

function saveEditor(){
  if (!editDraft) return;
  const title = String(editDraft.title || '').trim() || '未命名转盘';
  const items = editDraft.items.map(function(it){
    const g = Number(it.group);
    return { text: String(it.text || '').trim(), weight: Math.max(0, Number(it.weight) || 0), group: Number.isInteger(g) && g >= 0 ? g : 1 };
  }).filter(function(it){ return it.text !== ''; });
  if (!items.length){ toast('至少保留一个选项'); return; }
  const category = db.categories.indexOf(editDraft.category) >= 0 ? editDraft.category : '未分类';
  const existing = NAV.wheelId ? getWheel(NAV.wheelId) : null;

  if (existing){
    const oldTexts = existing.items.map(function(i){ return i.text; }).join('\u0001');
    const newTexts = items.map(function(i){ return i.text; }).join('\u0001');
    existing.title = title;
    existing.category = category;
    existing.items = items;
    existing.avoid = !!editDraft.avoid;
    existing.updatedAt = Date.now();
    if (oldTexts !== newTexts){ existing.drawn = []; existing.disabled = []; existing.counts = {}; }
    save();
    editDraft = null;
    go('wheel', existing.id);
  } else {
    const w = newWheel(title, items, category);
    w.avoid = !!editDraft.avoid;
    db.wheels.push(w);
    save();
    editDraft = null;
    go('wheel', w.id);
  }
  toast('已保存');
}
