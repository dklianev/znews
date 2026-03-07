import { GameDefinition, GamePuzzle } from './models.js';
import { createGamePuzzleTemplate } from '../shared/gamePuzzleTemplates.js';

export const DEFAULT_GAME_DEFINITIONS = Object.freeze([
  { id: 1, slug: 'word', title: 'Думата на деня', type: 'word', description: 'Познай тайната дума за деня за до шест опита.', icon: 'Type', active: true, sortOrder: 1, theme: 'green' },
  { id: 2, slug: 'connections', title: 'Връзки', type: 'connections', description: 'Групирай 16-те думи в 4 логически свързани категории.', icon: 'Link', active: true, sortOrder: 2, theme: 'indigo' },
  { id: 3, slug: 'quiz', title: 'Новинарски тест', type: 'quiz', description: 'Провери знанията си за най-важните местни истории.', icon: 'HelpCircle', active: true, sortOrder: 3, theme: 'orange' },
  { id: 4, slug: 'sudoku', title: 'Судоку', type: 'sudoku', description: 'Играй по всяко време и сменяй трудността от лесно до експерт.', icon: 'Grid3x3', active: true, sortOrder: 4, theme: 'purple' },
  { id: 5, slug: 'hangman', title: 'Бесеница', type: 'hangman', description: 'Отгатни думата буква по буква, преди шансовете ти да свършат.', icon: 'Type', active: true, sortOrder: 5, theme: 'orange' },
  { id: 6, slug: 'spellingbee', title: 'Spelling Bee', type: 'spellingbee', description: 'Събери възможно най-много думи от седем букви, като централната е задължителна.', icon: 'Hexagon', active: true, sortOrder: 6, theme: 'orange' },
  { id: 7, slug: 'crossword', title: 'Кръстословица', type: 'crossword', description: 'Попълни мини кръстословица с думи по хоризонтала и вертикала.', icon: 'Hash', active: true, sortOrder: 7, theme: 'indigo' },
]);

const DEFAULT_GAME_SLUGS = DEFAULT_GAME_DEFINITIONS.map((game) => game.slug);
const DEFAULT_PUZZLE_SEED_SLUGS = Object.freeze(['word', 'connections', 'quiz', 'hangman', 'spellingbee', 'crossword']);

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

  const existingDefinitions = await GameDefinition.find({
    $or: [
      { slug: { $in: definitions.map((definition) => definition.slug) } },
      { id: { $in: definitions.map((definition) => definition.id) } },
    ],
  }).lean();

  const existingBySlug = new Map(existingDefinitions.map((definition) => [definition.slug, definition]));
  const usedIds = new Set(
    existingDefinitions
      .map((definition) => Number.parseInt(definition.id, 10))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
  let nextAvailableId = Math.max(
    1,
    ...usedIds,
    ...definitions
      .map((definition) => Number.parseInt(definition.id, 10))
      .filter((value) => Number.isInteger(value) && value > 0),
  ) + 1;

  for (const definition of definitions) {
    const existingDefinition = existingBySlug.get(definition.slug);

    if (existingDefinition) {
      await GameDefinition.updateOne(
        { _id: existingDefinition._id },
        {
          $set: {
            title: definition.title,
            type: definition.type,
            description: definition.description,
            icon: definition.icon,
            active: definition.active,
            sortOrder: definition.sortOrder,
            theme: definition.theme,
            updatedAt: new Date(),
          },
        },
      );
      continue;
    }

    let assignedId = Number.parseInt(definition.id, 10);
    if (!Number.isInteger(assignedId) || assignedId <= 0 || usedIds.has(assignedId)) {
      while (usedIds.has(nextAvailableId)) nextAvailableId += 1;
      assignedId = nextAvailableId;
      nextAvailableId += 1;
    }

    await GameDefinition.create({
      ...definition,
      id: assignedId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    usedIds.add(assignedId);
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
