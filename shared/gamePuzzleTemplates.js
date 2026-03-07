import { getCrosswordEntries } from './crossword.js';

const DEFAULT_WORD_LENGTH = 5;
const DEFAULT_WORD_ATTEMPTS = 6;
const DEFAULT_KEYBOARD_LAYOUT = 'bg';
const DEFAULT_QUIZ_QUESTION_COUNT = 5;
const DEFAULT_HANGMAN_MISTAKES = 7;

const HANGMAN_SEED_PRESETS = Object.freeze([
  {
    difficulty: 'easy',
    category: 'Градска среда',
    hint: 'Избери дума за квартал, улица, площад или градска точка от локална тема.',
    answerLength: 8,
    maxMistakes: 8,
    editorNotes: 'Търси кратко познато име без интервали. Добър избор е място от водеща local story.',
  },
  {
    difficulty: 'medium',
    category: 'Институции',
    hint: 'Подходящи са служба, сграда или обществена институция, споменати в новина.',
    answerLength: 9,
    maxMistakes: 7,
    editorNotes: 'Използвай дума, която аудиторията може да разпознае по контекст, но не прекалено лесно.',
  },
  {
    difficulty: 'medium',
    category: 'Спорт',
    hint: 'Може да е клуб, дисциплина, стадион или фамилия, свързани с местен спортен сюжет.',
    answerLength: 7,
    maxMistakes: 7,
    editorNotes: 'Подходящо за дни със силен спортен поток. Избягвай твърде нишови имена.',
  },
  {
    difficulty: 'hard',
    category: 'Нощен живот',
    hint: 'Търси дума от културно събитие, заведение, район или жаргонна тема от вечерния ритъм.',
    answerLength: 10,
    maxMistakes: 6,
    editorNotes: 'Работи добре за по-игрови, по-провокативен дневен пакет. Дръж подсказката кратка.',
  },
  {
    difficulty: 'easy',
    category: 'Хора и роли',
    hint: 'Избери дума за професия, роля или тип персонаж от водещ местен сюжет.',
    answerLength: 6,
    maxMistakes: 8,
    editorNotes: 'Използвай общопозната дума, за да стане по-достъпен дневен рунд.',
  },
]);

const CROSSWORD_LAYOUT_PRESETS = Object.freeze([
  {
    difficulty: 'easy',
    width: 5,
    height: 5,
    title: 'Сутрешен градски спринт',
    deck: 'Бърз 5x5 daily grid за квартали, места и кратки news асоциации.',
    themeLabel: 'градски ритъм',
    editorNotes: 'Дръж думите кратки и ясни. Подходящо за лесна кръстословица с бърз solve.',
    layout: [
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
    ],
  },
  {
    difficulty: 'medium',
    width: 6,
    height: 6,
    title: 'Редакционен микс',
    deck: 'Среден по размер grid с микс от имена, институции и културни ориентири.',
    themeLabel: 'редакционен микс',
    editorNotes: 'Добър формат за баланс между общи думи и по-конкретни local препратки.',
    layout: [
      '......',
      '......',
      '..##..',
      '..##..',
      '......',
      '......',
    ],
  },
  {
    difficulty: 'hard',
    width: 7,
    height: 7,
    title: 'Уикенд кръстословица',
    deck: 'По-дълъг daily пакет за по-амбициозен solve с водещи имена, места и теми.',
    themeLabel: 'уикенд пакет',
    editorNotes: 'Ползвай по-силна тематична връзка между думите. Идеално за по-тежък неделен draft.',
    layout: [
      '.......',
      '.......',
      '..###..',
      '..###..',
      '..###..',
      '.......',
      '.......',
    ],
  },
]);

