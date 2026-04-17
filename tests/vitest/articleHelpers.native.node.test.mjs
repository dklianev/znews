import { describe, expect, it, vi } from 'vitest';

import { createArticleHelpers } from '../../server/services/articleHelpersService.js';

function createHelpers(overrides = {}) {
  return createArticleHelpers({
    ArticleRevision: overrides.ArticleRevision,
    hasOwn: (payload, key) => Object.prototype.hasOwnProperty.call(payload || {}, key),
    normalizeText: (value, max = 10_000) => typeof value === 'string' ? value.trim().slice(0, max) : '',
    randomUUID: overrides.randomUUID || (() => 'revision-id'),
    resolveImageMetaFromUrl: async () => null,
    sanitizeDate: (value) => typeof value === 'string' ? value : '',
    sanitizeDateTime: (value) => value || null,
    sanitizeMediaUrl: (value) => typeof value === 'string' ? value.trim() : '',
    sanitizeSafeHtml: (value) => typeof value === 'string' ? value.trim() : '',
    sanitizeShareAccent: (value) => value || 'auto',
    sanitizeTags: (value) => Array.isArray(value) ? value : [],
  });
}

describe('article helpers', () => {
  it('retries revision creation when a duplicate version collision happens', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 11000 }))
      .mockResolvedValueOnce({
        toJSON() {
          return { revisionId: 'revision-2', version: 2 };
        },
      });

    const findOne = vi.fn()
      .mockReturnValueOnce({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            version: 1,
            snapshot: { title: 'Преди', content: '<p>old</p>' },
          }),
        }),
      })
      .mockReturnValueOnce({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            version: 1,
            snapshot: { title: 'Преди', content: '<p>old</p>' },
          }),
        }),
      });
    const find = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const helpers = createHelpers({
      ArticleRevision: {
        findOne,
        find,
        create,
        deleteMany: vi.fn(),
      },
      randomUUID: (() => {
        let counter = 0;
        return () => `revision-${++counter}`;
      })(),
    });

    const result = await helpers.createArticleRevision(11, { title: 'След', content: '<p>new</p>' });

    expect(result).toEqual({ revisionId: 'revision-2', version: 2 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].version).toBe(2);
    expect(create.mock.calls[1][0].version).toBe(2);
  });

  it('prunes old revisions with a cutoff query instead of scanning all rows', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 5 });
    const cutoffDate = new Date('2026-04-17T10:00:00.000Z');
    const findOne = vi.fn()
      .mockReturnValueOnce({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      });
    const find = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(Array.from({ length: 80 }, (_, index) => ({
              createdAt: cutoffDate,
              version: 159 - index,
            }))),
          }),
        }),
      }),
    });

    const helpers = createHelpers({
      ArticleRevision: {
        findOne,
        find,
        create: vi.fn().mockResolvedValue({
          toJSON() {
            return { revisionId: 'revision-1', version: 1 };
          },
        }),
        deleteMany,
      },
    });

    await helpers.createArticleRevision(12, { title: 'Нова версия', content: '<p>x</p>' });

    expect(find).toHaveBeenCalledWith({ articleId: 12 });
    expect(deleteMany).toHaveBeenCalledWith({
      articleId: 12,
      $or: [
        { createdAt: { $lt: cutoffDate } },
        { createdAt: cutoffDate, version: { $lt: 80 } },
      ],
    });
  });

  it('skips prune work when there are fewer than 80 revisions', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });
    const findOne = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });
    const find = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([{ createdAt: new Date('2026-04-17T10:00:00.000Z'), version: 1 }]),
          }),
        }),
      }),
    });

    const helpers = createHelpers({
      ArticleRevision: {
        findOne,
        find,
        create: vi.fn().mockResolvedValue({
          toJSON() {
            return { revisionId: 'revision-1', version: 1 };
          },
        }),
        deleteMany,
      },
    });

    await helpers.createArticleRevision(13, { title: 'Нова версия', content: '<p>x</p>' });

    expect(deleteMany).not.toHaveBeenCalled();
  });
});
