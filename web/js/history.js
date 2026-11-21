/* ===== 抽取记录 ===== */
'use strict';

function histParts(at){
  const d = new Date(Number(at) + 8 * 3600 * 1000);
  const p = function(n){ return n < 10 ? '0' + n : '' + n; };
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
    hh: p(d.getUTCHours()), mm: p(d.getUTCMinutes()),
    key: d.getUTCFullYear() + '-' + p(d.getUTCMonth()+1) + '-' + p(d.getUTCDate())
  };
}
function histDayLabel(at){
  const t = histParts(at);
  const n = histParts(Date.now());
  if (t.key === n.key) return '今天';
  const y = new Date(Number(at) + 8*3600*1000 - 86400000);
  const yp = histParts(y.getTime());
  if (yp.key === n.key) return '昨天';
  return t.y + '年' + t.m + '月' + t.d + '日';
}
function histTime(at){ const p = histParts(at); return p.hh + ':' + p.mm; }

function renderHistory(){
  let filter = NAV.historyWheelId || 'all';
  let current = getWheel(filter);
  if (filter !== 'all' && !current){ filter = 'all'; NAV.historyWheelId = 'all'; }
  const contextWheel = (NAV.historyFrom === 'wheel' && NAV.historyWheelId && NAV.historyWheelId !== 'all') ? getWheel(NAV.historyWheelId) : null;
  const all = db.history || [];
  const records = all.filter(function(r){ return filter === 'all' || r.wheelId === filter; });
  const today = histParts(Date.now()).key;
  const todayCount = records.filter(function(r){ return histParts(r.at).key === today; }).length;

  let listHtml = '';
  let lastDay = '';
  records.slice(0, 300).forEach(function(r){
    const day = histDayLabel(r.at);
    if (day !== lastDay){
      listHtml += '<div class="history-day">' + esc(day) + '</div>';
      lastDay = day;
    }
    listHtml += '<div class="history-row">' +
      '<div class="history-result">' + esc(r.text) + '</div>' +
      '<div class="history-meta"><span>' + histTime(r.at) + '</span><span class="history-wheel">' + esc(r.wheelTitle || '') + '</span></div>' +
    '</div>';
  });
  if (!records.length){
    listHtml = '<div class="history-empty">' +
      '<div class="voice-empty-icon">' + ICON.clock + '</div>' +
      '<div class="voice-empty-title">还没有抽取记录</div>' +
      '<div class="tiny muted">抽一次之后，结果会记在这里</div>' +
    '</div>';
  }

  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">抽取记录</div>' +
      '<div class="spacer"></div>' +
      (records.length ? '<button class="icon-btn" data-action="clear" aria-label="清空">' + ICON.trash + '</button>' : '') +
    '</div>' +
    '<div class="form-page">' +
      '<div class="history-chips">' +
        '<button class="chip' + (filter === 'all' ? ' on' : '') + '" data-filter="all">全部</button>' +
        (contextWheel ? '<button class="chip' + (filter === contextWheel.id ? ' on' : '') + '" data-filter="' + esc(contextWheel.id) + '">' + esc(contextWheel.title) + '</button>' : '') +
      '</div>' +
      '<div class="history-summary">' + records.length + ' 条记录' + (records.length ? ' · 今天 ' + todayCount + ' 条' : '') + '</div>' +
      '<div class="history-list">' + listHtml + '</div>' +
      '<div style="height:20px"></div>' +
    '</div>' +
  '</div>';

  app.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (el){
      const a = el.getAttribute('data-action');
      if (a === 'back') back();
      else if (a === 'clear'){
        const scope = filter === 'all' ? '全部' : (current ? '「' + current.title + '」的' : '');
        confirmDialog({ title: '清空' + scope + '抽取记录？', desc: '记录删除后无法恢复，转盘和选项不受影响。', ok: '清空', danger: true }).then(function(ok){
          if (!ok) return;
          if (filter === 'all') db.history = [];
          else db.history = (db.history || []).filter(function(r){ return r.wheelId !== filter; });
          save();
          renderHistory();
          toast('记录已清空');
        });
      }
      return;
    }
    const f = e.target.closest('[data-filter]');
    if (f){
      NAV.historyWheelId = f.getAttribute('data-filter');
      renderHistory();
    }
  };
}
