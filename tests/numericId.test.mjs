import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { allocateNumericId } from '../server/numericId.js';

function createModel(lastId, modelName = 'MockModel') {
  return {
    modelName,
    findOne() {
      return {
        sort() {
          return {
            select() {
              return {
                async lean() {
                  return Number.isInteger(lastId) ? { id: lastId } : null;
                },
              };
            },
            async lean() {
              return Number.isInteger(lastId) ? { id: lastId } : null;
            },
          };
        },
      };
    },
  };
}

function createCounterModel(responses) {
  const queue = [...responses];
  const calls = [];
  return {
    calls,
    findOneAndUpdate(filter, update) {
      calls.push({ filter, update });
      const value = queue.shift();
      return {
        async lean() {
          return value ?? null;
        },
      };
    },
  };
}

describe('numericId', () => {
  it('covers legacy scenarios', async () => {
      {
        const Model = createModel(3, 'Article');
        const CounterModel = createCounterModel([{ seq: 5 }]);
        const id = await allocateNumericId(Model, CounterModel, 'Article');
        assert.equal(id, 5);
        assert.equal(CounterModel.calls.length, 1);
      }
    
      {
        const Model = createModel(10, 'Tip');
        const CounterModel = createCounterModel([{ seq: 1 }, { seq: 11 }]);
        const id = await allocateNumericId(Model, CounterModel, 'Tip');
        assert.equal(id, 11);
        assert.equal(CounterModel.calls.length, 2);
        assert.deepEqual(CounterModel.calls[1].filter, { key: 'Tip', seq: 1 });
      }
  });
});
