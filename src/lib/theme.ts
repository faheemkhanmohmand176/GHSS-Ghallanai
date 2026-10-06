/**
 * Theme system — Master Plan §5.3.
 * data-theme="bright" | "dark" on <html>. Inline head script reads
 * localStorage + system preference BEFORE first paint (no wrong-theme flash).
 * Manual override persists per device.
 */
export const THEME_STORAGE_KEY = "ghss-theme";
export type Theme = "bright" | "dark";

export const themeInitScript = `
(function(){try{
  var t = localStorage.getItem('${THEME_STORAGE_KEY}');
  if (t !== 'bright' && t !== 'dark') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'bright';
  }
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
}catch(e){
  document.documentElement.setAttribute('data-theme','bright');
}})();
`;
