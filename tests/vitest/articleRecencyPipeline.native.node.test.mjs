import { describe, expect, it } from 'vitest';

import { buildArticleRecencyPipeline } from '../../server/app.js';

describe('articleRecencyPipeline', () => {
  it('keeps explicit inclusion projections without leaking _id or __v', () => {
    const pipeline = buildArticleRecencyPipeline(
      { status: 'published' },
      { id: 1, title: 1, publishAt: 1, _id: 0 },
      { limit: 10 },
    );

    const projectStage = pipeline.find((stage) => stage.$project);
    expect(projectStage).toBeTruthy();
    expect(projectStage.$project).toEqual(expect.objectContaining({
      _id: 0,
      id: 1,
      title: 1,
      publishAt: 1,
    }));
    expect(Object.prototype.hasOwnProperty.call(projectStage.$project, '__v')).toBe(false);
  });

  it('falls back to the default exclusion projection when none is provided', () => {
    const pipeline = buildArticleRecencyPipeline({}, null, {});
    const projectStage = pipeline.find((stage) => stage.$project);

    expect(projectStage).toBeTruthy();
    expect(projectStage.$project._id).toBe(0);
    expect(projectStage.$project.__v).toBe(0);
  });

  it('preserves explicit exclusion projections unchanged', () => {
    const pipeline = buildArticleRecencyPipeline({}, { _id: 0, __v: 0, content: 0 }, {});
    const projectStage = pipeline.find((stage) => stage.$project);

    expect(projectStage).toBeTruthy();
    expect(projectStage.$project).toEqual({
      _id: 0,
      __v: 0,
      content: 0,
    });
  });
});
