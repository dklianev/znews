import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';

export async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
  if (typeof vi?.isFakeTimers === 'function' && vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(0);
    return;
  }
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

export async function renderIntoBody(Component, props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(createElement(Component, props));
    await flushEffects();
  });

  return { container, root };
}

export async function unmountRoot(root, container) {
  if (root) {
    await act(async () => {
      root.unmount();
    });
  }
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
}

export async function click(node) {
  if (!node) return;
  await act(async () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushEffects();
  });
}

export async function inputValue(node, value) {
  if (!node) return;
  await act(async () => {
    const prototype = node instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : node instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    valueSetter?.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    await flushEffects();
  });
}

export async function submitForm(form) {
  if (!form) return;
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushEffects();
  });
}

export function installStorageStub(target = window, initial = {}) {
  const store = new Map(Object.entries(initial));
  const stub = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    value: stub,
  });

  return stub;
}

export function installClipboardStub() {
  const writeText = async () => {};
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return navigator.clipboard;
}
