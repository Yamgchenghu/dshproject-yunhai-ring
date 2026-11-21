/* ===== 设置 ===== */
'use strict';

function paintRange(el){
  if (!el) return;
  const min = Number(el.min) || 0, max = Number(el.max) || 100, v = Number(el.value) || 0;
  const p = max > min ? ((v - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--fill', p + '%');
}

function rangeHtml(id, label, min, max, step, value, suffix, hint){
  return '<div class="slider-row"><div class="slider-head"><span class="t">' + esc(label) + '</span>' +
    '<span class="v" id="' + id + 'Val">' + value + esc(suffix || '') + '</span></div>' +
    '<input id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
    (hint ? '<div class="hint" style="margin-top:4px">' + esc(hint) + '</div>' : '') + '</div>';
}

function templatePreviewText(){
  const tpl = db.settings.ttsTemplate || '抽到 {result}';
  return tpl.replace(/\{result\}/g, '火锅')
    .replace(/\{count\}/g, '3')
    .replace(/\{last\}/g, '5')
    .replace(/\{time\}/g, utc8TimeText())
    .replace(/\{value\}/g, '火锅');
}

function renderSettings(){
  const s = db.settings;
  if (s.ttsEngine === 'custom' && s.customTtsMode === 'clone' && s.customTtsRefPath && NATIVE && NATIVE.persistTtsVoice && String(s.customTtsRefPath).indexOf('/tts_voices/') < 0){
    try {
      const saved = NATIVE.persistTtsVoice(s.customTtsRefPath, s.customTtsRefName || 'reference.wav');
      if (saved){ s.customTtsRefPath = saved; save(); }
    } catch(e){}
  }
  const native = !!NATIVE;
  const hasCustom = s.fontMode === 'custom' && !!customFontUrl;
  const fontLabel = hasCustom ? (s.fontName || '自定义字体') : '系统默认';
  const fontTag = hasCustom ? String(s.fontFormat || 'TTF').toUpperCase() : '系统';
  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">设置</div>' +
    '</div>' +
    '<div class="form-page">' +

      '<div class="section-label">抽奖</div>' +
      '<div class="card-box">' +
        rangeHtml('spinRange', '旋转时长', 2, 8, 0.2, s.spinSeconds, ' 秒') +
        '<div class="line-row" style="border-top:1px solid #F3F3F0">' +
          '<div class="lr-main"><div class="lr-title">新转盘默认避重</div><div class="lr-sub">抽过的选项不再出现</div></div>' +
          '<span class="switch' + (s.defaultAvoid ? ' on' : '') + '" id="defAvoid"></span>' +
        '</div>' +
        rangeHtml('avoidResetRange', '避重抽完自动复原', 0, 30, 0.5, s.avoidReset, ' 秒', '0 秒表示不自动复原；脚本 _reset 也会改这里') +
      '</div>' +

      '<div class="section-label">自动脚本</div>' +
      '<div class="card-box">' +
        '<button class="line-row link" id="scriptEntry" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">自动脚本</div><div class="lr-sub">全局脚本 · ' + ((db.globalScript || '').trim() ? '已编写' : '未编写') + '</div></div>' +
          ICON.spark + ICON.chevRight + '</button>' +
      '</div>' +

      '<div class="section-label">朗读结果</div>' +
      '<div class="card-box">' +
        '<div class="line-row">' +
          '<div class="lr-main"><div class="lr-title">开启朗读</div><div class="lr-sub">抽中后自动念出结果</div></div>' +
          '<span class="switch' + (s.ttsEnabled ? ' on' : '') + '" id="ttsOn"></span>' +
        '</div>' +
        '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:9px">' +
          '<div class="lr-title">朗读引擎</div>' +
          '<div class="segmented" id="engineSeg">' +
            '<button data-e="system" class="' + (s.ttsEngine === 'system' ? 'on' : '') + '">系统语音</button>' +
            '<button data-e="sovits" class="' + (s.ttsEngine === 'sovits' ? 'on' : '') + '">GPT-SoVITS</button>' +
            '<button data-e="custom" class="' + (s.ttsEngine === 'custom' ? 'on' : '') + '">自定义 API</button>' +
          '</div>' +
        '</div>' +
        '<div id="customTtsBox" style="display:' + (s.ttsEngine === 'custom' ? 'block' : 'none') + '">' +
          '<div class="section-label" style="margin-top:12px">自定义 TTS API</div>' +
          '<div class="segmented" id="customProvider">' +
            '<button data-cp="openai" class="' + ((s.customTtsProvider || 'openai') === 'openai' ? 'on' : '') + '">OpenAI 兼容</button>' +
            '<button data-cp="mimo" class="' + (s.customTtsProvider === 'mimo' ? 'on' : '') + '">MiMo</button>' +
            '<button data-cp="get" class="' + (s.customTtsProvider === 'get' ? 'on' : '') + '">GET 模板</button>' +
          '</div>' +
          '<div class="segmented" id="customMode" style="margin-top:8px">' +
            '<button data-cm="builtin" class="' + ((s.customTtsMode || 'builtin') === 'builtin' ? 'on' : '') + '">内置音色</button>' +
            '<button data-cm="design" class="' + (s.customTtsMode === 'design' ? 'on' : '') + '">音色生成</button>' +
            '<button data-cm="clone" class="' + (s.customTtsMode === 'clone' ? 'on' : '') + '">音色克隆</button>' +
          '</div>' +
          '<div class="field" style="margin-top:10px"><label>API 地址</label><input id="customTtsUrl" type="url" autocomplete="off" value="' + esc(s.customTtsUrl || '') + '" placeholder="https://..."></div>' +
          '<div class="field"><label>API Key</label><div class="key-wrap"><input id="customTtsKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(s.customTtsKey || '') + '" placeholder="可留空"><button type="button" class="key-toggle" data-key-toggle="customTtsKey">显示</button></div></div>' +
          '<div class="row" style="gap:8px">' +
            '<div class="field" style="flex:1"><label>模型</label><input id="customTtsModel" type="text" value="' + esc(s.customTtsModel || '') + '" placeholder="tts-1"></div>' +
            '<div class="field" style="flex:1"><label>音色</label><input id="customTtsVoice" type="text" value="' + esc(s.customTtsVoice || '') + '" placeholder="alloy"></div>' +
          '</div>' +
          '<div class="field"><label>音频格式</label><input id="customTtsFormat" type="text" value="' + esc(s.customTtsFormat || 'mp3') + '" placeholder="mp3 / wav"></div>' +
          '<div class="field" id="customDesignWrap" style="display:' + (s.customTtsMode === 'design' ? 'block' : 'none') + '"><label>音色描述</label><input id="customTtsDesign" type="text" value="' + esc(s.customTtsDesign || '') + '" placeholder="例如：温柔的女声，语速偏慢"></div>' +
          '<div class="field" id="customCloneWrap" style="display:' + (s.customTtsMode === 'clone' ? 'block' : 'none') + '"><label>参考音频（MiMo 克隆）</label>' +
            '<button class="line-row link" id="customRefPick" style="width:100%;text-align:left"><div class="lr-main"><div class="lr-title" id="customRefName">' + esc(s.customTtsRefName || '选择音频样本') + '</div><div class="lr-sub">3～10 秒，mp3 / wav；永久保存，原文件删除也可用；重新选择会替换旧音色</div></div>' + ICON.mic + '</button>' +
            '<div class="tpl-vars" style="margin-top:4px"><button data-builtin-voice="claude">内置 · Claude sonnet 5.5</button><button data-builtin-voice="gpt6">内置 · GPT6.1sol</button></div>' +
            '<div class="line-row" style="margin-top:8px"><div class="lr-main"><div class="lr-title">克隆使用分段缓存（B）</div><div class="lr-sub">默认关闭 = 全文缓存；开启 = 模板/数字/时间分段复用</div></div><span class="switch' + (s.customTtsSegmentClone ? ' on' : '') + '" id="customSegmentSwitch"></span></div>' +
          '</div>' +
          '<div class="tpl-vars" style="margin-top:8px">' +
            '<button data-custom-preset="mimo">填入 MiMo 默认</button>' +
            '<button data-custom-preset="openai">OpenAI / 千问</button>' +
          '</div>' +
          '<div id="customTtsHint" style="display:' + (s.customTtsShowHint === false ? 'none' : 'block') + '"><div class="lr-sub" style="margin-top:6px;line-height:1.6">MiMo 用 api-key 请求 /v1/chat/completions；OpenAI 兼容 /v1/audio/speech；GET 模板用 {text} 占位。失败自动回退系统语音。内置音色/克隆按内容缓存，音色生成不缓存。</div></div>' +
          '<div class="line-row" style="margin-top:6px"><div class="lr-main"><div class="lr-title">显示 API 说明</div></div><span class="switch' + (s.customTtsShowHint !== false ? ' on' : '') + '" id="customHintSwitch"></span></div>' +
        '</div>' +
        '<button class="line-row link" id="voiceEntry" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">音色克隆</div><div class="lr-sub">' + esc(voiceSummary()) + '</div></div>' +
          ICON.mic + ICON.chevRight + '</button>' +
        '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:6px">' +
          '<div class="lr-title">朗读模板</div>' +
          '<input id="ttsTemplate" type="text" maxlength="120" value="' + esc(s.ttsTemplate) + '" placeholder="抽到 {result}" ' +
            'style="width:100%;border:none;outline:none;background:transparent;font-size:15px;font-weight:600;padding:2px 0">' +
          '<div class="tpl-vars" id="tplVars">' +
            '<button data-tpl="{result}">结果</button>' +
            '<button data-tpl="{count}">次数</button>' +
            '<button data-tpl="{last}">剩余</button>' +
            '<button data-tpl="{time}">时间</button>' +
            '<button data-tpl="{value}">数值</button>' +
          '</div>' +
          '<div class="lr-sub" id="tplPreview">预览：' + esc(templatePreviewText()) + '</div>' +
          '<div class="lr-sub" style="margin-top:4px">用 {value} 读选项数值；没有数值时读完整文本</div>' +
        '</div>' +
        rangeHtml('rateRange', '语速', 0.6, 1.8, 0.05, s.ttsRate, '×') +
        rangeHtml('pitchRange', '音调（仅系统语音）', 0.6, 1.6, 0.05, s.ttsPitch, '×') +
        '<button class="line-row link" id="sysTest" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">试听系统语音</div><div class="lr-sub">使用 ' + (native ? 'Android TTS' : '浏览器语音合成') + '</div></div>' +
          ICON.speaker + '</button>' +
        (native ? '<button class="line-row link" id="ttsSettings" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">系统语音设置</div><div class="lr-sub">安装语音包、切换引擎</div></div>' +
          ICON.chevRight + '</button>' : '') +
      '</div>' +

      '<div class="section-label">自动跳转</div>' +
      '<div class="card-box">' +
        '<div class="line-row">' +
          '<div class="lr-main"><div class="lr-title">允许自动跳转</div><div class="lr-sub">总开关；脚本 _autogoto 也会改这里</div></div>' +
          '<span class="switch' + (s.autoGoto !== false ? ' on' : '') + '" id="autoGotoSwitch"></span>' +
        '</div>' +
        rangeHtml('jumpRange', '默认停顿', 0, 10, 0.5, s.defaultJumpDelay, ' 秒', '新建规则时的初始值，可在规则里单独修改') +
      '</div>' +

      '<div class="section-label">字体</div>' +
      '<div class="card-box">' +
        '<div class="line-row">' +
          '<div class="lr-main"><div class="lr-title">当前字体</div><div class="lr-sub" id="fontCurrent">' + esc(fontLabel) + '</div></div>' +
          '<span class="tag" id="fontTag">' + esc(fontTag) + '</span>' +
        '</div>' +
        '<button class="line-row link" id="fontPick" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">导入字体文件</div><div class="lr-sub">.ttf / .otf / .woff，可从 sdcard 根目录选择</div></div>' +
          ICON.upload + '</button>' +
        (hasCustom ? '<button class="line-row link" id="fontClear" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title danger">恢复系统字体</div><div class="lr-sub">删除已导入的字体</div></div>' +
          ICON.refresh + '</button>' : '') +
        '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:9px">' +
          '<div class="lr-title">应用范围</div>' +
          '<div class="segmented" id="fontScope">' +
            '<button data-scope="wheel" class="' + (s.fontScope === 'all' ? '' : 'on') + '">转盘和结果</button>' +
            '<button data-scope="all" class="' + (s.fontScope === 'all' ? 'on' : '') + '">整个界面</button>' +
          '</div>' +
        '</div>' +
        '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:6px">' +
          '<div class="lr-title">预览</div>' +
          '<div class="font-preview">转盘 抽到 0123 ABC<span class="dim">' + esc(fontLabel) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<p class="tiny muted" style="margin:8px 8px 0;line-height:1.6">默认使用系统字体。可以导入自己的 .ttf / .otf / .woff；字体只保存在本机，没有中文字形时会自动用系统字体补齐。zip 里的字体请先解压，TTC 集合暂不支持。</p>' +

      '<div class="section-label">数据</div>' +
      '<div class="card-box">' +
        '<button class="line-row link" id="dataImport" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">导入转盘</div><div class="lr-sub">.pwh / JSON 备份</div></div>' + ICON.upload + '</button>' +
        '<button class="line-row link" id="dataExport" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">导出全部备份</div><div class="lr-sub">保存为 JSON 文件</div></div>' + ICON.download + '</button>' +
        '<button class="line-row link" id="dataTtsFiles" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">本地 TTS 文件</div><div class="lr-sub">试听、替换、删除本地音频</div></div>' + ICON.speaker + '</button>' +
        '<button class="line-row link" id="dataReset" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">重置所有抽奖进度</div><div class="lr-sub">清空所有转盘的「已抽」记录</div></div>' + ICON.refresh + '</button>' +
        '<button class="line-row link" id="dataClear" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title danger">清空全部转盘</div><div class="lr-sub">删除所有转盘和分类，无法恢复</div></div>' + ICON.trash + '</button>' +
      '</div>' +

      '<div class="section-label">关于</div>' +
      '<div class="card-box">' +
        '<div class="kv"><span class="k">版本</span><span class="v">' + APP_VERSION + '</span></div>' +
        '<div class="kv"><span class="k">运行环境</span><span class="v">' + (native ? 'Android App' : '浏览器预览') + '</span></div>' +
        '<div class="kv"><span class="k">转盘 / 选项</span><span class="v">' + db.wheels.length + ' / ' +
          db.wheels.reduce(function(a, w){ return a + w.items.length; }, 0) + '</span></div>' +
        '<button class="line-row link" id="aboutHelp" style="width:100%;text-align:left">' +
          '<div class="lr-main"><div class="lr-title">使用说明</div></div>' + ICON.info + '</button>' +
      '</div>' +
      '<div style="height:20px"></div>' +
    '</div>' +
  '</div>';

  bindSettings();
}

function langOptions(cur){
  const langs = [['zh','中文'],['en','英文'],['ja','日文'],['ko','韩文']];
  return langs.map(function(l){ return '<option value="' + l[0] + '"' + (cur === l[0] ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('');
}
function splitOptions(cur){
  const arr = [['cut0','不切分'],['cut1','四句一切'],['cut2','50 字一切'],['cut3','按中文句号'],['cut4','按英文句号'],['cut5','按标点（推荐）']];
  return arr.map(function(l){ return '<option value="' + l[0] + '"' + (cur === l[0] ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('');
}

function bindRangeSetting(id, key, fmt){
  const el = $('#' + id);
  if (!el) return;
  paintRange(el);
  el.addEventListener('input', function(){
    db.settings[key] = Number(el.value);
    const v = $('#' + id + 'Val');
    if (v) v.textContent = fmt(Number(el.value));
    paintRange(el);
    save();
  });
}

function bindSettings(){
  const s = db.settings;
  bindRangeSetting('spinRange', 'spinSeconds', function(v){ return v.toFixed(1) + ' 秒'; });
  bindRangeSetting('rateRange', 'ttsRate', function(v){ return v.toFixed(2) + '×'; });
  bindRangeSetting('pitchRange', 'ttsPitch', function(v){ return v.toFixed(2) + '×'; });
  bindRangeSetting('jumpRange', 'defaultJumpDelay', function(v){ return v.toFixed(1) + ' 秒'; });
  bindRangeSetting('avoidResetRange', 'avoidReset', function(v){ return v.toFixed(1) + ' 秒'; });
  const avoidResetEl = $('#avoidResetRange');
  if (avoidResetEl) avoidResetEl.addEventListener('input', function(){
    if (typeof scheduleAvoidReset === 'function') scheduleAvoidReset(currentWheel());
  });

  const ag = $('#autoGotoSwitch');
  if (ag) ag.onclick = function(){ s.autoGoto = s.autoGoto === false; save(); ag.classList.toggle('on', s.autoGoto); };
  const da = $('#defAvoid');
  if (da) da.onclick = function(){ s.defaultAvoid = !s.defaultAvoid; da.classList.toggle('on', s.defaultAvoid); save(); };

  const to = $('#ttsOn');
  if (to) to.onclick = function(){ s.ttsEnabled = !s.ttsEnabled; to.classList.toggle('on', s.ttsEnabled); save(); };

  const seg = $('#engineSeg');
  if (seg) seg.addEventListener('click', function(e){
    const b = e.target.closest('[data-e]');
    if (!b) return;
    s.ttsEngine = b.getAttribute('data-e');
    $$('[data-e]', seg).forEach(function(x){ x.classList.toggle('on', x === b); });
    const box = $('#customTtsBox');
    if (box) box.style.display = s.ttsEngine === 'custom' ? 'block' : 'none';
    const sysBox = $('#systemSegmentWrap');
    if (sysBox) sysBox.style.display = s.ttsEngine === 'system' ? 'block' : 'none';
    save();
    if (s.ttsEngine === 'sovits'){
      if (s.sovitsMode === 'pc' && !s.cloneUrl) toast('别忘了在「音色克隆」里配置电脑服务器');
      if (s.sovitsMode === 'phone' && !s.phoneUrl) toast('别忘了在「音色克隆」里配置手机本地地址');
      if (s.sovitsMode === 'direct' && !s.sovitsUrl) toast('别忘了填写直连 GPT-SoVITS 地址');
    }
    if (s.ttsEngine === 'custom' && !String(s.customTtsUrl || '').trim()) toast('填写 TTS API 地址后才能使用');
  });

  const cp = $('#customProvider');
  if (cp) cp.addEventListener('click', function(e){
    const b = e.target.closest('[data-cp]');
    if (!b) return;
    s.customTtsProvider = b.getAttribute('data-cp');
    $$('[data-cp]', cp).forEach(function(x){ x.classList.toggle('on', x === b); });
    save();
  });

  const cm = $('#customMode');
  function syncCustomMode(){
    const dw = $('#customDesignWrap'), cw = $('#customCloneWrap');
    if (dw) dw.style.display = s.customTtsMode === 'design' ? 'block' : 'none';
    if (cw) cw.style.display = s.customTtsMode === 'clone' ? 'block' : 'none';
    if (s.customTtsProvider === 'mimo'){
      const map = { builtin: 'mimo-v2.5-tts', design: 'mimo-v2.5-tts-voicedesign', clone: 'mimo-v2.5-tts-voiceclone' };
      if (!s.customTtsModel || String(s.customTtsModel).indexOf('mimo-') === 0) s.customTtsModel = map[s.customTtsMode] || 'mimo-v2.5-tts';
      const input = $('#customTtsModel'); if (input) input.value = s.customTtsModel;
    }
  }
  if (cm) cm.addEventListener('click', function(e){
    const b = e.target.closest('[data-cm]');
    if (!b) return;
    s.customTtsMode = b.getAttribute('data-cm');
    $$('[data-cm]', cm).forEach(function(x){ x.classList.toggle('on', x === b); });
    syncCustomMode();
    save();
  });

  function bindCustomInput(id, key){
    const el = $('#' + id);
    if (!el) return;
    el.addEventListener('input', function(){ s[key] = el.value; save(); });
    el.addEventListener('change', function(){ s[key] = el.value; save(); });
  }
  bindCustomInput('customTtsUrl', 'customTtsUrl');
  bindCustomInput('customTtsKey', 'customTtsKey');
  bindCustomInput('customTtsModel', 'customTtsModel');
  bindCustomInput('customTtsVoice', 'customTtsVoice');
  bindCustomInput('customTtsFormat', 'customTtsFormat');
  bindCustomInput('customTtsDesign', 'customTtsDesign');

  const refPick = $('#customRefPick');
  if (refPick) refPick.onclick = function(){
    if (!(NATIVE && NATIVE.pickAudio)){ toast('请在 App 内选择参考音频'); return; }
    window.__customTtsAudioCb = function(path, name){
      let saved = path || '';
      if (saved && NATIVE.persistTtsVoice){
        try { saved = NATIVE.persistTtsVoice(saved, name || 'reference.wav') || saved; } catch(e){}
      }
      s.customTtsRefPath = saved;
      s.customTtsRefName = name || '参考音频';
      save();
      const el = $('#customRefName'); if (el) el.textContent = s.customTtsRefName;
      toast(saved && saved !== path ? '音色已永久保存到应用数据' : '已选择参考音频');
    };
    try { NATIVE.pickAudio(); } catch(e){ toast('无法打开文件选择器'); }
  };

  const hintSwitch = $('#customHintSwitch');
  if (hintSwitch) hintSwitch.onclick = function(){
    s.customTtsShowHint = s.customTtsShowHint === false;
    hintSwitch.classList.toggle('on', s.customTtsShowHint);
    const hint = $('#customTtsHint');
    if (hint) hint.style.display = s.customTtsShowHint ? 'block' : 'none';
    save();
  };
  const sysSegSwitch = $('#systemSegmentSwitch');
  if (sysSegSwitch) sysSegSwitch.onclick = function(){
    s.systemTtsSegment = !s.systemTtsSegment;
    sysSegSwitch.classList.toggle('on', s.systemTtsSegment);
    save();
    toast(s.systemTtsSegment ? '系统语音：分段缓存' : '系统语音：全文缓存');
  };
  const segSwitch = $('#customSegmentSwitch');
  if (segSwitch) segSwitch.onclick = function(){
    s.customTtsSegmentClone = !s.customTtsSegmentClone;
    segSwitch.classList.toggle('on', s.customTtsSegmentClone);
    save();
    toast(s.customTtsSegmentClone ? '克隆模式：分段缓存 B' : '克隆模式：全文缓存 A');
  };

  $$('.key-toggle[data-key-toggle]').forEach(function(btn){
    btn.onclick = function(){
      const el = $('#' + btn.getAttribute('data-key-toggle'));
      if (!el) return;
      const show = el.type === 'password';
      el.type = show ? 'text' : 'password';
      btn.textContent = show ? '隐藏' : '显示';
    };
  });
  const customBox = $('#customTtsBox');
  if (customBox) customBox.addEventListener('click', function(e){
    const bv = e.target.closest('[data-builtin-voice]');
    if (bv){
      if (!(NATIVE && NATIVE.getBuiltinVoicePath)){ toast('当前环境不支持内置音色'); return; }
      const id = bv.getAttribute('data-builtin-voice');
      let path = '';
      try { path = NATIVE.getBuiltinVoicePath(id); } catch(err){ path = ''; }
      if (!path){ toast('内置音色复制失败'); return; }
      s.customTtsRefPath = path;
      s.customTtsRefName = id === 'claude' ? 'Claude sonnet 5.5.mp3' : 'GPT6.1sol.mp3';
      save();
      const y = window.scrollY;
      renderSettings();
      setTimeout(function(){ window.scrollTo(0, y); }, 0);
      toast('已使用内置参考音色：' + (id === 'claude' ? 'Claude sonnet 5.5' : 'GPT6.1sol'));
      return;
    }
    const b = e.target.closest('[data-custom-preset]');
    if (!b) return;
    const p = b.getAttribute('data-custom-preset');
    if (p === 'mimo'){
      s.customTtsProvider = 'mimo'; s.customTtsMode = 'builtin';
      s.customTtsUrl = 'https://api.xiaomimimo.com/v1/chat/completions';
      s.customTtsModel = 'mimo-v2.5-tts'; s.customTtsVoice = 'mimo_default'; s.customTtsFormat = 'mp3';
    } else {
      s.customTtsProvider = 'openai'; s.customTtsMode = 'builtin';
      s.customTtsModel = 'tts-1'; s.customTtsVoice = 'alloy'; s.customTtsFormat = 'mp3';
    }
    save();
    const y = window.scrollY;
    renderSettings();
    setTimeout(function(){ window.scrollTo(0, y); }, 0);
    toast(p === 'mimo' ? '已填入 MiMo 默认参数' : '已切换到 OpenAI 兼容');
  });

  const ve = $('#voiceEntry');
  if (ve) ve.onclick = function(){ go('voices'); };

  const tpl = $('#ttsTemplate');
  const tplPreview = $('#tplPreview');
  function refreshTemplate(){
    s.ttsTemplate = tpl.value;
    if (tplPreview) tplPreview.textContent = '预览：' + templatePreviewText();
    save();
  }
  if (tpl){
    tpl.addEventListener('input', refreshTemplate);
    if (tplPreview) tplPreview.textContent = '预览：' + templatePreviewText();
  }
  const tplVars = $('#tplVars');
  if (tplVars && tpl) tplVars.addEventListener('click', function(e){
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    const token = b.getAttribute('data-tpl');
    const start = typeof tpl.selectionStart === 'number' ? tpl.selectionStart : tpl.value.length;
    const end = typeof tpl.selectionEnd === 'number' ? tpl.selectionEnd : start;
    tpl.value = tpl.value.slice(0, start) + token + tpl.value.slice(end);
    tpl.selectionStart = tpl.selectionEnd = start + token.length;
    tpl.focus();
    refreshTemplate();
  });

  const sysTest = $('#sysTest');
  if (sysTest) sysTest.onclick = function(){ stopSpeech(); speakSystem('你好，这是云海转盘的系统朗读测试。'); };

  const ttsSet = $('#ttsSettings');
  if (ttsSet) ttsSet.onclick = function(){
    try { if (NATIVE && NATIVE.openTtsSettings) NATIVE.openTtsSettings(); } catch(e){ toast('无法打开系统语音设置'); }
  };

  const fontPick = $('#fontPick');
  if (fontPick) fontPick.onclick = function(){ pickFontFile(); };
  const fontClear = $('#fontClear');
  if (fontClear) fontClear.onclick = function(){ clearCustomFont(); };
  const fontScope = $('#fontScope');
  if (fontScope) fontScope.addEventListener('click', function(e){
    const b = e.target.closest('[data-scope]');
    if (!b) return;
    setFontScope(b.getAttribute('data-scope'));
    $$('[data-scope]', fontScope).forEach(function(x){ x.classList.toggle('on', x === b); });
  });

  const scriptEntry = $('#scriptEntry');
  if (scriptEntry) scriptEntry.onclick = function(){ NAV.scriptFrom = 'settings'; go('script'); };
  const di = $('#dataImport');
  if (di) di.onclick = function(){ pickImportFile(); };
  const de = $('#dataExport');
  if (de) de.onclick = function(){ exportData(); };
  const dr = $('#dataReset');
  if (dr) dr.onclick = function(){
    confirmDialog({ title: '重置所有抽奖进度？', desc: '所有转盘的「已抽」记录都会清空，转盘本身保留。', ok: '重置', danger: true }).then(function(ok){
      if (!ok) return;
      db.wheels.forEach(function(w){ w.drawn = []; });
      save();
      toast('已重置全部抽奖进度');
    });
  };
  const dtf = $('#dataTtsFiles');
  if (dtf) dtf.onclick = function(){ go('ttsfiles'); };
  const dc = $('#dataClear');
  if (dc) dc.onclick = function(){
    confirmDialog({ title: '清空全部转盘？', desc: '所有转盘、选项和跳转规则都会删除，且无法恢复。建议先导出备份。', ok: '全部删除', danger: true }).then(function(ok){
      if (!ok) return;
      db.wheels = [];
      db.categories = ['未分类'];
      NAV.category = 'all';
      save();
      go('home');
      toast('已清空');
    });
  };
  const ah = $('#aboutHelp');
  if (ah) ah.onclick = function(){ showHelp(); };

  $('#app').onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.getAttribute('data-action') === 'back') back();
  };
}
