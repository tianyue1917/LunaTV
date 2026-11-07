/**
 * Prefer predictable, non-virtualized rendering and JSON search on older
 * TV WebViews. This detection is client-only; it does not require settings
 * changes, new cookies, or modifications to the user's database.
 */
export function shouldUseTVCompatibilityMode(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent || '';
  const chromeVersion = /(?:Chrome|Chromium)\/(\d+)/.exec(ua);
  const oldChromium = chromeVersion !== null && Number(chromeVersion[1]) < 95;

  return Boolean(
    oldChromium ||
      /TV[ -]?Bro|MiTV|Android TV|SMART[- ]?TV|Tizen|Web0S|HbbTV|AFT[A-Z0-9]+/i.test(
        ua
      ) ||
      typeof window.ResizeObserver !== 'function' ||
      typeof window.EventSource !== 'function' ||
      typeof String.prototype.replaceAll !== 'function'
  );
}
