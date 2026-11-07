import type { SearchResult } from '@/lib/types';

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[char];
  });
}

function resultLink(result: SearchResult): string {
  const query = new URLSearchParams({
    source: result.source,
    id: result.id,
    title: result.title,
    year: result.year || '',
    stype: result.episodes.length > 1 ? 'tv' : 'movie',
  });
  return '/play?' + query.toString();
}

function posterURL(value: unknown): string | null {
  const url = String(value || '');
  return /^https?:\/\/[^<>"']+$/i.test(url) ? url : null;
}

/** Self-contained HTML without client JavaScript, virtualization or SSE. */
export function renderTVSearchPage(
  query: string,
  results: SearchResult[],
  sourceCount: number,
  truncated: boolean
): string {
  const cards = results
    .map((result) => {
      const poster = posterURL(result.poster);
      const image = poster
        ? '<img class="poster" src="' +
          escapeHTML(poster) +
          '" alt="" loading="lazy">'
        : '<div class="poster empty">暂无海报</div>';
      const episodeLabel =
        result.episodes.length > 1 ? result.episodes.length + ' 集' : '电影';
      return (
        '<a class="card" href="' +
        escapeHTML(resultLink(result)) +
        '">' +
        image +
        '<div class="title">' +
        escapeHTML(result.title) +
        '</div>' +
        '<div class="detail">' +
        escapeHTML(
          result.year && result.year !== 'unknown' ? result.year : ''
        ) +
        ' · ' +
        escapeHTML(episodeLabel) +
        '</div><div class="source">' +
        escapeHTML(result.source_name) +
        '</div></a>'
      );
    })
    .join('');

  const message = !query
    ? '请输入片名，然后点击搜索。'
    : sourceCount === 0
    ? '当前账号没有可用的视频搜索源，请到管理后台检查。'
    : results.length === 0
    ? '没有找到结果，请尝试其他关键词或检查搜索源。'
    : '共显示 ' +
      results.length +
      ' 个结果' +
      (truncated ? '（结果较多，已限制显示数量）' : '');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>电视兼容搜索 - MoonTV</title>
<style>
html,body{margin:0;padding:0;background:#111827;color:#f3f4f6;font-family:Arial,"Microsoft Yahei",sans-serif;font-size:18px}
*{box-sizing:border-box}a{color:inherit;text-decoration:none}
header{padding:18px 24px;background:#1f2937}
header a{display:inline-block;margin-right:22px;color:#9ae6b4}
main{max-width:1380px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:24px;margin:8px 0 20px}
form{margin-bottom:22px}
input{width:65%;max-width:720px;min-height:50px;padding:10px 12px;border:2px solid #718096;border-radius:6px;font-size:20px;background:#fff;color:#111}
button{min-height:50px;padding:10px 25px;border:0;border-radius:6px;background:#16a34a;color:white;font-size:20px;cursor:pointer}
.note{margin:14px 0 22px;color:#cbd5e1;line-height:1.5}
.items{font-size:0}
.card{display:inline-block;vertical-align:top;width:195px;max-width:calc(50% - 16px);margin:0 16px 28px 0;font-size:16px;line-height:1.4}
.card:focus,.card:hover{outline:3px solid #4ade80;border-radius:4px}
.poster{display:block;width:100%;height:262px;object-fit:cover;background:#374151;border-radius:6px;color:#cbd5e1}
.empty{text-align:center;padding-top:100px}
.title{margin:10px 0 4px;font-weight:bold;overflow-wrap:break-word}
.detail,.source{font-size:14px;color:#9ca3af;margin-top:4px}
@media(max-width:640px){.card{width:calc(50% - 16px)}.poster{height:210px}input{width:65%;font-size:16px}button{padding:8px 12px;font-size:16px}}
</style>
</head>
<body>
<header><a href="/">返回首页</a><a href="/search">标准搜索</a><strong>MoonTV 电视兼容模式</strong></header>
<main>
<h1>电视兼容搜索</h1>
<form action="/tv/search" method="get">
<input type="search" name="q" aria-label="影片名称" placeholder="输入电影或电视剧名称" value="${escapeHTML(
    query
  )}" maxlength="100" required>
<button type="submit">搜索</button>
</form>
<div class="note">${escapeHTML(
    message
  )}（已启用无需 JavaScript 的普通搜索）</div>
<div class="items">${cards}</div>
</main>
</body>
</html>`;
}
