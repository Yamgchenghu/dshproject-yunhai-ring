/* ===== 自动跳转规则 ===== */
'use strict';

function renderRules(){
  const w = currentWheel();
  if (!w) { NAV.page = 'home'; renderHome(); return; }
  const rules = w.rules || [];
  const cards = rules.map(function(r, i){
    const target = getWheel(r.targetId);
    const delayText = autoJumpDelayLabel(r.delay);
    return '<div class="rule-card" data-i="' + i + '">' +
      '<div class="rule-top">' +
        '<div class="grow"><div class="lr-title" style="font-size:15.5px">抽到「' + esc(r.itemText || '已删除的选项') + '」</div>' +
        '<div class="lr-sub">' + (r.enabled === false ? '已停用' : '启用中') + '</div></div>' +
        '<span class="switch' + (r.enabled === false ? '' : ' on') + '" data-toggle="' + i + '"></span>' +
        '<button class="rule-del" data-del="' + i + '" aria-label="删除">' + ICON.x + '</button>' +
      '</div>' +
      '<div class="rule-flow">等待 <b>' + esc(delayText) + '</b>' +
        '<span class="arrow">' + ICON.arrowRight + '</span> 跳转到 <b>' + (target ? esc(target.title) : '⚠ 目标已删除') + '</b>' +
        (r.autoSpin ? '，并自动旋转' : '') + '</div>' +
    '</div>';
  }).join('');

  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">自动跳转</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn primary" data-action="add" style="padding:10px 18px;font-size:14px">＋ 添加</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:6px 4px 16px;line-height:1.6">给「' + esc(w.title) + '」设置联动：抽到某个选项后停顿几秒，自动跳到另一个转盘。</p>' +
      (rules.length ? cards : '<div class="rule-card" style="text-align:center;padding:34px 22px">' +
        '<div style="font-size:15px;font-weight:700;margin-bottom:6px">还没有规则</div>' +
        '<div class="small muted" style="line-height:1.6">例如：抽到「再来一次」→ 停顿 2 秒 → 跳回本转盘并自动旋转</div>' +
        '<button class="btn soft" data-action="add" style="margin-top:18px">＋ 添加第一条</button></div>') +
      '<div style="height:8px"></div>' +
      '<button class="btn block" data-action="add" style="height:52px;background:var(--card);border:1px solid var(--line)">' + ICON.plus + ' 添加规则</button>' +
    '</div>' +
  '</div>';

  const root = $('#app');
  root.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (el){
      const a = el.getAttribute('data-action');
      if (a === 'back') back();
      else if (a === 'add') openRuleEditor(-1);
      return;
    }
    const tg = e.target.closest('[data-toggle]');
    if (tg){
      const i = Number(tg.getAttribute('data-toggle'));
      if (w.rules[i]) { w.rules[i].enabled = w.rules[i].enabled === false; save(); renderRules(); }
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del){
      const i = Number(del.getAttribute('data-del'));
      confirmDialog({ title: '删除这条规则？', ok: '删除', danger: true }).then(function(ok){
        if (!ok) return;
        w.rules.splice(i, 1); save(); renderRules(); toast('已删除');
      });
      return;
    }
    const card = e.target.closest('.rule-card[data-i]');
    if (card) openRuleEditor(Number(card.getAttribute('data-i')));
  };
}

