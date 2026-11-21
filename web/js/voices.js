/* ===== 音色克隆：电脑 / 手机本地 / 直连 ===== */
'use strict';

let voiceBlobs = {};

function voiceTarget(){ return db.settings.sovitsMode === 'phone' ? 'phone' : 'pc'; }
function targetName(t){ return t === 'phone' ? '手机本地' : '电脑服务器'; }
function voicesOf(t){ return (db.voices || []).filter(function(v){ return (v.target || 'pc') === t; }); }
function voiceURL(t){
  t = t || voiceTarget();
  let u = t === 'phone' ? (db.settings.phoneUrl || 'http://127.0.0.1:9881') : (db.settings.cloneUrl || '');
  u = String(u).trim();
  while (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}
function voiceHeaders(t){
  const k = t === 'phone' ? db.settings.phoneKey : db.settings.cloneKey;
  return k ? { 'X-API-Key': k } : {};
}

function voiceSummary(){
  const s = db.settings;
  if (s.sovitsMode === 'direct'){
    return s.sovitsUrl ? '直连 API · 已配置' : '直连 API · 未配置';
  }
  const t = voiceTarget();
  const v = activeVoice(t);
  const label = t === 'phone' ? '手机本地' : '电脑服务器';
  if (v) return label + ' · 使用中：' + v.name;
  if (voiceURL(t)) return label + ' · 还没有可用音色';
  return label + ' · 未配置';
}

function renderVoices(){
  const s = db.settings;
  const mode = s.sovitsMode === 'phone' ? 'phone' : (s.sovitsMode === 'direct' ? 'direct' : 'pc');
  const t = mode === 'phone' ? 'phone' : 'pc';
  const isDirect = mode === 'direct';
  const list = voicesOf(t);
  const activeId = db.activeVoiceIds ? db.activeVoiceIds[t] : '';

  const voiceCards = list.map(function(v){
    const active = activeId === v.id;
    const initial = (v.name || '音').trim().slice(0, 1) || '音';
    const status = v.uploading ? '上传中…' : (v.uploaded ? '已上传到服务器' : (v.uploadError ? '上传失败' : '待上传'));
    return '<div class="voice-card' + (active ? ' active' : '') + '" data-id="' + esc(v.id) + '">' +
      '<div class="voice-avatar">' + esc(initial) + '</div>' +
      '<div class="grow">' +
        '<div class="voice-name">' + esc(v.name || '未命名音色') +
          (active ? '<span class="tag accent">使用中</span>' : '') +
          (v.uploaded ? '<span class="tag">已上传</span>' : '') + '</div>' +
        '<div class="voice-meta">' + esc(status) + (v.promptText ? ' · ' + esc(v.promptText.slice(0, 18)) : '') + '</div>' +
        '<div class="voice-file">' + esc(v.fileName || '参考音频') + '</div>' +
      '</div>' +
      '<button class="voice-more" data-more="' + esc(v.id) + '" aria-label="操作">' + ICON.more + '</button>' +
    '</div>';
  }).join('');

  const url = voiceURL(t);
  const key = t === 'phone' ? s.phoneKey : s.cloneKey;

  const serverCard = isDirect ? '' :
    '<div class="section-label">' + (t === 'phone' ? '手机本地服务' : '电脑服务器') + '</div>' +
    '<div class="card-box" style="margin-bottom:14px">' +
      '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:7px">' +
        '<div class="lr-title">' + (t === 'phone' ? '本地地址' : '克隆服务器地址') + '</div>' +
        '<input id="' + (t === 'phone' ? 'phoneUrl' : 'cloneUrl') + '" type="url" inputmode="url" autocapitalize="off" spellcheck="false" value="' + esc(t === 'phone' ? (s.phoneUrl || 'http://127.0.0.1:9881') : s.cloneUrl) + '" placeholder="http://127.0.0.1:9881"' +
          ' style="width:100%;border:none;outline:none;background:var(--pill);border-radius:9px;padding:9px 10px;font-size:14px;font-weight:600">' +
        '<div class="lr-sub">' + (t === 'phone' ? '在手机 Termux/Ubuntu 里启动 GPT-SoVITS 与 clone_server.py，地址保持 127.0.0.1:9881。' : '电脑上运行 clone_server.py，端口默认 9881；手机和电脑需在同一局域网。') + '</div>' +
      '</div>' +
      '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:7px">' +
        '<div class="lr-title">访问密钥（可选）</div>' +
        '<input id="' + (t === 'phone' ? 'phoneKey' : 'cloneKey') + '" type="text" autocapitalize="off" spellcheck="false" value="' + esc(key) + '" placeholder="服务器设置了 --api-key 才需要填"' +
          ' style="width:100%;border:none;outline:none;background:var(--pill);border-radius:9px;padding:9px 10px;font-size:14px;font-weight:600">' +
      '</div>' +
      '<button class="line-row link" id="cloneTest" style="width:100%;text-align:left">' +
        '<div class="lr-main"><div class="lr-title">测试连接</div><div class="lr-sub" id="cloneStatus">检查地址、密钥和 GPT-SoVITS 是否在线</div></div>' +
        ICON.refresh + '</button>' +
      (t === 'phone' ? '<button class="line-row link" id="localHelp" style="width:100%;text-align:left">' +
        '<div class="lr-main"><div class="lr-title">手机本地部署步骤</div><div class="lr-sub">Termux / Ubuntu + GPT-SoVITS + 本地服务</div></div>' +
        ICON.info + '</button>' : '') +
    '</div>' +
    (t === 'phone' ? '<div class="voice-warn">手机本地需要额外安装 Termux/Ubuntu 与 GPT-SoVITS 模型，占 2–5GB；本机内存/存储不足时可能很慢。App 只负责连接，不会自动启动本地服务。</div>' : '');

  const deployCard = isDirect ? '' :
    '<div class="section-label">' + (t === 'phone' ? '本地部署' : '服务器部署') + '</div>' +
    '<div class="card-box" style="margin-bottom:14px">' +
      '<button class="line-row link" id="deployOpen" style="width:100%;text-align:left">' +
        '<div class="lr-main"><div class="lr-title">打开部署页面</div><div class="lr-sub">' + esc(s.deployUrl || 'https://gptsovit.rainstone103.top') + '</div></div>' +
        ICON.chevRight + '</button>' +
      '<button class="line-row link" id="deployHelp" style="width:100%;text-align:left">' +
        '<div class="lr-main"><div class="lr-title">' + (t === 'phone' ? '本地部署说明' : '电脑部署说明') + '</div><div class="lr-sub">' + (t === 'phone' ? '手机不能直接安装 APK 就跑模型' : '手机不能直接跑 GPT-SoVITS，需要电脑') + '</div></div>' +
        ICON.info + '</button>' +
    '</div>';

  const directCard = isDirect ?
    '<div class="section-label">直连 GPT-SoVITS</div>' +
    '<div class="card-box" style="margin-bottom:14px">' +
      '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:7px">' +
        '<div class="lr-title">服务器地址</div>' +
        '<input id="sovitsUrl" type="url" inputmode="url" autocapitalize="off" spellcheck="false" value="' + esc(s.sovitsUrl) + '" placeholder="http://192.168.1.10:9880"' +
          ' style="width:100%;border:none;outline:none;background:var(--pill);border-radius:9px;padding:9px 10px;font-size:14px;font-weight:600">' +
        '<div class="lr-sub">官方 api_v2.py，加 -a 0.0.0.0 启动；手机和电脑需在同一网络。</div>' +
      '</div>' +
      '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:7px">' +
        '<div class="lr-title">参考音频路径</div>' +
        '<input id="sovitsRef" type="text" autocapitalize="off" spellcheck="false" value="' + esc(s.sovitsRef) + '" placeholder="archive/ref.wav"' +
          ' style="width:100%;border:none;outline:none;background:var(--pill);border-radius:9px;padding:9px 10px;font-size:14px;font-weight:600">' +
        '<div class="lr-sub">填 GPT-SoVITS 所在电脑上的路径（或可访问 URL），不是手机路径。</div>' +
      '</div>' +
      '<div class="line-row" style="flex-direction:column;align-items:stretch;gap:7px">' +
        '<div class="lr-title">参考文本</div>' +
        '<input id="sovitsPrompt" type="text" maxlength="120" value="' + esc(s.sovitsPromptText) + '" placeholder="参考音频里说的那句话"' +
          ' style="width:100%;border:none;outline:none;background:var(--pill);border-radius:9px;padding:9px 10px;font-size:14px;font-weight:600">' +
      '</div>' +
      '<div class="line-row" style="gap:10px">' +
        '<div class="grow"><div class="lr-title">参考语言</div>' +
          '<select id="promptLang" style="width:100%;border:none;outline:none;background:transparent;font-size:14px;font-weight:600;margin-top:4px">' + langOptions(s.sovitsPromptLang) + '</select></div>' +
        '<div class="grow"><div class="lr-title">朗读语言</div>' +
          '<select id="textLang" style="width:100%;border:none;outline:none;background:transparent;font-size:14px;font-weight:600;margin-top:4px">' + langOptions(s.sovitsTextLang) + '</select></div>' +
      '</div>' +
      '<div class="line-row">' +
        '<div class="grow"><div class="lr-title">文本切分</div></div>' +
        '<select id="sovitsSplit" style="border:none;outline:none;background:transparent;font-size:13.5px;font-weight:600;max-width:52%">' + splitOptions(s.sovitsSplit) + '</select>' +
      '</div>' +
      '<button class="line-row link" id="sovitsTest" style="width:100%;text-align:left">' +
        '<div class="lr-main"><div class="lr-title">试听直连音色</div><div class="lr-sub">' + (NATIVE ? '请求 GPT-SoVITS 合成测试语音' : '浏览器预览无法调用，请在 App 内试听') + '</div></div>' +
        ICON.mic + '</button>' +
    '</div>' +
    '<p class="tiny muted" style="margin:8px 6px 0;line-height:1.6">直连模式需要服务器上已有参考音频，只能在电脑管理；想在手机上传录音请选「电脑服务器」或「手机本地」。</p>' : '';

  const app = $('#app');
  app.innerHTML =
  '<div class="page">' +
    '<div class="topbar">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div style="font-size:20px;font-weight:800">音色克隆</div>' +
      '<div class="spacer"></div>' +
      '<button class="icon-btn" data-action="help" aria-label="说明">' + ICON.info + '</button>' +
    '</div>' +
    '<div class="form-page">' +
      '<p class="small muted" style="margin:4px 4px 14px;line-height:1.6">上传 3～10 秒清晰人声作为参考音频；电脑服务器和手机本地各保存一套音色，互不冲突。</p>' +
      '<div class="segmented" id="voiceModeSeg" style="margin-bottom:14px">' +
        '<button data-mode="pc" class="' + (mode === 'pc' ? 'on' : '') + '">电脑服务器</button>' +
        '<button data-mode="phone" class="' + (mode === 'phone' ? 'on' : '') + '">手机本地</button>' +
        '<button data-mode="direct" class="' + (mode === 'direct' ? 'on' : '') + '">直连 API</button>' +
      '</div>' +
      serverCard +
      (isDirect ? '' :
        '<div class="row" style="margin:18px 4px 8px"><div class="section-label" style="margin:0;flex:1">我的音色 · ' + (t === 'phone' ? '手机本地' : '电脑服务器') + '</div>' +
          '<span class="tiny muted">' + list.length + ' 个</span></div>' +
        (list.length ? '<div class="voice-list">' + voiceCards + '</div>' :
          '<div class="voice-empty">' +
            '<div class="voice-empty-icon">' + ICON.mic + '</div>' +
            '<div class="voice-empty-title">还没有音色</div>' +
            '<div class="tiny muted" style="line-height:1.6">选一段 3～10 秒录音，填写录音里说的那句话，上传到' + (t === 'phone' ? '手机本地服务' : '电脑服务器') + '。</div>' +
          '</div>') +
        '<button class="btn block" data-action="add" style="height:54px;margin-top:14px">' + ICON.plus + ' 添加音色（上传参考音频）</button>' +
        '<p class="tiny muted" style="margin:10px 6px 0;line-height:1.6">提示：参考音频越干净、参考文本越准确，克隆效果越好。音频只保存在对应服务器上，App 保留一份用于重传。</p>') +
      directCard +
      deployCard +
      '<div style="height:24px"></div>' +
    '</div>' +
  '</div>';

  bindVoices(t, isDirect);
}

function bindVoices(t, isDirect){
  const root = $('#app');
  const s = db.settings;
  root.onclick = function(e){
    const el = e.target.closest('[data-action]');
    if (el){
      const a = el.getAttribute('data-action');
      if (a === 'back') back();
      else if (a === 'help') showVoiceHelp();
      else if (a === 'add') pickAudioFile();
      return;
    }
    const more = e.target.closest('[data-more]');
    if (more){ e.stopPropagation(); openVoiceMenu(more.getAttribute('data-more')); return; }
    const card = e.target.closest('.voice-card');
    if (card) activateVoice(card.getAttribute('data-id'));
  };

  $('#voiceModeSeg').addEventListener('click', function(e){
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    const m = b.getAttribute('data-mode');
    s.sovitsMode = m === 'phone' ? 'phone' : (m === 'direct' ? 'direct' : 'pc');
    save();
    const y = window.scrollY;
    renderVoices();
    window.scrollTo(0, y);
  });

  if (!isDirect){
    const isPhone = t === 'phone';
    const urlEl = $('#cloneUrl') || $('#phoneUrl');
    if (urlEl) urlEl.addEventListener('input', function(){
      if (isPhone) s.phoneUrl = urlEl.value.trim(); else s.cloneUrl = urlEl.value.trim();
      save();
    });
    const keyEl = $('#cloneKey') || $('#phoneKey');
    if (keyEl) keyEl.addEventListener('input', function(){
      if (isPhone) s.phoneKey = keyEl.value.trim(); else s.cloneKey = keyEl.value.trim();
      save();
    });
    const test = $('#cloneTest');
    if (test) test.onclick = function(){ testCloneServer(t); };
    const lh = $('#localHelp');
    if (lh) lh.onclick = showLocalHelp;
  } else {
    const url = $('#sovitsUrl');
    if (url) url.addEventListener('input', function(){ s.sovitsUrl = url.value.trim(); save(); });
    const ref = $('#sovitsRef');
    if (ref) ref.addEventListener('input', function(){ s.sovitsRef = ref.value.trim(); save(); });
    const pt = $('#sovitsPrompt');
    if (pt) pt.addEventListener('input', function(){ s.sovitsPromptText = pt.value; save(); });
    const pl = $('#promptLang');
    if (pl) pl.addEventListener('change', function(){ s.sovitsPromptLang = pl.value; save(); });
    const tl = $('#textLang');
    if (tl) tl.addEventListener('change', function(){ s.sovitsTextLang = tl.value; save(); });
    const sp = $('#sovitsSplit');
    if (sp) sp.addEventListener('change', function(){ s.sovitsSplit = sp.value; save(); });
    const st = $('#sovitsTest');
    if (st) st.onclick = testDirectVoice;
  }

  const du = $('#deployOpen');
  if (du) du.onclick = openDeployPage;
  const dh = $('#deployHelp');
  if (dh) dh.onclick = t === 'phone' ? showLocalHelp : showDeployHelp;
}

function activateVoice(id){
  const v = (db.voices || []).find(function(x){ return x.id === id; });
  if (!v) return;
  if (!v.uploaded){ toast('这个音色还没有上传，先点右侧「⋯」上传'); return; }
  const t = v.target || 'pc';
  if (!db.activeVoiceIds) db.activeVoiceIds = { pc: '', phone: '' };
  db.activeVoiceIds[t] = v.id;
  db.settings.ttsEngine = 'sovits';
  save();
  renderVoices();
  toast('已切换到' + targetName(t) + '「' + v.name + '」');
}

function openVoiceMenu(id){
  const v = (db.voices || []).find(function(x){ return x.id === id; });
  if (!v) return;
  const ov = openSheet(
    '<h3>' + esc(v.name || '音色') + '</h3><div class="action-list">' +
      (v.uploaded ? '<button class="action-item" data-m="use">' + ICON.check + ' 设为当前音色</button>' : '') +
      (v.uploaded ? '<button class="action-item" data-m="test">' + ICON.speaker + ' 试听这个音色</button>' : '') +
      '<button class="action-item" data-m="upload">' + ICON.upload + ' ' + (v.uploaded ? '重新上传参考音频' : '上传到服务器') + '</button>' +
      '<button class="action-item" data-m="rename">' + ICON.edit + ' 编辑名称和参考文本</button>' +
      '<div class="action-sep"></div>' +
      '<button class="action-item danger" data-m="del">' + ICON.trash + ' 删除音色</button>' +
    '</div>', {});
  $$('[data-m]', ov).forEach(function(b){
    b.onclick = function(){
      const m = b.getAttribute('data-m');
      closeOverlay(true);
      if (m === 'use') activateVoice(v.id);
      else if (m === 'test') testVoice(v);
      else if (m === 'upload') uploadVoice(v);
      else if (m === 'rename') editVoice(v);
      else if (m === 'del') deleteVoice(v);
    };
  });
}

function pickAudioFile(){
  if (NATIVE && NATIVE.pickAudio){
    try { NATIVE.pickAudio(); toast('请选择 3～10 秒的参考音频', 2400); } catch(e){ toast('无法打开文件选择器'); }
    return;
  }
  let inp = $('#webAudioInput');
  if (!inp){
    inp = document.createElement('input');
    inp.type = 'file';
    inp.id = 'webAudioInput';
    inp.accept = 'audio/*,.wav,.mp3,.m4a,.ogg,.flac';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', function(){
      const f = inp.files && inp.files[0];
      if (!f) return;
      openVoiceForm({ name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, localPath: '', file: f });
      inp.value = '';
    });
  }
  inp.click();
}

