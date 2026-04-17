import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import { GameDefinition, GamePuzzle } from '../models.js';
import { DEFAULT_GAME_DEFINITIONS } from '../gameSeed.js';
import { createGamePuzzleHelpers } from '../services/gamePuzzleHelpersService.js';
import {
  analyzeSpellingBeeWords,
  hasCompleteSpellingBeeHive,
  normalizeSpellingBeeLetter,
  normalizeSpellingBeeOuterLetters,
} from '../../shared/spellingBee.js';
import {
  STRANDS_COLS,
  STRANDS_ROWS,
  STRANDS_TOTAL_CELLS,
  analyzeCoverage as analyzeStrandsCoverage,
  buildWordFromPath as buildStrandsWordFromPath,
  doesPathSpanBoard,
  isPathValid as isStrandsPathValid,
  matchPathToAnswer,
  normalizeGrid as normalizeStrandsGrid,
} from '../../shared/strands.js';
import { getCrosswordEntries } from '../../shared/crossword.js';

const CURATED_DATES = Object.freeze(['2026-04-17', '2026-04-18']);
const CURATED_SLUGS = Object.freeze(['word', 'connections', 'quiz', 'hangman', 'spellingbee', 'strands']);
const PLACEHOLDER_URI_PATTERN = /YOUR_PASSWORD|xxxxx|user:password/i;
const CURATED_STRANDS_PATHS = Object.freeze([
  Object.freeze([0, 7, 8, 3, 4, 5]),
  Object.freeze([1, 2, 9, 10, 11, 17]),
  Object.freeze([6, 12, 13, 14, 15, 16]),
  Object.freeze([18, 19, 20, 21, 22, 23]),
  Object.freeze([24, 25, 26, 27, 28, 29]),
  Object.freeze([30, 31, 32, 33, 34, 35]),
  Object.freeze([36, 37, 38, 39, 40, 41]),
  Object.freeze([42, 43, 44, 45, 46, 47]),
]);

