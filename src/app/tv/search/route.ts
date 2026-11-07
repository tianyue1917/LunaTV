import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { renderTVSearchPage } from '@/lib/tv-search-html';
import type { SearchResult } from '@/lib/types';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function searchTV(
  query: string,
  username: string
): Promise<{
  results: SearchResult[];
  sourceCount: number;
  truncated: boolean;
}> {
  const [config, sites] = await Promise.all([
    getConfig(),
    getAvailableApiSites(username),
  ]);

  // Each source has a bounded wait. One offline source must not freeze the TV.
  const batches = await Promise.all(
    sites.map(async (site): Promise<SearchResult[]> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          searchFromApi(site, query),
          new Promise<SearchResult[]>((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), 14000);
          }),
        ]);
      } catch {
        return [];
      } finally {
        if (timer) clearTimeout(timer);
      }
    })
  );

  let results = batches.flat();
  if (!config.SiteConfig.DisableYellowFilter) {
    results = results.filter(
      (result) =>
        !yellowWords.some((word) => (result.type_name || '').includes(word))
    );
  }

  const limit = 150;
  return {
    results: results.slice(0, limit),
    sourceCount: sites.length,
    truncated: results.length > limit,
  };
}

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    const login = new URL('/login', request.url);
    login.searchParams.set(
      'redirect',
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(login);
  }

  const query = (request.nextUrl.searchParams.get('q') || '')
    .trim()
    .slice(0, 100);
  try {
    const data = query
      ? await searchTV(query, auth.username)
      : { results: [], sourceCount: 1, truncated: false };

    return new Response(
      renderTVSearchPage(query, data.results, data.sourceCount, data.truncated),
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch {
    return new Response(renderTVSearchPage(query, [], 0, false), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  }
}
