import { runComicCardDesignTests } from './comicCardDesign.test.mjs';

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('comicCardDesign', runComicCardDesignTests);

console.log('All tests passed.');
