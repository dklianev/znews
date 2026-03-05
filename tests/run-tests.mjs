import { runComicCardDesignTests } from './comicCardDesign.test.mjs';
import { runHomepageSelectorTests } from './homepageSelectors.test.mjs';
import { runHeroTitleScaleTests } from './heroTitleScale.test.mjs';
import { runSudokuTests } from './sudoku.test.mjs';

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
runTest('homepageSelectors', runHomepageSelectorTests);
runTest('heroTitleScale', runHeroTitleScaleTests);
runTest('sudoku', runSudokuTests);

console.log('All tests passed.');