function createCuratedSpellingBeePuzzle({
  puzzleDate,
  activeUntilDate = puzzleDate,
  status = 'published',
  difficulty = 'medium',
  editorNotes = '',
  title,
  deck,
  centerLetter,
  outerLetters,
  words,
}) {
  const safeCenterLetter = normalizeSpellingBeeLetter(centerLetter);
  const safeOuterLetters = normalizeSpellingBeeOuterLetters(outerLetters);
  const analysis = analyzeSpellingBeeWords(words, {
    centerLetter: safeCenterLetter,
    outerLetters: safeOuterLetters,
    minWordLength: 4,
  });

  if (!hasCompleteSpellingBeeHive(safeCenterLetter, safeOuterLetters)) {
    throw new Error(`Невалиден curated Spelling Bee кошер за ${puzzleDate}.`);
  }
  if (analysis.rejectedWords.length > 0) {
    throw new Error(`Curated Spelling Bee съдържа невалидни думи за ${puzzleDate}: ${analysis.rejectedWords.map((item) => `${item.word}:${item.reason}`).join(', ')}`);
  }

  return {
    puzzleDate,
    activeUntilDate,
    status,
    difficulty,
    editorNotes,
    payload: {
      title: normalizeText(title, 120),
      deck: normalizeText(deck, 280),
      centerLetter: safeCenterLetter,
      outerLetters: safeOuterLetters,
      minWordLength: 4,
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

function buildCuratedStrandsGrid(words, paths = CURATED_STRANDS_PATHS) {
  if (!Array.isArray(words) || words.length !== paths.length) {
    throw new Error(`Curated Strands изисква точно ${paths.length} думи.`);
  }

  const cells = Array(STRANDS_TOTAL_CELLS).fill('');
  words.forEach((word, wordIndex) => {
    const letters = Array.from(normalizeText(word, 64).toUpperCase().replace(/\s+/g, ''));
    const path = paths[wordIndex];
    if (letters.length !== path.length) {
      throw new Error(`Curated Strands думата "${word}" няма правилната дължина за path #${wordIndex + 1}.`);
    }

    path.forEach((cell, letterIndex) => {
      const letter = letters[letterIndex];
      if (cells[cell] && cells[cell] !== letter) {
        throw new Error(`Curated Strands има конфликт в клетка ${cell} за думата "${word}".`);
      }
      cells[cell] = letter;
    });
  });

  if (cells.some((letter) => !letter)) {
    throw new Error('Curated Strands grid остава с непопълнени клетки.');
  }

  return Array.from(
    { length: STRANDS_ROWS },
    (_, rowIndex) => cells.slice(rowIndex * STRANDS_COLS, (rowIndex + 1) * STRANDS_COLS).join('')
  );
}

function createCuratedStrandsPuzzle({
  puzzleDate,
  activeUntilDate = puzzleDate,
  status = 'published',
  difficulty = 'medium',
  editorNotes = '',
  title,
  deck,
  spangram,
  themeWords,
}) {
  const words = [
    normalizeText(spangram, 64).toUpperCase().replace(/\s+/g, ''),
    ...sanitizeStringArray(themeWords, 64, { uppercase: true }).map((word) => word.replace(/\s+/g, '')),
  ];
  const grid = buildCuratedStrandsGrid(words);
  const answers = CURATED_STRANDS_PATHS.map((cells, index) => ({
    kind: index === 0 ? 'spangram' : 'theme',
    word: words[index],
    cells: [...cells],
  }));

  answers.forEach((answer) => {
    if (!isStrandsPathValid(answer.cells)) {
      throw new Error(`Curated Strands path е невалиден за думата "${answer.word}" на ${puzzleDate}.`);
    }
    const rebuiltWord = buildStrandsWordFromPath(answer.cells, grid);
    if (rebuiltWord !== answer.word) {
      throw new Error(`Curated Strands grid не възстановява "${answer.word}" на ${puzzleDate}.`);
    }
  });

  const coverage = analyzeStrandsCoverage(answers);
  if (!coverage.isComplete) {
    throw new Error(`Curated Strands coverage е непълно за ${puzzleDate}.`);
  }
  if (!doesPathSpanBoard(answers[0].cells)) {
    throw new Error(`Curated Strands spangram не пресича борда за ${puzzleDate}.`);
  }

  return {
    puzzleDate,
    activeUntilDate,
    status,
    difficulty,
    editorNotes,
    payload: {
      title: normalizeText(title, 120),
      deck: normalizeText(deck, 280),
      rows: STRANDS_ROWS,
      cols: STRANDS_COLS,
      grid,
    },
    solution: {
      answers,
    },
  };
}

const CURATED_PUZZLES = Object.freeze({
  '2026-04-17': {
    word: {
      puzzleDate: '2026-04-17',
      activeUntilDate: '2026-04-17',
      status: 'published',
      difficulty: 'medium',
      editorNotes: 'Кратка и ударна дума за дневния рунд.',
      payload: {
        wordLength: 5,
        maxAttempts: 6,
        keyboardLayout: 'bg',
      },
      solution: {
        answer: 'РИТЪМ',
        allowedWords: ['РИТЪМ'],
      },
    },
    hangman: {
      puzzleDate: '2026-04-17',
      activeUntilDate: '2026-04-17',
      status: 'published',
      difficulty: 'medium',
      editorNotes: 'Медийна дума с ясен hint и без интервали.',
      payload: {
        category: 'Медия',
        hint: 'Мястото, където текстът, кадрите и решенията минават през последна проверка.',
        maxMistakes: 7,
        keyboardLayout: 'bg',
        answerLength: 8,
      },
      solution: {
        answer: 'РЕДАКЦИЯ',
      },
    },
    connections: {
      puzzleDate: '2026-04-17',
      activeUntilDate: '2026-04-17',
      status: 'published',
      difficulty: 'medium',
      editorNotes: 'Смесен board с четири чисти групи и умерена подвеждаща близост.',
      payload: {
        items: [
          'КОЛОНКА',
          'АВТОБУС',
          'ПАЛКА',
          'ЧАЙ',
          'РУБРИКА',
          'ФЕНЕР',
          'ЛИМОНАДА',
          'ТРАМВАЙ',
          'СНИМКА',
          'КАКАО',
          'ТРОЛЕЙ',
          'БАДЖ',
          'ЗАГЛАВИЕ',
          'МЕТРО',
          'КАФЕ',
          'БЕЛЕЗНИЦИ',
        ],
      },
      solution: {
        groups: [
          {
            label: 'Напитки',
            difficulty: '1',
            items: ['КАФЕ', 'ЧАЙ', 'КАКАО', 'ЛИМОНАДА'],
            explanation: 'Все неща, които поръчваш или сипваш за пиене.',
          },
          {
            label: 'Градски транспорт',
            difficulty: '2',
            items: ['МЕТРО', 'ТРАМВАЙ', 'ТРОЛЕЙ', 'АВТОБУС'],
            explanation: 'Превозни средства и линии за придвижване из града.',
          },
          {
            label: 'Елементи на статия',
            difficulty: '3',
            items: ['ЗАГЛАВИЕ', 'СНИМКА', 'РУБРИКА', 'КОЛОНКА'],
            explanation: 'Части от редакционното подреждане на материал.',
          },
          {
            label: 'Полицейски принадлежности',
            difficulty: '4',
            items: ['ПАЛКА', 'БЕЛЕЗНИЦИ', 'ФЕНЕР', 'БАДЖ'],
            explanation: 'Предмети, които се свързват с екипировката на патрул.',
          },
        ],
      },
    },
    quiz: {
      puzzleDate: '2026-04-17',
      activeUntilDate: '2026-04-17',
      status: 'published',
      difficulty: 'medium',
      editorNotes: 'Подредени от лесни към по-трудни въпроси без български фокус.',
      payload: {
        questions: [
          {
            question: 'Коя планета е известна като Червената планета?',
            options: ['Марс', 'Венера', 'Юпитер', 'Сатурн'],
            correctIndex: 0,
            explanation: 'Марс изглежда червеникав заради железния оксид по повърхността си.',
          },
          {
            question: 'Колко дни има високосната година?',
            options: ['364', '366', '365', '367'],
            correctIndex: 1,
            explanation: 'Високосната година добавя още един ден към февруари и става 366 дни.',
          },
          {
            question: 'Кой океан мие източния бряг на Африка?',
            options: ['Атлантическият', 'Индийският', 'Тихият', 'Северният ледовит'],
            correctIndex: 1,
            explanation: 'Източна Африка излиза на Индийския океан.',
          },
          {
            question: 'Какъв е химичният символ на златото?',
            options: ['Ag', 'Au', 'Gd', 'Go'],
            correctIndex: 1,
            explanation: 'Au идва от латинското aurum.',
          },
          {
            question: 'Кой е авторът на романа „1984“?',
            options: ['Олдъс Хъксли', 'Джордж Оруел', 'Рей Бредбъри', 'Ърнест Хемингуей'],
            correctIndex: 1,
            explanation: '„1984“ е антиутопия на Джордж Оруел.',
          },
          {
            question: 'Коя държава има столица Отава?',
            options: ['Австралия', 'Канада', 'Ирландия', 'Нова Зеландия'],
            correctIndex: 1,
            explanation: 'Отава е столицата на Канада, не Торонто и не Монреал.',
          },
          {
            question: 'Кой учен формулира закона за всемирното привличане?',
            options: ['Алберт Айнщайн', 'Галилео Галилей', 'Исак Нютон', 'Никола Тесла'],
            correctIndex: 2,
            explanation: 'Нютон формулира закона за гравитацията през XVII век.',
          },
          {
            question: 'Кой художник рисува тавана на Сикстинската капела?',
            options: ['Рафаело', 'Леонардо да Винчи', 'Микеланджело', 'Караваджо'],
            correctIndex: 2,
            explanation: 'Микеланджело създава прочутите фрески на тавана.',
          },
          {
            question: 'Как се казва най-голямата луна на Сатурн?',
            options: ['Европа', 'Титан', 'Йо', 'Ганимед'],
            correctIndex: 1,
            explanation: 'Титан е най-голямата луна на Сатурн и има плътна атмосфера.',
          },
          {
            question: 'Кое число следва във Фибоначи след 21 и 34?',
            options: ['45', '52', '55', '57'],
            correctIndex: 2,
            explanation: 'В редицата на Фибоначи всяко следващо число е сбор от предишните две: 21 + 34 = 55.',
          },
        ],
      },
      solution: {},
    },
    spellingbee: createCuratedSpellingBeePuzzle({
      puzzleDate: '2026-04-17',
      editorNotes: 'Нетематичен кошер с по-богат речник, две панграми и много добър ceiling за играча.',
      title: 'Свободен кошер',
      deck: 'Днес няма тема. Търси възможно най-много истински думи само от буквите в кошера.',
      centerLetter: 'А',
      outerLetters: ['Б', 'К', 'Н', 'О', 'Р', 'Т'],
      words: [
        'АБОНАТ', 'АБОРТ', 'АБОРТА', 'АНКОРА', 'АНОРАК', 'АНТРАКТ', 'АРБА', 'АРКА',
        'БАНКА', 'БАНКАР', 'БАНКНОТ', 'БАНКНОТА', 'БАНКРОТ', 'БАРАК', 'БАРАКА', 'БАРКА',
        'БАРОК', 'БАРОН', 'БРАК', 'БРАТ', 'КАБАН', 'КАНАТ', 'КАНОН', 'КАНТАР',
        'КАНТОН', 'КАРАТ', 'КАРБОН', 'КАРБОНАТ', 'КАРТА', 'КАРТОН', 'КОБРА', 'КОНТРА',
        'КОРА', 'КОРАБ', 'КОТКА', 'КРАН', 'НАБАТ', 'НАБОР', 'НОРА', 'НОТА',
        'НОТАР', 'ОБРАТ', 'ОТБРАНА', 'ОТКАРА', 'ОТКАРАН', 'РОБА', 'РОБОТА', 'РОТА',
        'ТАБАК', 'ТАБОР', 'ТАРАН', 'ТАРО', 'ТОРБА',
      ],
    }),
    strands: createCuratedStrandsPuzzle({
      puzzleDate: '2026-04-17',
      editorNotes: 'Истински path-based strands около редакционен ден, вместо думи по редове.',
      title: 'Редакционен ден',
      deck: 'Намери думите от новинарския ритъм, а после открий спанграмата, която държи всичко заедно.',
      spangram: 'НОВИНИ',
      themeWords: ['КАМЕРА', 'СЮЖЕТИ', 'КАДЪРИ', 'ВОДЕЩИ', 'ЗАПИСИ', 'СТАТИЯ', 'СТУДИО'],
    }),
  },
  '2026-04-18': {
    word: {
      puzzleDate: '2026-04-18',
      activeUntilDate: '2026-04-18',
      status: 'published',
      difficulty: 'medium',
      editorNotes: 'По-дълга дума за следващия ден.',
      payload: {
        wordLength: 5,
        maxAttempts: 6,
        keyboardLayout: 'bg',
      },
      solution: {
        answer: 'ФАКЕЛ',
        allowedWords: ['ФАКЕЛ'],
      },
    },
    hangman: {
      puzzleDate: '2026-04-18',
      activeUntilDate: '2026-04-18',
      status: 'published',
      difficulty: 'easy',
      editorNotes: 'Градска дума, лесна за влизане, но достатъчно дълга за игра.',
      payload: {
        category: 'Град',
        hint: 'Пътят, по който стигаш от точка А до точка Б в натоварения ден.',
        maxMistakes: 7,
        keyboardLayout: 'bg',
        answerLength: 8,
      },
      solution: {
        answer: 'МАРШРУТ',
      },
    },
    connections: {
      puzzleDate: '2026-04-18',
      activeUntilDate: '2026-04-18',
      status: 'published',
      difficulty: 'medium',
      editorNotes: 'По-широк спектър от теми с чисти групи и ясни labels.',
      payload: {
        items: [
          'СЪДИЯ',
          'КАМЕРА',
          'СНЯГ',
          'ВОЛАН',
          'ПРОКУРОР',
          'МИКРОФОН',
          'СЛАНА',
          'ГУМА',
          'АДВОКАТ',
          'СТАТИВ',
          'ДЪЖД',
          'БРОНЯ',
          'СВИДЕТЕЛ',
          'ОБЕКТИВ',
          'МЪГЛА',
          'ПЕДАЛ',
        ],
      },
      solution: {
        groups: [
          {
            label: 'Съдебни роли',
            difficulty: '1',
            items: ['СЪДИЯ', 'ПРОКУРОР', 'АДВОКАТ', 'СВИДЕТЕЛ'],
            explanation: 'Хората, които участват в съдебния процес.',
          },
          {
            label: 'Медийна техника',
            difficulty: '2',
            items: ['КАМЕРА', 'МИКРОФОН', 'СТАТИВ', 'ОБЕКТИВ'],
            explanation: 'Оборудване за запис, картина и звук.',
          },
          {
            label: 'Лошо време',
            difficulty: '3',
            items: ['ДЪЖД', 'СНЯГ', 'МЪГЛА', 'СЛАНА'],
            explanation: 'Явления, които правят деня по-тежък и мрачен.',
          },
          {
            label: 'Части на автомобил',
            difficulty: '4',
            items: ['ВОЛАН', 'ГУМА', 'БРОНЯ', 'ПЕДАЛ'],
            explanation: 'Елементи, които виждаш или използваш в колата.',
          },
        ],
      },
    },
    quiz: {
      puzzleDate: '2026-04-18',
      activeUntilDate: '2026-04-18',
      status: 'published',
      difficulty: 'medium',
      editorNotes: 'Втори дневен сет с общи знания без българска тематика.',
      payload: {
        questions: [
          {
            question: 'На кой континент се намира Перу?',
            options: ['Южна Америка', 'Северна Америка', 'Европа', 'Азия'],
            correctIndex: 0,
            explanation: 'Перу е държава на западния бряг на Южна Америка.',
          },
          {
            question: 'Какво измерва термометърът?',
            options: ['Скорост', 'Температура', 'Налягане', 'Влажност'],
            correctIndex: 1,
            explanation: 'Термометърът показва температурата на средата или тялото.',
          },
          {
            question: 'Кой газ използват растенията при фотосинтеза?',
            options: ['Кислород', 'Въглероден диоксид', 'Азот', 'Хелий'],
            correctIndex: 1,
            explanation: 'При фотосинтеза растенията използват въглероден диоксид и отделят кислород.',
          },
          {
            question: 'Кой инструмент има клавиши, педали и струни?',
            options: ['Цигулка', 'Пиано', 'Тромпет', 'Барабан'],
            correctIndex: 1,
            explanation: 'Пианото комбинира клавиатура, педали и вътрешни струни.',
          },
          {
            question: 'Коя е най-голямата гореща пустиня на Земята?',
            options: ['Гоби', 'Атакама', 'Сахара', 'Калахари'],
            correctIndex: 2,
            explanation: 'Сахара е най-голямата гореща пустиня в света.',
          },
          {
            question: 'Кой елемент е най-разпространен в земната кора?',
            options: ['Желязо', 'Кислород', 'Водород', 'Мед'],
            correctIndex: 1,
            explanation: 'Кислородът участва в голям дял от минералите в земната кора.',
          },
          {
            question: 'Как се нарича деленето на клетката на две еднакви клетки?',
            options: ['Осмоза', 'Митоза', 'Фузия', 'Катализа'],
            correctIndex: 1,
            explanation: 'Митозата води до две генетично еднакви клетки.',
          },
          {
            question: 'Кое произведение е написал Данте Алигиери?',
            options: ['Илиада', 'Божествена комедия', 'Фауст', 'Дон Кихот'],
            correctIndex: 1,
            explanation: '„Божествена комедия“ е най-известното произведение на Данте.',
          },
          {
            question: 'Коя частица в атома няма електрически заряд?',
            options: ['Протон', 'Електрон', 'Неутрон', 'Йон'],
            correctIndex: 2,
            explanation: 'Неутронът е електрически неутрален.',
          },
          {
            question: 'В кой град се провежда тенис турнирът Уимбълдън?',
            options: ['Париж', 'Лондон', 'Мадрид', 'Рим'],
            correctIndex: 1,
            explanation: 'Уимбълдън е част от Лондон и е най-старият турнир от Големия шлем.',
          },
        ],
      },
      solution: {},
    },
    spellingbee: createCuratedSpellingBeePuzzle({
      puzzleDate: '2026-04-18',
      editorNotes: 'Нетематичен кошер с по-широк речник и по-висок максимум, без да става хаотичен.',
      title: 'Кошер без граници',
      deck: 'Отново без тема — само букви, много варианти и гонене на възможно най-висок резултат.',
      centerLetter: 'О',
      outerLetters: ['П', 'Е', 'Р', 'А', 'Т', 'Н'],
      words: [
        'НОРА', 'НОТА', 'ОПАРЕН', 'ОПЕРА', 'ОПЕРАНТ', 'ОПЕРАТА', 'ОПЕРАТОР', 'ОПЕРЕТА',
        'ОПЕРНО', 'ОПЕРОН', 'ОПОНЕНТ', 'ОПОРА', 'ОРАНЕ', 'ОРАНТА', 'ОРАТОР', 'ОТАРА',
        'ОТПОР', 'ПАНО', 'ПАНТЕОН', 'ПАРЕО', 'ПАТРОН', 'ПЕРОН', 'ПЕТОРО', 'ПОАНТА',
        'ПОЕТ', 'ПОЕТА', 'ПОРА', 'ПОРТА', 'ПОТА', 'ПРОПАН', 'ПРОТОН', 'РОПОТ',
        'РОТА', 'ТОНЕР', 'ТОРЕН', 'ТРОН', 'ТРОПОТ',
      ],
    }),
    strands: createCuratedStrandsPuzzle({
      puzzleDate: '2026-04-18',
      editorNotes: 'Домашна тема с истински нишки и силен spangram, вместо редови думи.',
      title: 'Семеен уют',
      deck: 'Събери домашните ориентири и намери спанграмата, която прави пространството живо.',
      spangram: 'СЕМЕЕН',
      themeWords: ['ПРОЗОР', 'ЗАВЕСА', 'ТЕРАСА', 'ДИВАНА', 'КОТЛОН', 'СТОЛЪТ', 'КИЛИМА'],
    }),
  },
});

function parseArgs(argv) {
  const rawArgs = argv.slice(2);
  const args = new Set(rawArgs);
  const readValue = (prefix) => rawArgs.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
  return {
    validateOnly: args.has('--validate-only'),
    listOnly: args.has('--list'),
    dates: readValue('--dates='),
    slugs: readValue('--slugs='),
  };
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeText(value, maxLen = 1000) {
  return String(value ?? '').trim().slice(0, maxLen);
}

function sanitizeStringArray(values, maxLen = 120, options = {}) {
  const { uppercase = false } = options;
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeText(value, maxLen))
    .filter(Boolean)
    .map((value) => (uppercase ? value.toUpperCase() : value));
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeDateTime(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSafeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPuzzleActiveUntilDate(puzzle) {
  const activeUntilDate = normalizeText(puzzle?.activeUntilDate, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(activeUntilDate || '')) return activeUntilDate;
  return normalizeText(puzzle?.puzzleDate, 10);
}

function createSanitizer() {
  return createGamePuzzleHelpers({
    MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH: 3,
    SPELLING_BEE_MIN_WORD_LENGTH: 4,
    SUPPORTED_PUZZLE_DIFFICULTIES: new Set(['easy', 'medium', 'hard']),
    SUPPORTED_PUZZLE_STATUSES: new Set(['draft', 'published', 'archived']),
    analyzeCrosswordConstruction: () => ({ blockers: [] }),
    analyzeSpellingBeeWords,
    analyzeStrandsCoverage,
    badRequest,
    buildStrandsWordFromPath,
    doesPathSpanBoard,
    getCrosswordEntries,
    getPuzzleActiveUntilDate,
    hasCompleteSpellingBeeHive,
    hasOwn,
    isPlainObject,
    isStrandsPathValid,
    matchPathToAnswer,
    normalizeSpellingBeeLetter,
    normalizeSpellingBeeOuterLetters,
    normalizeStrandsGrid,
    normalizeText,
    sanitizeDateTime,
    sanitizeStringArray,
    STRANDS_COLS,
    STRANDS_ROWS,
    STRANDS_TOTAL_CELLS,
    toSafeInteger,
  }).sanitizeGamePuzzleInput;
}

function getFallbackGameDefinition(slug) {
  const definition = DEFAULT_GAME_DEFINITIONS.find((item) => item.slug === slug);
  if (!definition) {
    throw new Error(`Missing local game definition for slug "${slug}".`);
  }
  if (slug === 'strands') {
    return { ...definition, active: true };
  }
  return definition;
}

function getNextIdFactory(startAt) {
  let nextId = startAt;
  return () => nextId++;
}

function parseCsvArg(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidDateStr(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function normalizeSelection(args) {
  const requestedDates = parseCsvArg(args.dates);
  const requestedSlugs = parseCsvArg(args.slugs).map((slug) => slug.toLowerCase());

  const dates = requestedDates.length > 0
    ? requestedDates.filter((date, index, arr) => isValidDateStr(date) && CURATED_DATES.includes(date) && arr.indexOf(date) === index)
    : [...CURATED_DATES];
  const slugs = requestedSlugs.length > 0
    ? requestedSlugs.filter((slug, index, arr) => CURATED_SLUGS.includes(slug) && arr.indexOf(slug) === index)
    : [...CURATED_SLUGS];

  if (dates.length === 0) {
    throw new Error('Няма избрани валидни curated дати. Ползвай --list, за да видиш наличните.');
  }
  if (slugs.length === 0) {
    throw new Error('Няма избрани валидни game slugs. Ползвай --list, за да видиш наличните.');
  }

  return { dates, slugs };
}

function getMongoUri() {
  const raw = String(process.env.MONGODB_URI || '').trim();
  if (!raw || PLACEHOLDER_URI_PATTERN.test(raw)) return '';
  return raw;
}

async function buildDirectMongoUri(mongoUri) {
  if (!String(mongoUri || '').startsWith('mongodb+srv://')) {
    return String(mongoUri || '').trim();
  }

  const connectionUrl = new URL(mongoUri);
  const dbName = connectionUrl.pathname.replace(/^\//, '') || 'zemun-news';
  const authSource = connectionUrl.searchParams.get('authSource') || 'admin';
  const replicaSet = connectionUrl.searchParams.get('replicaSet');
  const retryWrites = connectionUrl.searchParams.get('retryWrites') || 'true';
  const w = connectionUrl.searchParams.get('w') || 'majority';
  const host = connectionUrl.hostname;

  const dns = await import('node:dns/promises');
  const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${host}`);
  if (!Array.isArray(srvRecords) || srvRecords.length === 0) {
    throw new Error(`Не успях да resolve-на SRV записи за ${host}.`);
  }

  let resolvedReplicaSet = replicaSet;
  if (!resolvedReplicaSet) {
    const txtRecords = await dns.resolveTxt(host).catch(() => []);
    const txtJoined = txtRecords.flat().join('&');
    const txtParams = new URLSearchParams(txtJoined);
    resolvedReplicaSet = txtParams.get('replicaSet') || '';
  }

  const hosts = srvRecords
    .map((record) => `${record.name.replace(/\.$/, '')}:${record.port}`)
    .sort();
  const username = encodeURIComponent(decodeURIComponent(connectionUrl.username));
  const password = encodeURIComponent(decodeURIComponent(connectionUrl.password));
  const query = new URLSearchParams({
    ssl: 'true',
    authSource,
    retryWrites,
    w,
  });
  if (resolvedReplicaSet) query.set('replicaSet', resolvedReplicaSet);

  return `mongodb://${username}:${password}@${hosts.join(',')}/${dbName}?${query.toString()}`;
}

async function connectWithFallback(mongoUri) {
  try {
    await mongoose.connect(mongoUri);
    return { mode: 'primary', uri: mongoUri };
  } catch (error) {
    const message = String(error?.message || error);
    const shouldFallback = String(mongoUri || '').startsWith('mongodb+srv://')
      && /querySrv|ECONNREFUSED|ENOTFOUND/i.test(message);
    if (!shouldFallback) throw error;

    const directUri = await buildDirectMongoUri(mongoUri);
    await mongoose.connect(directUri);
    return { mode: 'direct-fallback', uri: directUri };
  }
}

async function ensureCuratedDefinitions(selectedSlugs) {
  const maxDoc = await GameDefinition.findOne().sort({ id: -1 }).select({ _id: 0, id: 1 }).lean();
  const nextId = getNextIdFactory(Math.max(1, (maxDoc?.id || 0) + 1));

  for (const slug of selectedSlugs) {
    const existing = await GameDefinition.findOne({ slug }).lean();
    if (existing) continue;

    const fallback = getFallbackGameDefinition(slug);
    await GameDefinition.create({
      ...fallback,
      id: nextId(),
      active: slug === 'strands' ? true : Boolean(fallback.active),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

async function upsertCuratedPuzzles(selection) {
  const sanitizeGamePuzzleInput = createSanitizer();
  const maxPuzzle = await GamePuzzle.findOne().sort({ id: -1 }).select({ _id: 0, id: 1 }).lean();
  const nextPuzzleId = getNextIdFactory(Math.max(1, (maxPuzzle?.id || 0) + 1));
  const summary = [];

  await ensureCuratedDefinitions(selection.slugs);

  for (const puzzleDate of selection.dates) {
    for (const slug of selection.slugs) {
      const rawPuzzle = CURATED_PUZZLES[puzzleDate]?.[slug];
      if (!rawPuzzle) {
        throw new Error(`Missing curated puzzle for ${slug} on ${puzzleDate}.`);
      }

      const game = await GameDefinition.findOne({ slug }).lean() || getFallbackGameDefinition(slug);
      const existing = await GamePuzzle.findOne({ gameSlug: slug, puzzleDate }).lean();
      const sanitized = sanitizeGamePuzzleInput(game, rawPuzzle, existing);

      if (existing) {
        await GamePuzzle.updateOne(
          { id: existing.id, gameSlug: slug },
          { $set: sanitized }
        );
        summary.push({ action: 'updated', slug, puzzleDate, id: existing.id });
      } else {
        const id = nextPuzzleId();
        await GamePuzzle.create({
          id,
          ...sanitized,
          createdAt: new Date(),
        });
        summary.push({ action: 'created', slug, puzzleDate, id });
      }
    }
  }

  return summary;
}

function validateCuratedPayloads() {
  return validateSelectedCuratedPayloads({ dates: CURATED_DATES, slugs: CURATED_SLUGS });
}

function validateSelectedCuratedPayloads(selection) {
  const sanitizeGamePuzzleInput = createSanitizer();
  const validated = [];

  for (const puzzleDate of selection.dates) {
    for (const slug of selection.slugs) {
      const rawPuzzle = CURATED_PUZZLES[puzzleDate]?.[slug];
      if (!rawPuzzle) {
        throw new Error(`Missing curated puzzle for ${slug} on ${puzzleDate}.`);
      }
      const game = getFallbackGameDefinition(slug);
      const sanitized = sanitizeGamePuzzleInput(game, rawPuzzle);
      validated.push({
        slug,
        puzzleDate,
        status: sanitized.status,
        difficulty: sanitized.difficulty,
      });
    }
  }

  return validated;
}

async function main() {
  const args = parseArgs(process.argv);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const presetMongoUri = String(process.env.MONGODB_URI || '').trim();
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
  dotenv.config({
    path: path.join(__dirname, '..', '.env'),
    quiet: true,
    override: !presetMongoUri || PLACEHOLDER_URI_PATTERN.test(presetMongoUri),
  });
  if (presetMongoUri && !PLACEHOLDER_URI_PATTERN.test(presetMongoUri)) {
    process.env.MONGODB_URI = presetMongoUri;
  }
  const selection = normalizeSelection(args);

  if (args.listOnly) {
    console.log(JSON.stringify({
      ok: true,
      availableDates: CURATED_DATES,
      availableSlugs: CURATED_SLUGS,
      selected: selection,
    }, null, 2));
    return;
  }

  if (args.validateOnly) {
    const validated = validateSelectedCuratedPayloads(selection);
    console.log(JSON.stringify({ ok: true, mode: 'validate-only', selected: selection, validated }, null, 2));
    return;
  }

  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error('Няма валиден MONGODB_URI. Пусни скрипта с реална база или използвай --validate-only.');
  }

  const connection = await connectWithFallback(mongoUri);
  try {
    const summary = await upsertCuratedPuzzles(selection);
    console.log(JSON.stringify({ ok: true, selected: selection, connectionMode: connection.mode, summary }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
