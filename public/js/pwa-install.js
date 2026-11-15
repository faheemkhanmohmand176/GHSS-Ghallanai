(function () {
  window.__pwaInstallEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__pwaInstallEvent = e;
    window.dispatchEvent(new Event('pwa-install-available'));
  });
  window.addEventListener('appinstalled', function () {
    window.__pwaInstallEvent = null;
    window.dispatchEvent(new Event('pwa-installed'));
  });
})();