window.__onAudioPicked = function(path, name){
  if (window.__customTtsAudioCb){ const cb = window.__customTtsAudioCb; window.__customTtsAudioCb = null; cb(path, name); return; }
  openVoiceForm({ name: String(name || '我的音色').replace(/\.[^.]+$/, ''), fileName: name || '参考音频', localPath: path || '' });
};

function openVoiceForm(ctx){
  const editing = ctx && ctx.voice;
  const v = editing ? ctx.voice : null;
  const t = v ? (v.target || 'pc') : voiceTarget();
  const ov = openSheet(
    '<h3>' + (editing ? '编辑音色' : '添加音色') + '</h3>' +
    '<p class="desc">' + targetName(t) + ' · 参考音频：' + esc(ctx.fileName || '') + '</p>' +
    '<div class="field"><label>音色名称</label><input id="vfName" type="text" maxlength="20" value="' + esc(v ? v.name : (ctx.name || '')) + '" placeholder="例如：我的声音"></div>' +
    '<div class="field"><label>参考文本</label><input id="vfPrompt" type="text" maxlength="120" value="' + esc(v ? v.promptText : '') + '" placeholder="参考音频里说的那句话"><div class="hint">必须和录音内容一致，克隆才准确；建议 3～10 秒。</div></div>' +
    '<div class="line-row" style="gap:10px;padding:0 0 6px">' +
      '<div class="grow"><div class="tiny muted" style="margin-bottom:4px">参考语言</div>' +
        '<select id="vfPromptLang" style="width:100%;border:none;outline:none;background:var(--pill);border-radius:10px;padding:9px;font-size:14px;font-weight:600">' + langOptions(v ? v.promptLang : 'zh') + '</select></div>' +
      '<div class="grow"><div class="tiny muted" style="margin-bottom:4px">朗读语言</div>' +
        '<select id="vfTextLang" style="width:100%;border:none;outline:none;background:var(--pill);border-radius:10px;padding:9px;font-size:14px;font-weight:600">' + langOptions(v ? v.textLang : 'zh') + '</select></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn" id="vfCancel">取消</button><button class="btn primary" id="vfSave">' + (editing ? '保存' : '保存并上传') + '</button></div>',
    { center: true });
  $('#vfCancel', ov).onclick = function(){ closeOverlay(true); };
  $('#vfSave', ov).onclick = function(){
    const name = $('#vfName', ov).value.trim() || '我的音色';
    const prompt = $('#vfPrompt', ov).value.trim();
    if (!prompt){ toast('请填写参考文本（录音里说的那句话）'); return; }
    const promptLang = $('#vfPromptLang', ov).value;
    const textLang = $('#vfTextLang', ov).value;
    if (editing){
      v.name = name; v.promptText = prompt; v.promptLang = promptLang; v.textLang = textLang;
      v.uploaded = false; v.serverId = ''; v.uploadError = '';
      save();
      closeOverlay(true);
      renderVoices();
      if (voiceURL(v.target || 'pc')) uploadVoice(v);
      return;
    }
    const nv = {
      id: uid('v'),
      name: name,
      promptText: prompt,
      promptLang: promptLang,
      textLang: textLang,
      target: t,
      localPath: ctx.localPath || '',
      fileName: ctx.fileName || '',
      uploaded: false,
      serverId: '',
      serverPath: '',
      uploadError: '',
      createdAt: Date.now()
    };
    if (ctx.file) voiceBlobs[nv.id] = ctx.file;
    db.voices.push(nv);
    if (!db.activeVoiceIds) db.activeVoiceIds = { pc: '', phone: '' };
    if (!db.activeVoiceIds[t]) db.activeVoiceIds[t] = nv.id;
    save();
    closeOverlay(true);
    renderVoices();
    if (voiceURL(t)) uploadVoice(nv, ctx.file);
    else toast('已保存到本机，填好服务器地址后再点上传');
  };
  setTimeout(function(){ const i = $('#vfName', ov); if (i) { i.focus(); i.select(); } }, 100);
}

