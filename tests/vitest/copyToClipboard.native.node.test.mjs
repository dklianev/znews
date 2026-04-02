import { describe, expect, it, vi } from 'vitest';

import { copyToClipboard } from '../../src/utils/copyToClipboard.js';

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

describe('copyToClipboard helper', () => {
  it('prefers navigator.clipboard when available', async () => {
    const writeText = vi.fn(async (value) => value);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('document', createDocumentMock(false));

    await expect(copyToClipboard('clipboard text')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('clipboard text');
  });

  it('falls back to execCommand and always cleans up the textarea', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('clipboard blocked');
        }),
      },
    });
    const documentMock = createDocumentMock(true);
    vi.stubGlobal('document', documentMock);

    await expect(copyToClipboard('fallback text')).resolves.toBe(true);
    expect(documentMock.body.appended).toHaveLength(0);
  });

  it('fails gracefully when no clipboard strategy exists', async () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('document', undefined);

    await expect(copyToClipboard('no-dom text')).resolves.toBe(false);
  });
});
