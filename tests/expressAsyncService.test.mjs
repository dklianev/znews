import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createApiErrorHandler } from '../server/services/expressAsyncService.js';

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

describe('expressAsyncService', () => {
  it('keeps expressAsyncService legacy coverage green', async () => {
      const apiErrorHandler = createApiErrorHandler({
        publicError(error, fallback) {
          return error?.message || fallback;
        },
      });
    
      {
        const res = createResponse();
        apiErrorHandler({
          name: 'ValidationError',
          message: 'Validation failed',
          errors: {
            question: { message: 'Въпросът е задължителен.' },
            'options.0.text': { message: 'Всяка опция трябва да има текст.' },
          },
        }, {}, res, () => {});
    
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.payload, {
          error: 'Validation failed',
          fieldErrors: {
            question: 'Въпросът е задължителен.',
            'options.0.text': 'Всяка опция трябва да има текст.',
          },
        });
      }
    
      {
        const res = createResponse();
        apiErrorHandler({
          code: 11000,
          message: 'Duplicate key',
          keyValue: { id: 'crime' },
        }, {}, res, () => {});
    
        assert.equal(res.statusCode, 409);
        assert.deepEqual(res.payload, {
          error: 'Duplicate key',
          fieldErrors: {
            id: 'Тази стойност вече се използва.',
          },
        });
      }
  });
});