function uploadVoice(v, file){
  const t = v.target || 'pc';
  const url = voiceURL(t);
  if (!url){ toast('先填写' + targetName(t) + '地址'); return; }
  v.uploadError = '';
  v.uploading = true;
  save();
  renderVoices();
  if (NATIVE && NATIVE.uploadVoice && v.localPath){
    try {
      NATIVE.uploadVoice(JSON.stringify({
        clientId: v.id, url: url, key: t === 'phone' ? (db.settings.phoneKey || '') : (db.settings.cloneKey || ''),
        name: v.name, promptText: v.promptText, promptLang: v.promptLang,
        textLang: v.textLang, audioPath: v.localPath, fileName: v.fileName
      }));
      toast('正在上传参考音频到' + targetName(t) + '…', 2800);
    } catch(e){ v.uploading = false; v.uploadError = e.message; save(); renderVoices(); }
    return;
  }
  const blob = file || voiceBlobs[v.id];
  if (!blob){ v.uploading = false; toast('浏览器预览没有音频文件，请在 App 内上传'); save(); renderVoices(); return; }
  webUploadVoice(v, blob);
}

async function webUploadVoice(v, blob){
  const t = v.target || 'pc';
  const url = voiceURL(t);
  try {
    const fd = new FormData();
    fd.append('name', v.name);
    fd.append('prompt_text', v.promptText);
    fd.append('prompt_lang', v.promptLang);
    fd.append('text_lang', v.textLang);
    fd.append('audio', blob, v.fileName || 'ref.wav');
    const r = await fetch(url + '/voices', { method: 'POST', headers: voiceHeaders(t), body: fd });
    const text = await r.text();
    if (!r.ok) throw new Error(parseServerError(text) || ('HTTP ' + r.status));
    const o = JSON.parse(text);
    v.uploading = false;
    v.uploaded = true;
    v.serverId = o.id || '';
    v.serverPath = o.path || '';
    if (!db.activeVoiceIds) db.activeVoiceIds = { pc: '', phone: '' };
    if (!db.activeVoiceIds[t]) db.activeVoiceIds[t] = v.id;
    db.settings.ttsEngine = 'sovits';
    save();
    if (NAV.page === 'voices') renderVoices();
    toast('音色已上传并可用');
  } catch(e){
    v.uploading = false;
    v.uploadError = e.message;
    v.uploaded = false;
    save();
    if (NAV.page === 'voices') renderVoices();
    toast('上传失败：' + e.message, 3600);
  }
}

