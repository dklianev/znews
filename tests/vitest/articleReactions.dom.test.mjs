import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getReactionState = vi.fn(() => Promise.resolve({ reacted: { fire: true } }));

vi.mock('../../src/utils/api', () => ({
  api: {
    articles: {
      getReactionState,
      react: vi.fn(),
      removeReaction: vi.fn(),
    },
  },
}));

vi.mock('motion/react', async () => {
  const React = await import('react');

  function createMotionElement(tag) {
    return ({ children, animate, exit, initial, layout, transition, whileHover, whileTap, ...props }) =>
      React.createElement(tag, props, children);
  }

  return {
    motion: new Proxy({}, {
      get: (_, tag) => createMotionElement(tag),
    }),
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

const { default: ArticleReactions } = await import('../../src/components/ArticleReactions.jsx');

describe('ArticleReactions', () => {
  let container;
  let root;

  afterEach(async () => {
    getReactionState.mockClear();
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    root = null;
    container = null;
  });

  it('renders safely with missing reactions and no article id', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticleReactions, { articleId: null, reactions: undefined }));
    });

    expect(container.querySelectorAll('button')).toHaveLength(5);
    expect(getReactionState).not.toHaveBeenCalled();
  });

  it('fetches the viewer reaction state once for stable props', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticleReactions, { articleId: 27, reactions: undefined }));
      await Promise.resolve();
    });

    expect(container.querySelectorAll('button')).toHaveLength(5);
    expect(getReactionState).toHaveBeenCalledTimes(1);
    expect(getReactionState).toHaveBeenCalledWith(27);

    await act(async () => {
      root.render(createElement(ArticleReactions, { articleId: 27, reactions: undefined }));
      await Promise.resolve();
    });

    expect(getReactionState).toHaveBeenCalledTimes(1);
  });
});