function openRuleEditor(index, preset){
  const w = currentWheel();
  if (!w) return;
  if (!w.items.length){ toast('先给转盘添加选项'); return; }
  const editing = index >= 0;
  let rule;
  if (preset) rule = preset;
  else if (editing) rule = JSON.parse(JSON.stringify(w.rules[index]));
  else {
    rule = {
      itemIndex: 0,
      itemText: w.items[0].text,
      delay: Number(db.settings.defaultJumpDelay) || 0,
      targetId: (db.wheels.filter(function(x){ return x.id !== w.id; })[0] || w).id,
      autoSpin: false,
      enabled: true
    };
  }
  let target = getWheel(rule.targetId) || w;
  rule.targetId = target.id;

  const ov = openSheet(
    '<h3>' + (editing ? '编辑规则' : '新增规则') + '</h3>' +
    '<div class="field"><label>抽到哪个选项</label><button class="row" id="ruleItem" style="width:100%;text-align:left;justify-content:space-between">' +
      '<span class="ellipsis" style="font-weight:700">' + esc(rule.itemText || '选择选项') + '</span>' + ICON.chevRight + '</button></div>' +
    '<div class="field"><label>等待时间</label><input id="ruleDelay" type="text" autocomplete="off" inputmode="text" value="' + esc(rule.delay == null ? '' : rule.delay) + '" placeholder="2 或 {rf}+2.5"><div class="hint">填数字，或 {rf}+2.5（{readfinish}/{read_finish} 同义，只支持 {rf}+小数）；只支持这种 + 形式</div></div>' +
    '<div class="field"><label>跳转到</label><button class="row" id="ruleTarget" style="width:100%;text-align:left;justify-content:space-between">' +
      '<span class="ellipsis" style="font-weight:700">' + esc(target.title) + '</span>' + ICON.chevRight + '</button></div>' +
    '<div class="card-box" style="margin-bottom:12px"><div class="line-row">' +
      '<div class="lr-main"><div class="lr-title">跳转后自动旋转</div><div class="lr-sub">到达目标转盘后立即开始抽</div></div>' +
      '<span class="switch' + (rule.autoSpin ? ' on' : '') + '" id="ruleAuto"></span>' +
    '</div></div>' +
    '<div class="modal-actions"><button class="btn" id="ruleCancel">取消</button>' +
      (editing ? '<button class="btn accent" id="ruleDel">删除</button>' : '') +
      '<button class="btn primary" id="ruleSave">保存</button></div>' +
    '<div style="height:6px"></div>',
    {}
  );

  $('#ruleAuto', ov).onclick = function(){ rule.autoSpin = !rule.autoSpin; $('#ruleAuto', ov).classList.toggle('on', rule.autoSpin); };
  $('#ruleItem', ov).onclick = function(){
    rule.delay = $('#ruleDelay', ov).value.trim();
    closeOverlay(true);
    openOptionPicker(w.items, rule.itemIndex, function(i){
      rule.itemIndex = i;
      rule.itemText = w.items[i] ? w.items[i].text : '';
      openRuleEditor(index, rule);
    });
  };
  $('#ruleTarget', ov).onclick = function(){
    rule.delay = $('#ruleDelay', ov).value.trim();
    closeOverlay(true);
    openWheelPicker(function(t){
      rule.targetId = t.id;
      openRuleEditor(index, rule);
    }, { currentId: rule.targetId, withCategories: true, title: '选择目标转盘' });
  };
  $('#ruleCancel', ov).onclick = function(){ closeOverlay(true); };
  if (editing){
    $('#ruleDel', ov).onclick = function(){
      closeOverlay(true);
      confirmDialog({ title: '删除这条规则？', ok: '删除', danger: true }).then(function(ok){
        if (!ok) return;
        w.rules.splice(index, 1); save(); renderRules(); toast('已删除');
      });
    };
  }
  $('#ruleSave', ov).onclick = function(){
    rule.itemText = w.items[rule.itemIndex] ? w.items[rule.itemIndex].text : '';
    const delayParsed = parseAutoJumpDelay($('#ruleDelay', ov).value);
    if (!delayParsed.ok){ toast('等待时间只能填数字，或 {rf}+数字'); return; }
    rule.delay = delayParsed.text || 0;
    rule.enabled = rule.enabled !== false;
    if (!getWheel(rule.targetId)){ toast('请选择一个存在的目标转盘'); return; }
    if (!rule.itemText){ toast('请选择一个选项'); return; }
    if (editing) w.rules[index] = rule;
    else w.rules.push(rule);
    save();
    closeOverlay(true);
    renderRules();
    toast('规则已保存');
  };
}