window.__onVoiceUploaded = function(ok, clientId, data, msg){
  const v = (db.voices || []).find(function(x){ return x.id === clientId; });
  if (v){
    v.uploading = false;
    const t = v.target || 'pc';
    if (ok){
      try {
        const o = JSON.parse(data || '{}');
        v.uploaded = true;
        v.serverId = o.id || '';
        v.serverPath = o.path || '';
        v.uploadError = '';
        if (!db.activeVoiceIds) db.activeVoiceIds = { pc: '', phone: '' };
        if (!db.activeVoiceIds[t]) db.activeVoiceIds[t] = v.id;
        db.settings.ttsEngine = 'sovits';
      } catch(e){
        v.uploaded = false;
        v.uploadError = '服务器返回异常';
      }
    } else {
      v.uploaded = false;
      v.uploadError = msg || '上传失败';
    }
    save();
  }
  if (NAV.page === 'voices') renderVoices();
  toast(ok ? '音色已上传并可用' : ('上传失败：' + (msg || '未知错误')), 3200);
};

function editVoice(v){ openVoiceForm({ voice: v, fileName: v.fileName, localPath: v.localPath }); }

function deleteVoice(v){
  confirmDialog({ title: '删除「' + esc(v.name) + '」？', desc: '会同时删除服务器上的音色和手机里的参考音频，无法恢复。', ok: '删除', danger: true }).then(function(ok){
    if (!ok) return;
    const t = v.target || 'pc';
    if (v.serverId && voiceURL(t) && NATIVE && NATIVE.deleteVoice){
      try {
        NATIVE.deleteVoice(JSON.stringify({ url: voiceURL(t), key: t === 'phone' ? (db.settings.phoneKey || '') : (db.settings.cloneKey || ''), voiceId: v.serverId, clientId: v.id }));
      } catch(e){}
    }
    if (v.localPath && NATIVE && NATIVE.deleteAudio){ try { NATIVE.deleteAudio(v.localPath); } catch(e){} }
    if (voiceBlobs[v.id]){ try { delete voiceBlobs[v.id]; } catch(e){} }
    db.voices = db.voices.filter(function(x){ return x.id !== v.id; });
    if (db.activeVoiceIds && db.activeVoiceIds[t] === v.id) db.activeVoiceIds[t] = '';
    save();
    renderVoices();
    toast('已删除音色');
  });
}

