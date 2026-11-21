/* ===== 启动 ===== */
'use strict';

function boot(){
  render();
  initFont();
  if (!db.settings.onboarded){
    db.settings.onboarded = true;
    save();
    setTimeout(function(){ toast('长按首页的转盘，可以改名、分类或删除', 3600); }, 800);
  }
}

window.__toast = function(msg){ toast(msg); };
window.__render = function(){ render(); };

boot();
