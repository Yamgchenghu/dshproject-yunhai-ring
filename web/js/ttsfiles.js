/* ===== 本地 TTS 文件：试听 / 替换 / 删除 / 导出 ===== */
'use strict';

function ttsKindLabel(kind){
  return ({
    template: '模板', number: '数字', time: '时间', dynamic: '动态',
    custom: '自定义全文', sovits: 'GPT-SoVITS', system: '系统 TTS', other: '其他'
  })[kind] || '其他';
}

function renderTtsFiles(){
  if (!(NATIVE && NATIVE.listTtsFiles)){
    $('#app').innerHTML = '<div class="page"><div class="topbar"><button class="icon-btn" data-action="back">' + ICON.back + '</button><div style="font-size:20px;font-weight:800">本地 TTS 文件</div></div><div class="form-page"><p class="small muted">当前环境不支持文件管理。</p></div></div>';
    $('#app').onclick = function(e){ if (e.target.closest('[data-action="back"]')) back(); };
    return;
  }
  let list = [];
  try { list = JSON.parse(NATIVE.listTtsFiles() || '[]'); } catch(e){ list = []; }
  list.sort(function(a,b){ return (b.at || 0) - (a.at || 0); });
  const rows = list.map(function(x){
    const size = x.size >= 1048576 ? (x.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(x.size / 1024)) + ' KB';
    const d = new Date(x.at || Date.now());
    const when = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return '<div class="tts-file-row">' +
      '<input type="checkbox" class="tts-check" data-path="' + esc(x.path) + '" checked>' +
      '<div class="tts-file-main"><div class="tts-file-title ellipsis">' + esc(x.text || x.name) + '</div>' +
        '<div class="tts-file-meta">' + esc(ttsKindLabel(x.kind)) + ' · ' + size + ' · ' + when + '</div></div>' +
      '<button class="tts-mini" data-play="' + esc(x.path) + '" aria-label="试听">▶</button>' +
      (['custom','template','number','time','dynamic','sovits'].indexOf(x.kind) >= 0 ? '<button class="tts-mini" data-regen="' + esc(x.path) + '">重生成</button>' : '') +
      '<button class="tts-mini" data-replace="' + esc(x.path) + '">替换</button>' +
      '<button class="tts-mini danger" data-del="' + esc(x.path) + '">删除</button>' +
    '</div>';
  }).join('');
  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">本地 TTS 文件</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn primary" data-action="export" style="padding:9px 14px;font-size:13px">导出所选</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:4px 4px 10px;line-height:1.6">这些是 App 生成的本地音频。可试听、替换或删除；不提供导出。</p>' +
      (list.length ? '<div class="tts-tools"><span class="tiny muted">共 ' + list.length + ' 个</span><button class="tiny link-btn" data-action="all">取消全选</button></div>' +
        '<div class="tts-list">' + rows + '</div>' : '<div class="empty"><h3>还没有本地 TTS 文件</h3><p>生成朗读后这里会出现缓存音频</p></div>') +
      '<div style="height:20px"></div>' +
    '</div>' +
  '</div>';

  app.onclick = function(e){
    const act = e.target.closest('[data-action]');
    if (act){
      const a = act.getAttribute('data-action');
      if (a === 'back') back();
      else if (a === 'all'){
        const checks = $$('.tts-check', app);
        const allOn = checks.every(function(c){ return c.checked; });
        checks.forEach(function(c){ c.checked = !allOn; });
        act.textContent = allOn ? '全选' : '取消全选';
      } else if (a === 'export'){
        const extra = {};
        list.forEach(function(x){ extra[x.path] = x.kind; });
        const paths = $$('.tts-check:checked', app).map(function(c){ return c.getAttribute('data-path'); })
          .filter(function(p){ return extra[p] !== 'system'; });
        if (!paths.length){ toast('系统 TTS 不支持导出'); return; }
        try { NATIVE.exportTtsFiles(JSON.stringify(paths)); toast('正在打包 ' + paths.length + ' 个文件…'); } catch(err){ toast('导出失败'); }
      }
      return;
    }
    const play = e.target.closest('[data-play]');
    if (play){ try { NATIVE.playTtsFile(play.getAttribute('data-play')); } catch(err){ toast('无法播放'); } return; }
    const regen = e.target.closest('[data-regen]');
    if (regen){
      const cfg = {
        provider: db.settings.customTtsProvider || 'openai',
        mode: db.settings.customTtsMode || 'builtin',
        url: db.settings.customTtsUrl || '',
        key: db.settings.customTtsKey || '',
        model: db.settings.customTtsModel || '',
        voice: db.settings.customTtsVoice || '',
        format: db.settings.customTtsFormat || 'mp3',
        design: db.settings.customTtsDesign || '',
        refPath: db.settings.customTtsRefPath || '',
        speed: db.settings.ttsRate || 1.0
      };
      if (!(cfg.url || '').trim()){ toast('请先在朗读设置里填写 TTS API 地址'); return; }
      try { NATIVE.regenerateTtsFile(regen.getAttribute('data-regen'), JSON.stringify(cfg)); toast('正在重新生成…'); } catch(err){ toast('重新生成失败'); }
      return;
    }
    const rep = e.target.closest('[data-replace]');
    if (rep){ try { NATIVE.pickTtsFileForReplace(rep.getAttribute('data-replace')); } catch(err){ toast('无法打开文件选择器'); } return; }
    const del = e.target.closest('[data-del]');
    if (del){
      const path = del.getAttribute('data-del');
      confirmDialog({ title: '删除这个音频？', desc: '删除后对应内容下次会重新生成。', ok: '删除', danger: true }).then(function(ok){
        if (!ok) return;
        try { NATIVE.deleteTtsFile(path); } catch(err){ toast('删除失败'); }
      });
    }
  };
}

window.__onTtsFileChanged = function(ok, msg){
  toast(ok ? (msg || '已更新') : (msg || '操作失败'));
  if (NAV.page === 'ttsfiles') renderTtsFiles();
};
