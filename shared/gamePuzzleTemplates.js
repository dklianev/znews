import { getCrosswordEntries } from './crossword.js';
import { analyzeSpellingBeeWords } from './spellingBee.js';

const DEFAULT_WORD_LENGTH = 5;
const DEFAULT_WORD_ATTEMPTS = 6;
const DEFAULT_KEYBOARD_LAYOUT = 'bg';
const DEFAULT_QUIZ_QUESTION_COUNT = 10;
const DEFAULT_HANGMAN_MISTAKES = 7;
const DEFAULT_SPELLING_BEE_MIN_WORD_LENGTH = 4;

const HANGMAN_SEED_PRESETS = Object.freeze([
  {
    difficulty: 'easy',
    category: 'Градски теми',
    hint: 'Място, човек, маршрут или квартална история, които редакторът трябва да замени с локална тема.',
    answerLength: 8,
    maxMistakes: 8,
    editorNotes: 'Добър стартов шаблон за по-лека бесеница с локален нюзрум контекст.',
  },
  {
    difficulty: 'medium',
    category: 'Разследвания',
    hint: 'Подсказка за новинарски сюжет, институция или публична фигура.',
    answerLength: 9,
    maxMistakes: 7,
    editorNotes: 'Този шаблон е за по-плътен news hook и малко по-трудна дума.',
  },
  {
    difficulty: 'hard',
    category: 'Документи',
    hint: 'Използвай дума от казус, протокол, улика или регистър.',
    answerLength: 10,
    maxMistakes: 6,
    editorNotes: 'Подходящо за по-сериозен тон и по-рядка дума.',
  },
]);

const SPELLING_BEE_SEED_PRESETS = Object.freeze([
  {
    difficulty: 'medium',
    title: 'TODO Spelling Bee заглавие',
    deck: 'TODO: смени буквите и думите с по-силен редакционен сет, преди да публикуваш.',
    centerLetter: 'A',
    outerLetters: ['P', 'R', 'E', 'N', 'T', 'L'],
    words: ['PEAR', 'PEARL', 'PANEL', 'PLANET', 'PARENT', 'RELATE', 'LATE', 'TEAR', 'TEAL', 'LEARN', 'ALERT', 'ALTER', 'LANTERN', 'PARENTAL'],
    editorNotes: 'Използвай този сет като structural пример и го смени с тематични думи за деня.',
  },
  {
    difficulty: 'medium',
    title: 'TODO Meden кошер',
    deck: 'TODO: замени примерните английски думи с реален сет за деня.',
    centerLetter: 'O',
    outerLetters: ['S', 'H', 'T', 'N', 'E', 'M'],
    words: ['SOME', 'STONE', 'THOSE', 'HONEST', 'MOOSE', 'TONE', 'NOTE', 'SHEET', 'SOMEONE', 'SMOOTHEN'],
    editorNotes: 'Шаблон с различен център и поне една дълга панграма.',
  },
  {
    difficulty: 'hard',
    title: 'TODO Пчелен рой',
    deck: 'TODO: подмени този seed с по-труден тематичен набор.',
    centerLetter: 'I',
    outerLetters: ['B', 'R', 'D', 'G', 'N', 'E'],
    words: ['BIRD', 'BRING', 'BEGIN', 'BINGE', 'DIRGE', 'RIDING', 'BRIDGE', 'BIRDING'],
    editorNotes: 'Този шаблон е по-труден и разчита на по-дълги думи около една силна панграма.',
  },
]);

