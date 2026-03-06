import { GameDefinition, GamePuzzle } from './models.js';
import { createGamePuzzleTemplate } from '../shared/gamePuzzleTemplates.js';

export const DEFAULT_GAME_DEFINITIONS = Object.freeze([
  { id: 1, slug: 'word', title: '\u0414\u0443\u043c\u0430\u0442\u0430 \u043d\u0430 \u0434\u0435\u043d\u044f', type: 'word', description: '\u041f\u043e\u0437\u043d\u0430\u0439 \u0442\u0430\u0439\u043d\u0430\u0442\u0430 5-\u0431\u0443\u043a\u0432\u0435\u043d\u0430 \u0434\u0443\u043c\u0430 \u0437\u0430 6 \u043e\u043f\u0438\u0442\u0430.', icon: 'Type', active: true, sortOrder: 1, theme: 'green' },
  { id: 2, slug: 'connections', title: '\u0412\u0440\u044a\u0437\u043a\u0438', type: 'connections', description: '\u0413\u0440\u0443\u043f\u0438\u0440\u0430\u0439 16-\u0442\u0435 \u0434\u0443\u043c\u0438 \u0432 4 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043f\u043e 4 \u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438 \u0441\u0432\u044a\u0440\u0437\u0430\u043d\u0438 \u0434\u0443\u043c\u0438.', icon: 'Link', active: true, sortOrder: 2, theme: 'indigo' },
  { id: 3, slug: 'quiz', title: '\u041d\u043e\u0432\u0438\u043d\u0430\u0440\u0441\u043a\u0438 \u0442\u0435\u0441\u0442', type: 'quiz', description: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438 \u0437\u043d\u0430\u043d\u0438\u044f\u0442\u0430 \u0441\u0438 \u0437\u0430 \u0441\u044a\u0431\u0438\u0442\u0438\u044f\u0442\u0430 \u0432 \u0433\u0440\u0430\u0434\u0430 \u043e\u0442 \u0438\u0437\u043c\u0438\u043d\u0430\u043b\u0430\u0442\u0430 \u0441\u0435\u0434\u043c\u0438\u0446\u0430.', icon: 'HelpCircle', active: true, sortOrder: 3, theme: 'orange' },
  { id: 4, slug: 'sudoku', title: '\u0421\u0443\u0434\u043e\u043a\u0443', type: 'sudoku', description: '\u0411\u0435\u0437\u043a\u0440\u0430\u0439\u043d\u043e \u0421\u0443\u0434\u043e\u043a\u0443 \u0441 \u041b\u0435\u0441\u043d\u043e, \u0421\u0440\u0435\u0434\u043d\u043e, \u0422\u0440\u0443\u0434\u043d\u043e \u0438 \u0415\u043a\u0441\u043f\u0435\u0440\u0442.', icon: 'Grid3x3', active: true, sortOrder: 4, theme: 'purple' },
]);

const DEFAULT_GAME_SLUGS = DEFAULT_GAME_DEFINITIONS.map((game) => game.slug);
const DEFAULT_PUZZLE_SEED_SLUGS = Object.freeze(['word', 'connections', 'quiz']);

function isValidDateStr(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function currentSofiaDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function seedError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function getSofiaDateString(offsetDays = 0) {
  return addDaysToDateStr(currentSofiaDateString(), offsetDays);
}

export function addDaysToDateStr(dateStr, offsetDays) {
  const safeDate = isValidDateStr(dateStr) ? dateStr : currentSofiaDateString();
  const [year, month, day] = safeDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

export async function ensureGameDefinitions(gameSlugs = DEFAULT_GAME_SLUGS) {
  const targetSlugs = Array.isArray(gameSlugs) && gameSlugs.length > 0 ? gameSlugs : DEFAULT_GAME_SLUGS;
  const definitions = DEFAULT_GAME_DEFINITIONS.filter((definition) => targetSlugs.includes(definition.slug));

  for (const definition of definitions) {
    await GameDefinition.updateOne(
      { slug: definition.slug },
      {
        $set: {
          title: definition.title,
          type: definition.type,
          description: definition.description,
          icon: definition.icon,
          sortOrder: definition.sortOrder,
          theme: definition.theme,
        },
        $setOnInsert: {
          id: definition.id,
          active: definition.active,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}

function normalizeSeedOptions(options = {}) {
  const hasExplicitGameSelection = Object.prototype.hasOwnProperty.call(options, 'gameSlugs');
  const requestedSlugs = Array.isArray(options.gameSlugs)
    ? options.gameSlugs
    : typeof options.gameSlugs === 'string'
      ? options.gameSlugs.split(',').map((item) => item.trim())
      : [];
  const gameSlugs = (hasExplicitGameSelection ? requestedSlugs : DEFAULT_PUZZLE_SEED_SLUGS)
    .map((slug) => String(slug || '').trim().toLowerCase())
    .filter((slug, index, arr) => DEFAULT_PUZZLE_SEED_SLUGS.includes(slug) && arr.indexOf(slug) === index);
  const startDate = isValidDateStr(options.startDate) ? options.startDate : getSofiaDateString(1);
  const days = Math.max(1, Math.min(Number.parseInt(options.days, 10) || 30, 62));

  if (gameSlugs.length === 0) {
    throw seedError('Select at least one supported game before generating drafts.');
  }

  return {
    startDate,
    days,
    gameSlugs,
    overwriteDrafts: Boolean(options.overwriteDrafts),
  };
}

export async function seedGamesOnly(options = {}) {
  const config = normalizeSeedOptions(options);
  await ensureGameDefinitions(config.gameSlugs);

  const maxExistingId = await GamePuzzle.findOne().sort({ id: -1 }).lean();
  let nextId = Math.max(0, maxExistingId?.id || 0) + 1;
  const results = {
    ...config,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    created: [],
    updated: [],
    skipped: [],
  };

  for (const slug of config.gameSlugs) {
    for (let dayOffset = 0; dayOffset < config.days; dayOffset += 1) {
      const puzzleDate = addDaysToDateStr(config.startDate, dayOffset);
      const existingPuzzle = await GamePuzzle.findOne({ gameSlug: slug, puzzleDate }).lean();

      if (!existingPuzzle) {
        const template = createGamePuzzleTemplate(slug, puzzleDate);
        await GamePuzzle.create({
          id: nextId,
          gameSlug: slug,
          ...template,
          createdAt: new Date(),
        });
        results.createdCount += 1;
        results.created.push({ gameSlug: slug, puzzleDate, id: nextId });
        nextId += 1;
        continue;
      }

      if (config.overwriteDrafts && existingPuzzle.status === 'draft') {
        const template = createGamePuzzleTemplate(slug, puzzleDate);
        await GamePuzzle.updateOne(
          { id: existingPuzzle.id, gameSlug: slug },
          {
            $set: {
              difficulty: template.difficulty,
              editorNotes: template.editorNotes,
              payload: template.payload,
              solution: template.solution,
            },
          }
        );
        results.updatedCount += 1;
        results.updated.push({ gameSlug: slug, puzzleDate, id: existingPuzzle.id });
      } else {
        results.skippedCount += 1;
        results.skipped.push({
          gameSlug: slug,
          puzzleDate,
          id: existingPuzzle.id,
          status: existingPuzzle.status,
        });
      }
    }
  }

  return results;
}




