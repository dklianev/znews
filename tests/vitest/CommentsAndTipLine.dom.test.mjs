import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, installStorageStub, renderIntoBody, submitForm, unmountRoot } from './helpers/domHarness.mjs';

const loadCommentsForArticle = vi.fn(async () => {});
const addComment = vi.fn(async () => {});
const reactToComment = vi.fn(async () => {});
const createTip = vi.fn(async () => {});

let publicDataState = {};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicDataState,
  useEngagementData: () => ({
    comments: publicDataState.comments,
    addComment: publicDataState.addComment,
    reactToComment: publicDataState.reactToComment,
    loadCommentsForArticle: publicDataState.loadCommentsForArticle,
    createTip: publicDataState.createTip,
  }),
}));

vi.mock('../../src/hooks/useDocumentTitle', () => ({
  makeTitle: (value) => value,
  useDocumentTitle: () => {},
}));

vi.mock('../../src/utils/newsDate', () => ({
  formatNewsDate: () => '3 ????? 2026',
}));

vi.mock('motion/react', () => {
  function createMotionElement(tag) {
    return ({ children, animate, exit, initial, layout, transition, whileHover, whileTap, ...props }) =>
      createElement(tag, props, children);
  }

  return {
    motion: new Proxy({}, { get: (_target, tag) => createMotionElement(tag) }),
    AnimatePresence: ({ children }) => createElement(React.Fragment, null, children),
  };
});

const { default: CommentsSection } = await import('../../src/components/CommentsSection.jsx');
const { default: TipLine } = await import('../../src/pages/TipLine.jsx');

describe('CommentsAndTipLine', () => {
  let root;
  let container;

  afterEach(async () => {
    loadCommentsForArticle.mockClear();
    addComment.mockClear();
    reactToComment.mockClear();
    createTip.mockClear();
    publicDataState = {};
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('loads article comments and submits a new moderated comment', async () => {
    installStorageStub(window);
    publicDataState = {
      comments: [
        { id: 1, articleId: 27, approved: true, author: '????', text: '???? ????????', likes: 1, dislikes: 0 },
      ],
      addComment,
      reactToComment,
      loadCommentsForArticle,
    };

    ({ root, container } = await renderIntoBody(CommentsSection, { articleId: 27 }));

    expect(loadCommentsForArticle).toHaveBeenCalledWith(27);
    expect(container.textContent).toContain('???? ????????');

    const authorInput = container.querySelector('input[type="text"]');
    const textarea = container.querySelector('textarea');

    await inputValue(authorInput, '??????');
    await inputValue(textarea, '???? ????? ?? ???????');

    const submitButton = Array.from(container.querySelectorAll('button')).find((button) => button.type === 'submit');
    await click(submitButton);
    await flushEffects();

    expect(addComment).toHaveBeenCalledWith({
      articleId: 27,
      author: '??????',
      text: '???? ????? ?? ???????',
    });
  });

  it('validates and submits anonymous tips through the public form', async () => {
    publicDataState = { createTip };

    ({ root, container } = await renderIntoBody(TipLine));

    const textarea = container.querySelector('textarea');
    const locationInput = container.querySelector('input[name="location"]');
    const form = container.querySelector('form');

    await submitForm(form);
    expect(createTip).not.toHaveBeenCalled();

    await inputValue(textarea, '????? ?????? ?? ??????.');
    await inputValue(locationInput, '??????');

    const submitButton = Array.from(container.querySelectorAll('button')).find((button) => button.type === 'submit');
    await click(submitButton);
    await flushEffects();

    expect(createTip).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Сигналът е предаден!');
  });
});
