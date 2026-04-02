import { describe, test } from 'vitest';

import { testSuites } from '../manifest.mjs';

describe.sequential('legacy-node-suites', () => {
  for (const { name, run, vitestNative } of testSuites) {
    if (vitestNative) continue;
    test(name, async () => {
      await run();
    });
  }
});
