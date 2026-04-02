import { runComicCardDesignTests } from './comicCardDesign.test.mjs';
import { runHomepageSelectorTests } from './homepageSelectors.test.mjs';
import { runHeroTitleScaleTests } from './heroTitleScale.test.mjs';
import { runSudokuTests } from './sudoku.test.mjs';
import { runAdResolverTests } from './adResolver.test.mjs';
import { runAdMigrationTests } from './adMigration.test.mjs';
import { runAdOccupancyTests } from './adOccupancy.test.mjs';
import { runAdHelpersServiceTests } from './adHelpersService.test.mjs';
import { runHangmanTests } from './hangman.test.mjs';
import { runCrosswordTests } from './crossword.test.mjs';
import { runSpellingBeeTests } from './spellingBee.test.mjs';
import { runCopyToClipboardTests } from './copyToClipboard.test.mjs';
import { runChunkReloadTests } from './chunkReload.test.mjs';
import { runRequestIdentityTests } from './requestIdentity.test.mjs';
import { runCacheServiceTests } from './cacheService.test.mjs';
import { runDiagnosticsServiceTests } from './diagnosticsService.test.mjs';
import { runRequestMetricsServiceTests } from './requestMetricsService.test.mjs';
import { runNumericIdTests } from './numericId.test.mjs';
import { runArticleRecencyPipelineTests } from './articleRecencyPipeline.test.mjs';
import { runSearchUtilsTests } from './searchUtils.test.mjs';
import { runImageOptimizationTests } from './imageOptimization.test.mjs';
import { runGamePuzzleHelpersTests } from './gamePuzzleHelpersService.test.mjs';
import { runSettingsHelpersTests } from './settingsHelpersService.test.mjs';
import { runArticlePushHelpersTests } from './articlePushHelpersService.test.mjs';
import { runDocumentHelpersTests } from './documentHelpersService.test.mjs';
import { runGamesCatalogServiceTests } from './gamesCatalogService.test.mjs';
import { runGameSharedHelpersServiceTests } from './gameSharedHelpersService.test.mjs';
import { runAccessHelpersTests } from './accessHelpersService.test.mjs';
import { runAuthTokenHelpersTests } from './authTokenHelpersService.test.mjs';
import { runAuthSessionHelpersTests } from './authSessionHelpersService.test.mjs';
import { runCommentsHelpersTests } from './commentsHelpersService.test.mjs';
import { runCommentsRoutesTests } from './commentsRoutes.test.mjs';
import { runRateLimitHelpersTests } from './rateLimitHelpersService.test.mjs';
import { runDbBootstrapServiceTests } from './dbBootstrapService.test.mjs';
import { runNumericCrudFactoryTests } from './numericCrudFactory.test.mjs';
import { runArticleCollectionHelpersTests } from './articleCollectionHelpersService.test.mjs';
import { runArticleRecencyHelpersTests } from './articleRecencyHelpersService.test.mjs';
import { runArticlesPublicRoutesTests } from './articlesPublicRoutes.test.mjs';
import { runSearchCollectionHelpersTests } from './searchCollectionHelpersService.test.mjs';
import { runCoreHelpersTests } from './coreHelpersService.test.mjs';
import { runContentSharedHelpersTests } from './contentSharedHelpersService.test.mjs';
import { runSettingsPayloadHelpersTests } from './settingsPayloadHelpersService.test.mjs';
import { runContentSanitizersTests } from './contentSanitizersService.test.mjs';
import { runMediaStorageHelpersTests } from './mediaStorageHelpersService.test.mjs';
import { runShareCardHelpersTests } from './shareCardHelpersService.test.mjs';
import { runShareCardObjectHelpersTests } from './shareCardObjectService.test.mjs';
import { runShareCardRuntimeHelpersTests } from './shareCardRuntimeService.test.mjs';
import { runWebArticleMetaHelpersTests } from './webArticleMetaHelpersService.test.mjs';
import { runServerLifecycleServiceTests } from './serverLifecycleService.test.mjs';
import { runRequestHelpersTests } from './requestHelpersService.test.mjs';
import { runRuntimeBootstrapHelpersTests } from './runtimeBootstrapHelpersService.test.mjs';
import { runFramePolicyServiceTests } from './framePolicyService.test.mjs';
import { runRemoteStorageServiceTests } from './remoteStorageService.test.mjs';
import { runExpressAsyncServiceTests } from './expressAsyncService.test.mjs';
import { runAuthRoutesTests } from './authRoutes.test.mjs';
import { runArticlesAdminRoutesTests } from './articlesAdminRoutes.test.mjs';
import { runSearchRoutesTests } from './searchRoutes.test.mjs';
import { runHealthRoutesTests } from './healthRoutes.test.mjs';
import { runTipRoutesTests } from './tipRoutes.test.mjs';
import { runUploadRoutesTests } from './uploadRoutes.test.mjs';
import { runPublicFeedRoutesTests } from './publicFeedRoutes.test.mjs';
import { runNewsDateTests } from './newsDate.test.mjs';
import { runWebSpaRoutesTests } from './webSpaRoutes.test.mjs';
import { runTetrisTests } from './tetris.test.mjs';
import { runTouchSwipeTests } from './touchSwipe.test.mjs';
import { runApiClientSessionTests } from './apiClientSession.test.mjs';
import { runBlockBustTests } from './blockBust.test.mjs';
import { runArticleAdminFormTests } from './articleAdminForm.test.mjs';
import { runArticleReactionsTests } from './articleReactions.test.mjs';
import { runQuizGameTests } from './quizGame.test.mjs';

