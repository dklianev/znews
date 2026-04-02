import { describe, expect, it } from 'vitest';

import { createApiErrorHandler } from '../../server/services/expressAsyncService.js';

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

describe('express async service', () => {
  it('maps mongoose validation errors to a 400 payload with field errors', () => {
    const apiErrorHandler = createApiErrorHandler({
      publicError(error, fallback) {
        return error?.message || fallback;
      },
    });

    const res = createResponse();
    apiErrorHandler({
      name: 'ValidationError',
      message: 'Validation failed',
      errors: {
        question: { message: 'Въпросът е задължителен.' },
        'options.0.text': { message: 'Първият отговор не може да е празен.' },
      },
    }, {}, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({
      error: 'Validation failed',
      fieldErrors: {
        question: 'Въпросът е задължителен.',
        'options.0.text': 'Първият отговор не може да е празен.',
      },
    });
  });

  it('maps duplicate key conflicts to a 409 payload', () => {
    const apiErrorHandler = createApiErrorHandler({
      publicError(error, fallback) {
        return error?.message || fallback;
      },
    });

    const res = createResponse();
    apiErrorHandler({
      code: 11000,
      message: 'Duplicate key',
      keyValue: { id: 'crime' },
    }, {}, res, () => {});

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual({
      error: 'Duplicate key',
      fieldErrors: {
        id: 'Тази стойност вече се използва.',
      },
    });
  });
});
