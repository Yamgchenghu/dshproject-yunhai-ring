/* ===== 分类管理 ===== */
'use strict';

function renderCategories(){
  const rows = db.categories.map(function(c, i){
    const n = db.wheels.filter(function(w){ return w.category === c; }).length;
    const fixed = c === '未分类';
    return '<div class="cat-row" data-cat="' + esc(c) + '">' +
      '<div class="mini-ic">' + ICON.folder + '</div>' +
      '<div class="name">' + esc(c) + '</div>' +
      '<span class="num">' + n + '</span>' +
      '<div class="sort-arrows" style="flex-direction:row;gap:4px">' +
        '<button data-action="up" data-i="' + i + '" aria-label="上移" style="width:30px;height:30px">' + ICON.chevUp + '</button>' +
        '<button data-action="down" data-i="' + i + '" aria-label="下移" style="width:30px;height:30px">' + ICON.chevDown + '</button>' +
      '</div>' +
      (!fixed ? '<button class="del" data-action="del" data-i="' + i + '" style="width:32px;height:32px;color:#C2C2BD;display:flex;align-items:center;justify-content:center">' + ICON.trash + '</button>' : '') +
    '</div>';
  }).join('');

  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">分类管理</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn primary" data-action="add" style="padding:10px 18px;font-size:14px">＋ 新建</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:6px 4px 16px">分类用来整理大量转盘。点分类名可以改名，右侧箭头调整顺序。</p>' +
      rows +
      '<button class="btn block" data-action="add" style="margin-top:16px;height:52px;background:var(--card);border:1px solid var(--line)">' + ICON.plus + ' 新建分类</button>' +
      '<p class="tiny muted" style="margin:16px 6px;line-height:1.6">「未分类」是默认分类，不能删除。删除分类时，里面的转盘会移动到「未分类」。</p>' +
    '</div>' +
  '</div>';

  const root = $('#app');
  root.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (el){
      const a = el.getAttribute('data-action');
      if (a === 'back') back();
      else if (a === 'add') addCategory();
      else if (a === 'up' || a === 'down') moveCategory(Number(el.getAttribute('data-i')), a === 'up' ? -1 : 1);
      else if (a === 'del') deleteCategory(Number(el.getAttribute('data-i')));
      return;
    }
    const row = e.target.closest('.cat-row');
    if (row) renameCategory(row.getAttribute('data-cat'));
  };
}

function addCategory(){
  promptDialog({ title: '新建分类', label: '分类名称', placeholder: '最多 16 个字' }).then(function(name){
    name = normalizeCategoryName(name);
    if (!name) return;
    if (db.categories.indexOf(name) >= 0){ toast('这个分类已经存在'); return; }
    db.categories.push(name);
    save();
    renderCategories();
    toast('已添加「' + name + '」');
  });
}

function renameCategory(oldName){
  if (!oldName || oldName === '未分类') return;
  promptDialog({ title: '重命名分类', label: '分类名称', value: oldName }).then(function(name){
    name = normalizeCategoryName(name);
    if (!name || name === oldName) return;
    if (db.categories.indexOf(name) >= 0){ toast('这个分类已经存在'); return; }
    const i = db.categories.indexOf(oldName);
    if (i < 0) return;
    db.categories[i] = name;
    db.wheels.forEach(function(w){ if (w.category === oldName) w.category = name; });
    if (NAV.category === oldName) NAV.category = name;
    save();
    renderCategories();
    toast('已重命名');
  });
}

function moveCategory(i, dir){
  const j = i + dir;
  if (j < 0 || j >= db.categories.length) return;
  const t = db.categories[i];
  db.categories[i] = db.categories[j];
  db.categories[j] = t;
  save();
  renderCategories();
}

function deleteCategory(i){
  const name = db.categories[i];
  if (!name || name === '未分类') return;
  const n = db.wheels.filter(function(w){ return w.category === name; }).length;
  confirmDialog({
    title: '删除「' + name + '」分类？',
    desc: n ? ('里面的 ' + n + ' 个转盘会移动到「未分类」。') : '这个分类是空的。',
    ok: '删除', danger: true
  }).then(function(ok){
    if (!ok) return;
    db.categories.splice(i, 1);
    db.wheels.forEach(function(w){ if (w.category === name) w.category = '未分类'; });
    if (NAV.category === name) NAV.category = 'all';
    save();
    renderCategories();
    toast('已删除分类');
  });
}