function testVoice(v){
  if (!v.uploaded || !v.serverId){ toast('先上传这个音色'); return; }
  const t = v.target || 'pc';
  const url = voiceURL(t);
  if (!url){ toast('先填写' + targetName(t) + '地址'); return; }
  const payload = { url: url, key: t === 'phone' ? (db.settings.phoneKey || '') : (db.settings.cloneKey || ''), voiceId: v.serverId, text: '你好，这是云海转盘的音色克隆测试。', fallback: '', speed: db.settings.ttsRate || 1 };
  if (NATIVE && NATIVE.cloneSpeak){
    window.__cloneTestPending = true;
    stopSpeech();
    try { NATIVE.cloneSpeak(JSON.stringify(payload)); toast('正在生成克隆语音…', 2600); } catch(e){ toast('请求失败：' + e.message); }
    return;
  }
  webCloneSpeak(payload);
}

function testCloneServer(t){
  const url = voiceURL(t);
  if (!url){ toast('先填写' + targetName(t) + '地址'); return; }
  const key = t === 'phone' ? (db.settings.phoneKey || '') : (db.settings.cloneKey || '');
  if (NATIVE && NATIVE.testCloneServer){
    try { NATIVE.testCloneServer(JSON.stringify({ url: url, key: key })); toast('正在连接' + targetName(t) + '…', 2200); } catch(e){ toast('连接失败'); }
    return;
  }
  fetch(url + '/health', { headers: voiceHeaders(t) }).then(async function(r){
    const txt = await r.text();
    window.__onCloneHealth(r.ok, txt, 'HTTP ' + r.status);
  }).catch(function(e){ window.__onCloneHealth(false, '', e.message); });
}

