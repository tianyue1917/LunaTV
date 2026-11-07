/** @jest-environment jsdom */
import { renderTVSearchPage } from '@/lib/tv-search-html';

describe('TV native HTML search', () => {
  const results = [
    {
      id: 'a b',
      title: '影片 <script>alert(1)</script>',
      year: '2026',
      poster: 'https://example.test/poster.jpg',
      source: 'test-source',
      source_name: '测试来源',
      episodes: ['https://example.test/a.m3u8'],
      episodes_titles: ['第一集'],
    },
  ];

  it('renders results and a GET search form with no client JavaScript', () => {
    const html = renderTVSearchPage('影片', results, 1, false);
    document.documentElement.innerHTML = html;
    expect(document.querySelector('form')?.getAttribute('action')).toBe(
      '/tv/search'
    );
    expect(document.querySelector('form')?.getAttribute('method')).toBe('get');
    expect(document.querySelector('input[name="q"]')).not.toBeNull();
    expect(document.querySelector('.card')?.getAttribute('href')).toContain(
      'source=test-source'
    );
    expect(document.querySelector('.title')?.textContent).toContain(
      '<script>alert(1)</script>'
    );
    expect(document.querySelector('script')).toBeNull();
  });

  it('escapes hostile attributes and does not render non-HTTP poster URLs', () => {
    const html = renderTVSearchPage(
      '"<test>',
      [
        {
          ...results[0],
          poster: 'javascript:alert(1)',
          title: '<img src=x onerror=alert(1)>',
        },
      ],
      1,
      false
    );
    expect(html).toContain('&quot;&lt;test&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('src="javascript:');
  });
});
