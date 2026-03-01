import { GameDefinition, GamePuzzle } from './models.js';
import { createGamePuzzleTemplate } from '../shared/gamePuzzleTemplates.js';

export const DEFAULT_GAME_DEFINITIONS = Object.freeze([
  { id: 1, slug: 'word', title: 'Думата на деня', type: 'word', description: 'Познай тайната 5-буквена дума за 6 опита.', icon: 'Type', active: true, sortOrder: 1, theme: 'green' },
  { id: 2, slug: 'connections', title: 'Връзки', type: 'connections', description: 'Групирай 16-те думи в 4 категории по 4 логически свързани думи.', icon: 'Link', active: true, sortOrder: 2, theme: 'indigo' },
  { id: 3, slug: 'quiz', title: 'Новинарски тест', type: 'quiz', description: 'Провери знанията си за събитията в града от изминалата седмица.', icon: 'HelpCircle', active: true, sortOrder: 3, theme: 'orange' },
]);

const DEFAULT_GAME_SLUGS = DEFAULT_GAME_DEFINITIONS.map((game) => game.slug);

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

export async function ensureGameDefinitions() {
  for (const definition of DEFAULT_GAME_DEFINITIONS) {
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
          updatedAt: new Date(),
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
  const gameSlugs = (hasExplicitGameSelection ? requestedSlugs : DEFAULT_GAME_SLUGS)
    .map((slug) => String(slug || '').trim().toLowerCase())
    .filter((slug, index, arr) => DEFAULT_GAME_SLUGS.includes(slug) && arr.indexOf(slug) === index);
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
  await ensureGameDefinitions();

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
          updatedAt: new Date(),
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
              updatedAt: new Date(),
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
