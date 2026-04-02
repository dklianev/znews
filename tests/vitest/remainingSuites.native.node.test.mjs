import { describe, test } from 'vitest';

import { runSudokuTests } from '../sudoku.test.mjs';
import { runAdMigrationTests } from '../adMigration.test.mjs';
import { runAdOccupancyTests } from '../adOccupancy.test.mjs';
import { runAdHelpersServiceTests } from '../adHelpersService.test.mjs';
import { runHangmanTests } from '../hangman.test.mjs';
import { runCrosswordTests } from '../crossword.test.mjs';
import { runSpellingBeeTests } from '../spellingBee.test.mjs';
import { runAuthTokenHelpersTests } from '../authTokenHelpersService.test.mjs';
import { runAuthSessionHelpersTests } from '../authSessionHelpersService.test.mjs';
import { runCommentsHelpersTests } from '../commentsHelpersService.test.mjs';
import { runCommentsRoutesTests } from '../commentsRoutes.test.mjs';
import { runRateLimitHelpersTests } from '../rateLimitHelpersService.test.mjs';
import { runDbBootstrapServiceTests } from '../dbBootstrapService.test.mjs';
import { runNumericCrudFactoryTests } from '../numericCrudFactory.test.mjs';
import { runArticleCollectionHelpersTests } from '../articleCollectionHelpersService.test.mjs';
import { runArticleRecencyHelpersTests } from '../articleRecencyHelpersService.test.mjs';
import { runArticlesPublicRoutesTests } from '../articlesPublicRoutes.test.mjs';
import { runSearchCollectionHelpersTests } from '../searchCollectionHelpersService.test.mjs';
import { runCoreHelpersTests } from '../coreHelpersService.test.mjs';
import { runContentSharedHelpersTests } from '../contentSharedHelpersService.test.mjs';
import { runContentSanitizersTests } from '../contentSanitizersService.test.mjs';
import { runMediaStorageHelpersTests } from '../mediaStorageHelpersService.test.mjs';
import { runShareCardHelpersTests } from '../shareCardHelpersService.test.mjs';
import { runShareCardObjectHelpersTests } from '../shareCardObjectService.test.mjs';
import { runShareCardRuntimeHelpersTests } from '../shareCardRuntimeService.test.mjs';
import { runAuthRoutesTests } from '../authRoutes.test.mjs';
import { runArticlesAdminRoutesTests } from '../articlesAdminRoutes.test.mjs';
import { runSearchRoutesTests } from '../searchRoutes.test.mjs';
import { runHealthRoutesTests } from '../healthRoutes.test.mjs';
import { runTipRoutesTests } from '../tipRoutes.test.mjs';
import { runUploadRoutesTests } from '../uploadRoutes.test.mjs';
import { runPublicFeedRoutesTests } from '../publicFeedRoutes.test.mjs';
import { runWebSpaRoutesTests } from '../webSpaRoutes.test.mjs';
import { runTetrisTests } from '../tetris.test.mjs';
import { runBlockBustTests } from '../blockBust.test.mjs';

const remainingSuites = [
  ['sudoku', runSudokuTests],
  ['adMigration', runAdMigrationTests],
  ['adOccupancy', runAdOccupancyTests],
  ['adHelpersService', runAdHelpersServiceTests],
  ['hangman', runHangmanTests],
  ['crossword', runCrosswordTests],
  ['spellingBee', runSpellingBeeTests],
  ['authTokenHelpers', runAuthTokenHelpersTests],
  ['authSessionHelpers', runAuthSessionHelpersTests],
  ['commentsHelpers', runCommentsHelpersTests],
  ['commentsRoutes', runCommentsRoutesTests],
  ['rateLimitHelpers', runRateLimitHelpersTests],
  ['dbBootstrapService', runDbBootstrapServiceTests],
  ['numericCrudFactory', runNumericCrudFactoryTests],
  ['articleCollectionHelpers', runArticleCollectionHelpersTests],
  ['articleRecencyHelpers', runArticleRecencyHelpersTests],
  ['articlesPublicRoutes', runArticlesPublicRoutesTests],
  ['searchCollectionHelpers', runSearchCollectionHelpersTests],
  ['coreHelpers', runCoreHelpersTests],
  ['contentSharedHelpers', runContentSharedHelpersTests],
  ['contentSanitizers', runContentSanitizersTests],
  ['mediaStorageHelpers', runMediaStorageHelpersTests],
  ['shareCardHelpers', runShareCardHelpersTests],
  ['shareCardObjectHelpers', runShareCardObjectHelpersTests],
  ['shareCardRuntimeHelpers', runShareCardRuntimeHelpersTests],
  ['authRoutes', runAuthRoutesTests],
  ['articlesAdminRoutes', runArticlesAdminRoutesTests],
  ['searchRoutes', runSearchRoutesTests],
  ['healthRoutes', runHealthRoutesTests],
  ['tipRoutes', runTipRoutesTests],
  ['uploadRoutes', runUploadRoutesTests],
  ['publicFeedRoutes', runPublicFeedRoutesTests],
  ['webSpaRoutes', runWebSpaRoutesTests],
  ['tetris', runTetrisTests],
  ['blockBust', runBlockBustTests],
];

describe.sequential('remaining-node-suites', () => {
  for (const [name, run] of remainingSuites) {
    test(name, async () => {
      await run();
    });
  }
});
