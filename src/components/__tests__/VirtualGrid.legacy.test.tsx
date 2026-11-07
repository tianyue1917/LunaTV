/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';

import VirtualGrid from '@/components/VirtualGrid';
import { shouldUseTVCompatibilityMode } from '@/lib/tv-compat';

describe('legacy TV WebView search layout', () => {
  const originalResizeObserver = window.ResizeObserver;
  const originalUserAgent = window.navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: originalResizeObserver,
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it('detects WebView below Chrome 85 and renders all search cards without virtual scrolling', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 7.1.2; MiTV) AppleWebKit/537.36 Chrome/69.0.3497.100 Safari/537.36',
    });
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    });

    expect(shouldUseTVCompatibilityMode()).toBe(true);

    render(
      <VirtualGrid
        items={['影片 A', '影片 B', '影片 C']}
        renderItem={(title) => <div>{title}</div>}
      />
    );

    expect(screen.getByText('影片 A')).toBeInTheDocument();
    expect(screen.getByText('影片 B')).toBeInTheDocument();
    expect(screen.getByText('影片 C')).toBeInTheDocument();
    expect(document.querySelector('[data-tv-simple-grid]')).not.toBeNull();
  });

  it('also falls back when ResizeObserver is missing despite a recent user agent', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
    });
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    });
    expect(shouldUseTVCompatibilityMode()).toBe(true);
  });
});
