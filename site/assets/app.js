document.querySelectorAll('.copy').forEach(function(btn){
  btn.addEventListener('click', function(){
    var text = btn.getAttribute('data-copy') || '';
    var done = function(){
      var old = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(function(){ btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function(){ fallback(text, done); });
    } else fallback(text, done);
  });
});
function fallback(text, done){
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch(e) {}
  document.body.removeChild(ta);
}
