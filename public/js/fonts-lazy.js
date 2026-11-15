(function () {
  var href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400..900&family=Cormorant+Garamond:ital,wght@0,500..700;1,500..700&family=Noto+Nastaliq+Urdu:wght@400..700&display=swap';
  function load() {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }
  function schedule() {
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 });
    else setTimeout(load, 2500);
  }
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
