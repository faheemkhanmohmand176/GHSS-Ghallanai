(function () {
  try {
    var raw = localStorage.getItem('ghss-school-settings-v1');
    if (!raw) return;
    var s = JSON.parse(raw);
    var logo = s && s.logo_url;
    if (!logo || typeof logo !== 'string') return;
    if (logo.indexOf('res.cloudinary.com') === -1 || logo.indexOf('/upload/') === -1) return;
    // Don't double-insert transforms if the URL already has them.
    if (/\/upload\/(f_auto|q_auto|w_\d+)/i.test(logo)) return;
    var optimized = logo.replace('/upload/', '/upload/f_auto,q_auto,w_96/');
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = optimized;
    link.fetchpriority = 'high';
    document.head.appendChild(link);
  } catch (e) {}
})();