const CROSSWORD_LAYOUT_PRESETS = Object.freeze([
  {
    difficulty: 'easy',
    width: 5,
    height: 5,
    title: 'Мини кръстословица',
    deck: '5x5 мрежа с редакторски подсказки и място за локални теми.',
    themeLabel: 'местни новини',
    editorNotes: 'Пази подсказките стегнати и ориентирани към бързо решаване.',
    layout: ['.....', '.....', '.....', '.....', '.....'],
  },
  {
    difficulty: 'medium',
    width: 6,
    height: 6,
    title: 'Редакторска кръстословица',
    deck: 'По-плътна мрежа с блокирани клетки за по-интересен ритъм.',
    themeLabel: 'репортерски теми',
    editorNotes: 'Работи добре за по-балансирана daily трудност.',
    layout: ['......', '......', '..##..', '..##..', '......', '......'],
  },
  {
    difficulty: 'hard',
    width: 7,
    height: 7,
    title: 'Дълъг нюзрум grid',
    deck: 'По-голям daily формат с повече празни клетки и по-дълги думи.',
    themeLabel: 'дълги форми',
    editorNotes: 'Оставяй ясни подсказки, защото решението отнема повече време.',
    layout: ['.......', '.......', '..###..', '..###..', '..###..', '.......', '.......'],
  },
]);

export const GAME_EDITOR_GUIDES = Object.freeze({
  word: {
    title: 'Дума на деня',
    summary: 'Подготви кратка тайна дума и пълен списък с валидни опити.',
    checklist: [
      'Отговорът е с точната дължина и е реална дума.',
      'Allowed guesses списъкът е обновен и без placeholder записи.',
      'Пъзелът има ясен news hook или тематична причина да е днес.',
    ],
    workflow: [
      '1. Избери дума с ясен news hook или локален контекст.',
      '2. Добави позволени guess думи и провери дължината им.',
      '3. Запази като draft и публикувай, когато placeholder съдържанието е сменено.',
    ],
  },
  hangman: {
    title: 'Бесеница',
    summary: 'Настрой дума, категория и подсказка за бърза дневна игра.',
    checklist: [
      'Категорията и hint-ът са конкретни, а не общи placeholder-и.',
      'Думата няма интервали и е подходяща за избраната трудност.',
      'Preview-ът показва ясен контекст още преди publish.',
    ],
    workflow: [
      '1. Избери дума без интервали и с ясен тематичен ъгъл.',
      '2. Дай подсказка, която насочва, без да издава отговора.',
      '3. Прегледай preview-а и публикувай чак след смяна на placeholder текста.',
    ],
  },
  spellingbee: {
    title: 'Spelling Bee',
    summary: 'Създай кошер от 7 уникални букви и списък с всички валидни думи.',
    checklist: [
      'Кошерът има 7 уникални букви и няма дубликати.',
      'Има поне една панграма и валиден списък с думи.',
      'Заглавието и deck-ът са редакционни, а не seed placeholder текст.',
    ],
    workflow: [
      '1. Задай централната буква и още шест външни букви без повторения.',
      '2. Добави всички валидни думи и провери поне една панграма.',
      '3. Използвай stats панела, за да видиш броя думи, панграми и максимален резултат.',
    ],
  },
  connections: {
    title: 'Връзки',
    summary: 'Подреди 16 елемента в 4 групи с ясни теми и трудност.',
    checklist: [
      'Всичките 16 елемента са уникални и групирани коректно.',
      'Всяка група има ясен label и логично обяснение.',
      'Няма placeholder думи в board-а или solution групите.',
    ],
    workflow: [
      '1. Напиши всички 16 елемента на дъската.',
      '2. Попълни 4-те групи с етикети и обяснения.',
      '3. Прегледай дали няма placeholder стойности преди publish.',
    ],
  },
  crossword: {
    title: 'Кръстословица',
    summary: 'Редактирай grid, решение и подсказки в един и същ flow.',
    checklist: [
      'Layout-ът има работещи across/down entry-та и добър ритъм.',
      'Всички clues са попълнени и съответстват на solution grid-а.',
      'Няма останали ? клетки в решението преди publish.',
    ],
    workflow: [
      '1. Настрой ширина, височина и layout на мрежата.',
      '2. Попълни solution grid-а и после синхронизирай всички подсказки.',
      '3. Ако пъзелът е за повече от ден, настрой и активния период.',
    ],
  },
  quiz: {
    title: 'Ерудит',
    summary: 'Подготви въпроси с общи знания — 4 опции, верен отговор и обяснение.',
    checklist: [
      'Всеки въпрос има 4 смислени опции и правилен correctIndex.',
      'Explanation полетата са полезни, когато играчът сгреши.',
      'Няма placeholder текстове в prompt-ове, options или explanation.',
    ],
    workflow: [
      '1. Добави 10 въпроса (от лесни към трудни) за пълно изживяване.',
      '2. Провери всеки correctIndex и всички 4 опции.',
      '3. Публикувай едва когато въпросите и обясненията са финални.',
    ],
  },
});

