import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { copyToClipboard } from '../src/utils/copyToClipboard.js';

function createDocumentMock(copyResult = true) {
  const body = {
    appended: [],
    appendChild(node) {
      node.parentNode = this;
      this.appended.push(node);
    },
    removeChild(node) {
      this.appended = this.appended.filter((entry) => entry !== node);
      node.parentNode = null;
    },
  };

  return {
    body,
    createElement() {
      return {
        value: '',
        style: {},
        parentNode: null,
        setAttribute() {},
        focus() {},
        select() {},
        setSelectionRange() {},
      };
    },
    execCommand(command) {
      return command === 'copy' ? copyResult : false;
    },
  };
}

describe('copyToClipboard', () => {
  it('covers legacy scenarios', async () => {
      const originalNavigator = globalThis.navigator;
      const originalDocument = globalThis.document;
    
      try {
        Object.defineProperty(globalThis, 'navigator', {
          configurable: true,
          writable: true,
          value: {
            clipboard: {
              async writeText(value) {
                assert.equal(value, 'clipboard text', 'clipboard path should receive the text to copy');
              },
            },
          },
        });
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          writable: true,
          value: createDocumentMock(false),
        });
        assert.equal(await copyToClipboard('clipboard text'), true, 'copyToClipboard should prefer navigator.clipboard when available');
    
        delete globalThis.navigator;
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          writable: true,
          value: createDocumentMock(true),
        });
        assert.equal(await copyToClipboard('fallback text'), true, 'copyToClipboard should fall back to execCommand copy');
        assert.equal(globalThis.document.body.appended.length, 0, 'copyToClipboard fallback should always clean up the temporary textarea');
    
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          writable: true,
          value: undefined,
        });
        assert.equal(await copyToClipboard('no-dom text'), false, 'copyToClipboard should fail gracefully when no clipboard strategy exists');
      } finally {
        if (typeof originalNavigator === 'undefined') delete globalThis.navigator;
        else Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: originalNavigator });
        if (typeof originalDocument === 'undefined') delete globalThis.document;
        else Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: originalDocument });
      }
  });
});