export const GAME_EDITOR_GUIDES = Object.freeze({
  word: {
    title: 'Дума на деня',
    summary: 'Подготви 5-буквена дума и до шест опита с допустими предположения.',
    workflow: [
      '1. Въведи думата за деня.',
      '2. Добави допустимите guesses и дължината на думата.',
      '3. Запази като draft и публикувай едва след финална проверка.',
    ],
    checklist: [
      'Отговорът трябва да е с точната дължина.',
      'Преди publish няма TODO placeholders.',
      'Допустимите guesses са със същата дължина като думата.',
    ],
  },
  hangman: {
    title: 'Бесеница',
    summary: 'Скрита дума, подсказка и лимит на грешките за дневна партия.',
    workflow: [
      '1. Въведи отговора, категорията и кратката подсказка.',
      '2. Избери колко грешки са позволени и каква клавиатура да вижда играчът.',
      '3. Прегледай preview-то и публикувай едва след замяна на placeholder текста.',
    ],
    checklist: [
      'Отговорът е една дума без интервали.',
      'Категорията и подсказката не издават директно решението.',
      'Лимитът на грешките е между 4 и 10.',
    ],
  },
  connections: {
    title: 'Връзки',
    summary: 'Събери 16 думи в 4 групи, всяка с обща тема и 4 логически свързани думи.',
    workflow: [
      '1. Попълни 16-те думи на дъската.',
      '2. Подреди 4-те групи с етикет и описание.',
      '3. Запази като draft и публикувай след проверка на всички групи.',
    ],
    checklist: [
      'Има точно 16 уникални елемента.',
      'Всяка група съдържа точно 4 думи.',
      'Етикетите са смислени и без placeholders.',
    ],
  },
  crossword: {
    title: 'Кръстословица',
    summary: 'Мини кръстословица с мрежа, хоризонтални и вертикални улики.',
    workflow: [
      '1. Настрой размера на мрежата и блокираните клетки.',
      '2. Попълни решението и напиши всички улики за стартиращите думи.',
      '3. Прегледай active clue списъка и публикувай след пълна проверка.',
    ],
    checklist: [
      'Мрежата и решението са с еднакви размери.',
      'За всяка стартова дума има улика.',
      'Няма TODO placeholders в заглавието, deck-а или уликите.',
    ],
  },
  quiz: {
    title: 'Новинарски тест',
    summary: 'Подготви поредица от въпроси с по четири отговора и кратки обяснения.',
    workflow: [
      '1. Добави поне един въпрос по темата.',
      '2. За всеки въпрос въведи четири отговора и маркирай правилния.',
      '3. Запази като draft и публикувай след финална проверка.',
    ],
    checklist: [
      'Препоръчително: 5 въпроса за деня.',
      'Всеки въпрос има точно 4 отговора.',
      'Обясненията са готови за публикуване и без placeholders.',
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
  const clueTheme = preset?.themeLabel || 'дневна тема';

  return {
    across: entries.across.map((entry, index) => ({
      number: entry.number,
      row: entry.row,
      col: entry.col,
      length: entry.length,
      clue: `TODO хоризонтална ${index + 1} - дума по темата "${clueTheme}" (${entry.length} букви)`,
    })),
    down: entries.down.map((entry, index) => ({
      number: entry.number,
      row: entry.row,
      col: entry.col,
      length: entry.length,
      clue: `TODO вертикална ${index + 1} - дума по темата "${clueTheme}" (${entry.length} букви)`,
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
      category: preset.category || 'Градска среда',
      hint: preset.hint || 'Избери дневна дума с местен контекст.',
      maxMistakes: preset.maxMistakes || DEFAULT_HANGMAN_MISTAKES,
      keyboardLayout: DEFAULT_KEYBOARD_LAYOUT,
      answerLength: preset.answerLength || 8,
    },
    solution: {
      answer: createTodoAnswer(preset.answerLength || 8),
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
    payload: {
      items,
    },
    solution: {
      groups: buildConnectionsGroups(items),
    },
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
      deck: preset.deck || 'Смени заглавието, решението и всички улики преди публикуване.',
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
  else if (gameSlug === 'connections') template = buildConnectionsTemplate();
  else if (gameSlug === 'crossword') template = buildCrosswordTemplate(puzzleDate);
  else if (gameSlug === 'quiz') template = buildQuizTemplate();
  else {
    throw new Error(`Unsupported game slug: ${gameSlug}`);
  }

  return {
    puzzleDate,
    ...template,
  };
}
