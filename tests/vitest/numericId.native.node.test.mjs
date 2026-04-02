import { describe, expect, it } from 'vitest';

import { allocateNumericId } from '../../server/numericId.js';

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

describe('allocateNumericId', () => {
  it('returns the counter candidate when it is already above the collection floor', async () => {
    const Model = createModel(3, 'Article');
    const CounterModel = createCounterModel([{ seq: 5 }]);

    await expect(allocateNumericId(Model, CounterModel, 'Article')).resolves.toBe(5);
    expect(CounterModel.calls).toHaveLength(1);
  });

  it('resyncs the counter when the generated candidate collides with the floor', async () => {
    const Model = createModel(10, 'Tip');
    const CounterModel = createCounterModel([{ seq: 1 }, { seq: 11 }]);

    await expect(allocateNumericId(Model, CounterModel, 'Tip')).resolves.toBe(11);
    expect(CounterModel.calls).toHaveLength(2);
    expect(CounterModel.calls[1].filter).toEqual({ key: 'Tip', seq: 1 });
  });

  it('rejects when no counter key can be resolved', async () => {
    await expect(allocateNumericId({ modelName: '' }, createCounterModel([]))).rejects.toThrow('Counter key is required');
  });
});