window.__onCloneHealth = function(ok, body, msg){
  let text = '连接失败';
  if (ok){
    try {
      const o = JSON.parse(body || '{}');
      text = '服务器正常' + (o.gpt_sovits ? (' · GPT-SoVITS ' + (o.gpt_sovits === 'up' ? '在线' : '离线')) : '');
    } catch(e){ text = '服务器正常'; }
  }
  const el = $('#cloneStatus');
  if (el){
    el.textContent = ok ? text : ('连接失败：' + (msg || '检查地址和密钥'));
    el.className = 'lr-sub ' + (ok ? 'ok' : 'danger');
  }
  toast(ok ? text : ('连接失败：' + (msg || '检查地址')), 3200);
};

window.__onVoiceDeleted = function(ok, clientId, msg){
  if (!ok) toast('服务器删除失败：' + (msg || ''), 3000);
};

function testDirectVoice(){
  const s = db.settings;
  if (!s.sovitsUrl){ toast('先填写 GPT-SoVITS 服务器地址'); return; }
  if (!NATIVE || !NATIVE.sovits){ toast('浏览器预览无法调用，请在 App 内试听'); return; }
  stopSpeech();
  try {
    NATIVE.sovits(JSON.stringify(sovitsPayload('你好，这是云海转盘的克隆音色测试。')));
    toast('正在请求克隆语音，请稍候…', 2600);
  } catch(e){ toast('请求失败：' + e.message); }
}

