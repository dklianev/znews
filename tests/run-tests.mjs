import { testSuites } from './manifest.mjs';

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

for (const { name, run } of testSuites) {
  await runTest(name, run);
}

console.log('All tests passed.');
