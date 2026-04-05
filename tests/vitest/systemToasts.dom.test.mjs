import { afterEach, describe, expect, it, vi } from 'vitest';

import { showChunkReloadToast, showSystemToast } from '../../src/utils/systemToasts.js';

describe('systemToasts', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('replaces an existing toast with the same class and runs the action handler', () => {
    const onAction = vi.fn();

    showSystemToast({
      className: 'pwa-update-toast',
      message: 'Стара версия.',
    });

    showSystemToast({
      className: 'pwa-update-toast',
      message: 'Има нова версия на сайта.',
      actionLabel: 'Обнови',
      onAction,
    });

    const toasts = document.querySelectorAll('.pwa-update-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toContain('Има нова версия на сайта.');

    toasts[0].querySelector('.pwa-refresh-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.pwa-update-toast')).toBeNull();
  });

  it('auto-runs the chunk reload action after the grace window', () => {
    vi.useFakeTimers();
    const reloadNow = vi.fn();

    showChunkReloadToast(reloadNow);

    const toast = document.querySelector('.pwa-reload-toast');
    expect(toast?.textContent).toContain('Открихме нова версия на сайта. Обновяваме...');

    vi.advanceTimersByTime(1499);
    expect(reloadNow).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(reloadNow).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.pwa-reload-toast')).toBeNull();
  });
});