function parseServerError(text){
  try { const o = JSON.parse(text); return o.message || o.detail || o.error || ''; } catch(e){}
  return String(text || '').slice(0, 120);
}

async function webCloneSpeak(payload){
  try {
    const q = new URLSearchParams({ text: payload.text, voice_id: payload.voiceId, speed_factor: String(payload.speed || 1) });
    const r = await fetch(payload.url + '/tts?' + q.toString(), { headers: payload.key ? { 'X-API-Key': payload.key } : {} });
    if (!r.ok){
      const t = await r.text();
      throw new Error(parseServerError(t) || ('HTTP ' + r.status));
    }
    const blob = await r.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play().catch(function(){});
    window.__cloneTestPending = false;
  } catch(e){
    toast('克隆语音失败：' + e.message, 3200);
    if (payload.fallback) speakSystem(payload.fallback);
  }
}

function openDeployPage(){
  const url = (db.settings.deployUrl || 'https://gptsovit.rainstone103.top').trim();
  if (NATIVE && NATIVE.openUrl){ try { NATIVE.openUrl(url); return; } catch(e){} }
  try { window.open(url, '_blank'); } catch(e){ toast('无法打开链接'); }
}

function showDeployHelp(){
  openSheet(
    '<h3>部署电脑克隆服务器</h3>' +
    '<div class="rule-flow" style="line-height:1.85">' +
    '手机 App 只负责连接，GPT-SoVITS 需要跑在电脑或服务器上。<br><br>' +
    '<b>1.</b> 打开部署页面，下载 <b>克隆服务包</b>，并准备官方 GPT-SoVITS。<br>' +
    '<b>2.</b> 把克隆服务包放到 GPT-SoVITS 旁边，运行一键启动脚本。<br>' +
    '<b>3.</b> 在 App 里填 <b>http://电脑IP:9881</b>，测试连接。<br>' +
    '<b>4.</b> 添加音色，上传 3～10 秒参考音频和对应文本。<br><br>' +
    '电脑和手机需在同一局域网。' +
    '</div><div class="modal-actions"><button class="btn" id="dhClose">关闭</button><button class="btn primary" id="dhOpen">打开部署页面</button></div>',
    { center: true });
  $('#dhClose').onclick = function(){ closeOverlay(true); };
  $('#dhOpen').onclick = function(){ closeOverlay(true); openDeployPage(); };
}

