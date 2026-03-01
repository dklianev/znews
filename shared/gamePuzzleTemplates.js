const DEFAULT_WORD_LENGTH = 5;
const DEFAULT_WORD_ATTEMPTS = 6;
const DEFAULT_KEYBOARD_LAYOUT = 'bg';
const DEFAULT_QUIZ_QUESTION_COUNT = 5;

export const GAME_EDITOR_GUIDES = Object.freeze({
  word: {
    title: 'Думата на деня',
    summary: 'Въвеждаш 5-буквена дума и по желание списък с валидни допълнителни предположения.',
    workflow: [
      '1. Избери дата за пъзела.',
      '2. Попълни тайната дума и допустимите guesses.',
      '3. Запази като чернова и публикувай от списъка, когато е проверено.',
    ],
    checklist: [
      'Отговорът трябва да е точно 5 букви.',
      'Остави статуса на "Чернова", докато не провериш думата.',
      'Можеш да добавиш валидни guesses по един на ред.',
    ],
  },
  connections: {
    title: 'Връзки',
    summary: 'Попълваш 16 думи и 4 групи, всяка с име, трудност и 4 елемента.',
    workflow: [
      '1. Попълни 16-те думи на дъската.',
      '2. Подреди 4-те групи с техните 4 елемента.',
      '3. Запази като чернова и публикувай от списъка след финална проверка.',
    ],
    checklist: [
      'Всички 16 елемента трябва да са уникални.',
      'Всяка група трябва да има точно 4 елемента.',
      'Използвай кратки, ясни имена на групите.',
    ],
  },
  quiz: {
    title: 'Новинарски куиз',
    summary: 'Попълваш въпросите един по един с 4 отговора, верен индекс и кратко обяснение.',
    workflow: [
      '1. Добави въпросите един по един.',
      '2. За всеки въпрос посочи 4 отговора и кой е верният.',
      '3. Запази като чернова и публикувай от списъка след преглед.',
    ],
    checklist: [
      'Препоръчително: 5 въпроса на игра.',
      'Всеки въпрос трябва да има точно 4 опции.',
      'Пиши кратко обяснение, за да е ясно защо отговорът е верен.',
    ],
  },
});

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

function buildQuizQuestion(index) {
  return {
    question: `TODO: добави въпрос ${index + 1}`,
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
  else if (gameSlug === 'connections') template = buildConnectionsTemplate();
  else if (gameSlug === 'quiz') template = buildQuizTemplate();
  else {
    throw new Error(`Unsupported game slug: ${gameSlug}`);
  }

  return {
    puzzleDate,
    ...template,
  };
}
