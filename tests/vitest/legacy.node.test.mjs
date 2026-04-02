import { describe, test } from 'vitest';

import { testSuites } from '../manifest.mjs';

describe.sequential('legacy-node-suites', () => {
  for (const { name, run } of testSuites) {
    test(name, async () => {
      await run();
    });
  }
});