function showLocalHelp(){
  openSheet(
    '<h3>手机本地 GPT-SoVITS</h3>' +
    '<div class="rule-flow" style="line-height:1.8">' +
    '需要先在手机里准备一个 Linux 环境（Termux 或本机 Ubuntu），再运行 GPT-SoVITS 与 clone_server.py。App 不能直接启动它们。<br><br>' +
    '<b>1.</b> Termux 安装：<code>pkg install python ffmpeg git</code><br>' +
    '<b>2.</b> 安装 GPT-SoVITS 及模型（和电脑相同）。<br>' +
    '<b>3.</b> 启动 <code>api_v2.py -a 127.0.0.1 -p 9880</code>。<br>' +
    '<b>4.</b> 启动 <code>clone_server.py --host 127.0.0.1 --port 9881 --gpt http://127.0.0.1:9880</code>。<br>' +
    '<b>5.</b> 回到这里，地址保持 <code>http://127.0.0.1:9881</code>，测试连接。<br><br>' +
    '<b style="color:#D8402F">注意：</b>手机没有 GPU，GPT-SoVITS CPU 合成可能几十秒一句；本机当前剩余空间/内存也不宽裕。电脑服务器仍然更快更稳。' +
    '</div><div class="modal-actions"><button class="btn" id="lhClose">关闭</button><button class="btn primary" id="lhOpen">打开部署页面</button></div>',
    { center: true });
  $('#lhClose').onclick = function(){ closeOverlay(true); };
  $('#lhOpen').onclick = function(){ closeOverlay(true); openDeployPage(); };
}

function showVoiceHelp(){
  openSheet(
    '<h3>音色克隆说明</h3>' +
    '<div class="rule-flow" style="line-height:1.85">' +
    '<b>三种方式</b>：电脑服务器 / 手机本地 / 直连 API。电脑和手机各保存一套音色，互不冲突。<br><br>' +
    '<b>参考音频</b>：3～10 秒、单人、无背景音乐、尽量清晰。<br><br>' +
    '<b>参考文本</b>：录音里逐字说的内容，必须一致。<br><br>' +
    '<b>手机本地</b>：需要 Termux/Ubuntu + GPT-SoVITS + clone_server，手机没有 GPU，速度较慢。<br><br>' +
    '<b>失败回退</b>：服务器离线或合成失败时，会自动改用系统 TTS 朗读。' +
    '</div><div class="modal-actions"><button class="btn primary" id="vhClose">知道了</button></div>',
    { center: true });
  $('#vhClose').onclick = function(){ closeOverlay(true); };
}
