import { describe, expect, it, vi } from 'vitest';
import { registerPollVoteRoutes } from '../../server/routes/pollVoteRoutes.js';
import { createMockApp, createResponse, runHandlers } from './helpers/routeHarness.mjs';

describe('pollVoteRoutes', () => {
  it('rejects invalid vote payloads before hitting storage', async () => {
    const app = createMockApp();
    const create = vi.fn();

    registerPollVoteRoutes(app, {
      Poll: { findOne: () => ({ lean: async () => null }), findOneAndUpdate: () => ({ lean: async () => null }) },
      PollVote: { create },
      getWindowKey: () => 10,
      hashClientFingerprint: () => 'fingerprint',
      isMongoDuplicateKeyError: () => false,
      pollVoteLimiter: (_req, _res, next) => next(),
      pollVoteWindowMs: 60000,
    });

    const res = createResponse();
    await runHandlers(app.routes.get('POST /api/polls/:id/vote'), {
      params: { id: 'oops' },
      body: { optionIndex: 'x' },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 429 for duplicate vote windows and updates valid votes', async () => {
    const app = createMockApp();
    const duplicate = Object.assign(new Error('dup'), { code: 11000 });
    const create = vi.fn()
      .mockRejectedValueOnce(duplicate)
      .mockResolvedValueOnce({});

    const poll = {
      id: 7,
      question: 'Въпрос',
      options: [{ text: 'Да', votes: 2 }, { text: 'Не', votes: 1 }],
    };
    const updated = {
      id: 7,
      question: 'Въпрос',
      options: [{ text: 'Да', votes: 2 }, { text: 'Не', votes: 2 }],
    };

    registerPollVoteRoutes(app, {
      Poll: {
        findOne: () => ({ lean: async () => poll }),
        findOneAndUpdate: vi.fn(() => ({ lean: async () => updated })),
      },
      PollVote: { create },
      getWindowKey: () => 42,
      hashClientFingerprint: () => 'fingerprint',
      isMongoDuplicateKeyError: (error) => error?.code === 11000,
      pollVoteLimiter: (_req, _res, next) => next(),
      pollVoteWindowMs: 120000,
    });

    const duplicateRes = createResponse();
    await runHandlers(app.routes.get('POST /api/polls/:id/vote'), {
      params: { id: '7' },
      body: { optionIndex: '1' },
    }, duplicateRes);
    expect(duplicateRes.statusCode).toBe(429);

    const successRes = createResponse();
    await runHandlers(app.routes.get('POST /api/polls/:id/vote'), {
      params: { id: '7' },
      body: { optionIndex: '1' },
      headers: {},
    }, successRes);
    expect(successRes.statusCode).toBe(200);
    expect(successRes.body.options[1].votes).toBe(2);
  });
});