function getSeedIndex(puzzleDate, itemCount) {
  const size = Math.max(1, Number.parseInt(itemCount, 10) || 1);
  const digits = String(puzzleDate || '').replace(/\D/g, '');
  let hash = 17;
  for (const char of digits) {
    hash = (hash * 31 + Number.parseInt(char, 10)) % 2147483647;
  }
  return hash % size;
}

function pickSeed(puzzleDate, presets) {
  const safePresets = Array.isArray(presets) && presets.length > 0 ? presets : [{}];
  return safePresets[getSeedIndex(puzzleDate, safePresets.length)] || safePresets[0];
}

function createTodoAnswer(length) {
  const targetLength = Math.max(4, Number.parseInt(length, 10) || 8);
  let value = 'TODO';
  const suffix = 'WORDNEWSROOMSEED';
  while (value.length < targetLength) value += suffix;
  return value.slice(0, targetLength).toUpperCase();
}

function createCrosswordPlaceholderGrid(layoutRows) {
  return (Array.isArray(layoutRows) ? layoutRows : []).map((row) => Array.from(String(row || '')).map((cell) => (cell === '#' ? '#' : '?')).join(''));
}

function buildCrosswordClues(layout, preset) {
  const entries = getCrosswordEntries(layout);
  const clueTheme = preset?.themeLabel || 'редакционна тема';

  return {
    across: entries.across.map((entry, index) => ({
      number: entry.number,
      row: entry.row,
      col: entry.col,
      length: entry.length,
      clue: `TODO хоризонтална ${index + 1} - следа по тема „${clueTheme}“ (${entry.length} букви)`,
    })),
    down: entries.down.map((entry, index) => ({
      number: entry.number,
      row: entry.row,
      col: entry.col,
      length: entry.length,
      clue: `TODO вертикална ${index + 1} - следа по тема „${clueTheme}“ (${entry.length} букви)`,
    })),
  };
}

function buildWordTemplate() {
  return {
    difficulty: 'medium',
    status: 'draft',
    editorNotes: '',
    payload: {
      wordLength: DEFAULT_WORD_LENGTH,
      maxAttempts: DEFAULT_WORD_ATTEMPTS,
      keyboardLayout: DEFAULT_KEYBOARD_LAYOUT,
    },
    solution: {
      answer: 'TODO5',
      allowedWords: [],
    },
  };
}

function buildHangmanTemplate(puzzleDate = '') {
  const preset = pickSeed(puzzleDate, HANGMAN_SEED_PRESETS);
  return {
    difficulty: preset.difficulty || 'medium',
    status: 'draft',
    editorNotes: preset.editorNotes || '',
    payload: {
      category: preset.category || 'Градски теми',
      hint: preset.hint || 'Подсказка за деня.',
      maxMistakes: preset.maxMistakes || DEFAULT_HANGMAN_MISTAKES,
      keyboardLayout: DEFAULT_KEYBOARD_LAYOUT,
      answerLength: preset.answerLength || 8,
    },
    solution: {
      answer: createTodoAnswer(preset.answerLength || 8),
    },
  };
}

