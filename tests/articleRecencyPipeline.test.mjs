import assert from 'node:assert/strict';

import { buildArticleRecencyPipeline } from '../server/app.js';

export function runArticleRecencyPipelineTests() {
  {
    const pipeline = buildArticleRecencyPipeline(
      { status: 'published' },
      { id: 1, title: 1, publishAt: 1, _id: 0 },
      { limit: 10 }
    );

    const projectStage = pipeline.find((stage) => stage.$project);
    assert.ok(projectStage, 'expected $project stage to exist');
    assert.equal(projectStage.$project._id, 0);
    assert.equal(projectStage.$project.id, 1);
    assert.equal(projectStage.$project.title, 1);
    assert.equal(projectStage.$project.publishAt, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(projectStage.$project, '__v'), false);
  }

  {
    const pipeline = buildArticleRecencyPipeline({}, null, {});
    const projectStage = pipeline.find((stage) => stage.$project);
    assert.ok(projectStage, 'expected default $project stage to exist');
    assert.equal(projectStage.$project._id, 0);
    assert.equal(projectStage.$project.__v, 0);
  }

  {
    const pipeline = buildArticleRecencyPipeline({}, { _id: 0, __v: 0, content: 0 }, {});
    const projectStage = pipeline.find((stage) => stage.$project);
    assert.ok(projectStage, 'expected exclusion $project stage to exist');
    assert.equal(projectStage.$project._id, 0);
    assert.equal(projectStage.$project.__v, 0);
    assert.equal(projectStage.$project.content, 0);
  }
}