export const testSuites = [
  { name: 'comicCardDesign', run: runComicCardDesignTests, vitestNative: true },
  { name: 'homepageSelectors', run: runHomepageSelectorTests, vitestNative: true },
  { name: 'heroTitleScale', run: runHeroTitleScaleTests, vitestNative: true },
  { name: 'sudoku', run: runSudokuTests },
  { name: 'adResolver', run: runAdResolverTests, vitestNative: true },
  { name: 'adMigration', run: runAdMigrationTests },
  { name: 'adOccupancy', run: runAdOccupancyTests },
  { name: 'adHelpersService', run: runAdHelpersServiceTests },
  { name: 'hangman', run: runHangmanTests },
  { name: 'crossword', run: runCrosswordTests },
  { name: 'spellingBee', run: runSpellingBeeTests },
  { name: 'copyToClipboard', run: runCopyToClipboardTests, vitestNative: true },
  { name: 'chunkReload', run: runChunkReloadTests, vitestNative: true },
  { name: 'requestIdentity', run: runRequestIdentityTests, vitestNative: true },
  { name: 'cacheService', run: runCacheServiceTests, vitestNative: true },
  { name: 'diagnosticsService', run: runDiagnosticsServiceTests, vitestNative: true },
  { name: 'requestMetricsService', run: runRequestMetricsServiceTests, vitestNative: true },
  { name: 'numericId', run: runNumericIdTests, vitestNative: true },
  { name: 'articleRecencyPipeline', run: runArticleRecencyPipelineTests },
  { name: 'searchUtils', run: runSearchUtilsTests, vitestNative: true },
  { name: 'imageOptimization', run: runImageOptimizationTests, vitestNative: true },
  { name: 'gamePuzzleHelpers', run: runGamePuzzleHelpersTests },
  { name: 'settingsHelpers', run: runSettingsHelpersTests, vitestNative: true },
  { name: 'articlePushHelpers', run: runArticlePushHelpersTests, vitestNative: true },
  { name: 'documentHelpers', run: runDocumentHelpersTests, vitestNative: true },
  { name: 'gamesCatalogService', run: runGamesCatalogServiceTests, vitestNative: true },
  { name: 'gameSharedHelpersService', run: runGameSharedHelpersServiceTests, vitestNative: true },
  { name: 'accessHelpers', run: runAccessHelpersTests, vitestNative: true },
  { name: 'authTokenHelpers', run: runAuthTokenHelpersTests },
  { name: 'authSessionHelpers', run: runAuthSessionHelpersTests },
  { name: 'commentsHelpers', run: runCommentsHelpersTests },
  { name: 'commentsRoutes', run: runCommentsRoutesTests },
  { name: 'rateLimitHelpers', run: runRateLimitHelpersTests },
  { name: 'dbBootstrapService', run: runDbBootstrapServiceTests },
  { name: 'numericCrudFactory', run: runNumericCrudFactoryTests },
  { name: 'articleCollectionHelpers', run: runArticleCollectionHelpersTests },
  { name: 'articleRecencyHelpers', run: runArticleRecencyHelpersTests },
  { name: 'articlesPublicRoutes', run: runArticlesPublicRoutesTests },
  { name: 'searchCollectionHelpers', run: runSearchCollectionHelpersTests },
  { name: 'coreHelpers', run: runCoreHelpersTests },
  { name: 'contentSharedHelpers', run: runContentSharedHelpersTests },
  { name: 'settingsPayloadHelpers', run: runSettingsPayloadHelpersTests },
  { name: 'contentSanitizers', run: runContentSanitizersTests },
  { name: 'mediaStorageHelpers', run: runMediaStorageHelpersTests },
  { name: 'shareCardHelpers', run: runShareCardHelpersTests },
  { name: 'shareCardObjectHelpers', run: runShareCardObjectHelpersTests },
  { name: 'shareCardRuntimeHelpers', run: runShareCardRuntimeHelpersTests },
  { name: 'webArticleMetaHelpers', run: runWebArticleMetaHelpersTests, vitestNative: true },
  { name: 'serverLifecycleService', run: runServerLifecycleServiceTests, vitestNative: true },
  { name: 'requestHelpers', run: runRequestHelpersTests, vitestNative: true },
  { name: 'runtimeBootstrapHelpers', run: runRuntimeBootstrapHelpersTests, vitestNative: true },
  { name: 'framePolicyService', run: runFramePolicyServiceTests, vitestNative: true },
  { name: 'remoteStorageService', run: runRemoteStorageServiceTests, vitestNative: true },
  { name: 'expressAsyncService', run: runExpressAsyncServiceTests, vitestNative: true },
  { name: 'authRoutes', run: runAuthRoutesTests },
  { name: 'articlesAdminRoutes', run: runArticlesAdminRoutesTests },
  { name: 'searchRoutes', run: runSearchRoutesTests },
  { name: 'healthRoutes', run: runHealthRoutesTests },
  { name: 'tipRoutes', run: runTipRoutesTests },
  { name: 'uploadRoutes', run: runUploadRoutesTests },
  { name: 'publicFeedRoutes', run: runPublicFeedRoutesTests },
  { name: 'newsDate', run: runNewsDateTests, vitestNative: true },
  { name: 'webSpaRoutes', run: runWebSpaRoutesTests },
  { name: 'tetris', run: runTetrisTests },
  { name: 'touchSwipe', run: runTouchSwipeTests, vitestNative: true },
  { name: 'apiClientSession', run: runApiClientSessionTests, vitestNative: true },
  { name: 'blockBust', run: runBlockBustTests },
  { name: 'articleAdminForm', run: runArticleAdminFormTests, vitestNative: true },
  { name: 'articleReactions', run: runArticleReactionsTests, vitestNative: true },
  { name: 'quizGame', run: runQuizGameTests, vitestNative: true },
];