function buildSpellingBeeTemplate(puzzleDate = '') {
  const preset = pickSeed(puzzleDate, SPELLING_BEE_SEED_PRESETS);
  const analysis = analyzeSpellingBeeWords(preset.words || [], {
    centerLetter: preset.centerLetter,
    outerLetters: preset.outerLetters,
    minWordLength: DEFAULT_SPELLING_BEE_MIN_WORD_LENGTH,
  });

  return {
    difficulty: preset.difficulty || 'medium',
    status: 'draft',
    editorNotes: preset.editorNotes || '',
    payload: {
      title: preset.title || 'TODO Spelling Bee заглавие',
      deck: preset.deck || 'TODO: смени буквите и думите преди publish.',
      centerLetter: preset.centerLetter || '',
      outerLetters: Array.isArray(preset.outerLetters) ? preset.outerLetters : [],
      minWordLength: DEFAULT_SPELLING_BEE_MIN_WORD_LENGTH,
      totalWords: analysis.totalWords,
      pangramCount: analysis.pangramCount,
      maxScore: analysis.maxScore,
      longestWordLength: analysis.longestWordLength,
    },
    solution: {
      words: analysis.acceptedWords,
      pangrams: analysis.pangrams,
      scoreByWord: analysis.scoreByWord,
    },
  };
}

function buildConnectionsItems() {
  return Array.from({ length: 16 }, (_, index) => `TODO${index + 1}`);
}

function buildConnectionsGroups(items) {
  return Array.from({ length: 4 }, (_, index) => ({
    label: `TODO GROUP ${index + 1}`,
    difficulty: String(index + 1),
    items: items.slice(index * 4, index * 4 + 4),
    explanation: '',
  }));
}

function buildConnectionsTemplate() {
  const items = buildConnectionsItems();
  return {
    difficulty: 'medium',
    status: 'draft',
    editorNotes: '',
    payload: { items },
    solution: { groups: buildConnectionsGroups(items) },
  };
}

function buildCrosswordTemplate(puzzleDate = '') {
  const preset = pickSeed(puzzleDate, CROSSWORD_LAYOUT_PRESETS);
  const layout = [...(preset.layout || [])];
  return {
    difficulty: preset.difficulty || 'medium',
    status: 'draft',
    editorNotes: preset.editorNotes || '',
    payload: {
      title: preset.title || 'Мини кръстословица',
      deck: preset.deck || 'Grid шаблон за дневен пъзел.',
      width: preset.width || (layout[0] ? String(layout[0]).length : 5),
      height: preset.height || layout.length || 5,
      layout,
      clues: buildCrosswordClues(layout, preset),
    },
    solution: {
      grid: createCrosswordPlaceholderGrid(layout),
    },
  };
}

function buildQuizQuestion(index) {
  return {
    question: `TODO: въпрос номер ${index + 1}`,
    options: ['TODO A', 'TODO B', 'TODO C', 'TODO D'],
    correctIndex: 0,
    explanation: '',
  };
}

function buildQuizTemplate() {
  return {
    difficulty: 'medium',
    status: 'draft',
    editorNotes: '',
    payload: {
      questions: Array.from({ length: DEFAULT_QUIZ_QUESTION_COUNT }, (_, index) => buildQuizQuestion(index)),
    },
    solution: {},
  };
}

export function createGamePuzzleTemplate(gameSlug, puzzleDate = '') {
  let template;
  if (gameSlug === 'word') template = buildWordTemplate();
  else if (gameSlug === 'hangman') template = buildHangmanTemplate(puzzleDate);
  else if (gameSlug === 'spellingbee') template = buildSpellingBeeTemplate(puzzleDate);
  else if (gameSlug === 'connections') template = buildConnectionsTemplate();
  else if (gameSlug === 'crossword') template = buildCrosswordTemplate(puzzleDate);
  else if (gameSlug === 'quiz') template = buildQuizTemplate();
  else {
    throw new Error(`Unsupported game slug: ${gameSlug}`);
  }

  return {
    puzzleDate,
    activeUntilDate: puzzleDate,
    ...template,
  };
}
