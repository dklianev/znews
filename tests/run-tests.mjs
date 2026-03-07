import { runComicCardDesignTests } from './comicCardDesign.test.mjs';
import { runHomepageSelectorTests } from './homepageSelectors.test.mjs';
import { runHeroTitleScaleTests } from './heroTitleScale.test.mjs';
import { runSudokuTests } from './sudoku.test.mjs';
import { runAdResolverTests } from './adResolver.test.mjs';
import { runAdMigrationTests } from './adMigration.test.mjs';
import { runAdOccupancyTests } from './adOccupancy.test.mjs';
import { runHangmanTests } from './hangman.test.mjs';
import { runCrosswordTests } from './crossword.test.mjs';
import { runSpellingBeeTests } from './spellingBee.test.mjs';

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
runTest('adResolver', runAdResolverTests);
runTest('adMigration', runAdMigrationTests);
runTest('adOccupancy', runAdOccupancyTests);
runTest('hangman', runHangmanTests);
runTest('crossword', runCrosswordTests);
runTest('spellingbee', runSpellingBeeTests);

console.log('All tests passed.');
