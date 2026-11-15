(function () {
  try {
    var t = localStorage.getItem('ghss-theme');
    var root = document.documentElement;
    root.classList.remove('dark','theme-midnight','theme-forest','theme-violet','theme-lantern');
    if (t === 'dark' || t === 'midnight' || t === 'lantern') {
      root.classList.add('dark');
    } else {
      var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
    }
  } catch (e) {}
})();
