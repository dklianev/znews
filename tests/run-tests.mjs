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
import { runRequestIdentityTests } from './requestIdentity.test.mjs';
import { runNumericIdTests } from './numericId.test.mjs';
import { runArticleRecencyPipelineTests } from './articleRecencyPipeline.test.mjs';
import { runSearchUtilsTests } from './searchUtils.test.mjs';
import { runGamePuzzleHelpersTests } from './gamePuzzleHelpersService.test.mjs';
import { runSettingsHelpersTests } from './settingsHelpersService.test.mjs';
import { runArticlePushHelpersTests } from './articlePushHelpersService.test.mjs';
import { runDocumentHelpersTests } from './documentHelpersService.test.mjs';
import { runGamesCatalogServiceTests } from './gamesCatalogService.test.mjs';
import { runAccessHelpersTests } from './accessHelpersService.test.mjs';
import { runAuthTokenHelpersTests } from './authTokenHelpersService.test.mjs';

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await runTest('comicCardDesign', runComicCardDesignTests);
await runTest('homepageSelectors', runHomepageSelectorTests);
await runTest('heroTitleScale', runHeroTitleScaleTests);
await runTest('sudoku', runSudokuTests);
await runTest('adResolver', runAdResolverTests);
await runTest('adMigration', runAdMigrationTests);
await runTest('adOccupancy', runAdOccupancyTests);
await runTest('hangman', runHangmanTests);
await runTest('crossword', runCrosswordTests);
await runTest('spellingBee', runSpellingBeeTests);
await runTest('requestIdentity', runRequestIdentityTests);
await runTest('numericId', runNumericIdTests);
await runTest('articleRecencyPipeline', runArticleRecencyPipelineTests);
await runTest('searchUtils', runSearchUtilsTests);
await runTest('gamePuzzleHelpers', runGamePuzzleHelpersTests);
await runTest('settingsHelpers', runSettingsHelpersTests);
await runTest('articlePushHelpers', runArticlePushHelpersTests);
await runTest('documentHelpers', runDocumentHelpersTests);
await runTest('gamesCatalogService', runGamesCatalogServiceTests);
await runTest('accessHelpers', runAccessHelpersTests);
await runTest('authTokenHelpers', runAuthTokenHelpersTests);

console.log('All tests passed.');
