/**
 * No-flash theme bootstrap.
 *
 * Runs synchronously inside `<head>` before React hydrates so the correct
 * `dark` class is on `<html>` before any pixels paint. Without this, users in
 * dark mode briefly see the light theme on every page load.
 *
 * Keep the inline body tiny and dependency-free — it must work even if
 * `localStorage` is locked down or `matchMedia` is unavailable.
 */
export function ThemeScript() {
  const code = `(function(){try{var k='bantuniaga.theme';var p=localStorage.getItem(k)||'system';var d=(p==='dark')||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark')}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
