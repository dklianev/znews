const QUIZ_POINTS_PRESETS = {
  5: [10, 25, 50, 100, 250],
  10: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  15: [5, 10, 15, 25, 50, 100, 150, 250, 500, 1000, 1500, 2500, 4000, 7500, 10000],
};

const PHONE_HINT_CONFIDENT = [
  'Почти сигурен съм, че правилният е',
  'Бих заложил на',
  'Според мен това е',
];

const PHONE_HINT_UNCERTAIN = [
  'Не съм напълно сигурен, но бих пробвал',
  'Колебая се, но май е',
  'Ако трябва да рискувам, бих избрал',
];

function pickRandom(list, randomFn = Math.random) {
  return list[Math.floor(randomFn() * list.length)];
}

export function buildQuizPointsLadder(count) {
  if (QUIZ_POINTS_PRESETS[count]) return QUIZ_POINTS_PRESETS[count];
  const ladder = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    ladder.push(Math.round((5 + t * t * 9995) / 5) * 5);
  }
  return ladder;
}

export function getQuizSafetyNets(count) {
  if (count <= 5) return [];
  if (count <= 10) return [4];
  return [4, 9];
}

export function formatQuizPoints(amount) {
  return `${amount.toLocaleString('bg-BG')} т.`;
}

export function generateQuizFiftyFifty(question, randomFn = Math.random) {
  const correct = question.correctIndex;
  const wrong = question.options
    .map((_, index) => index)
    .filter((index) => index !== correct);
  const keep = wrong[Math.floor(randomFn() * wrong.length)];
  return new Set(wrong.filter((index) => index !== keep));
}

export function generateQuizAudienceVotes(question, eliminated, randomFn = Math.random) {
  const correct = question.correctIndex;
  const active = question.options
    .map((_, index) => index)
    .filter((index) => !eliminated.has(index));
  const votes = new Array(question.options.length).fill(0);

  const correctWeight = 45 + Math.floor(randomFn() * 30);
  votes[correct] = correctWeight;
  let remaining = 100 - correctWeight;

  const others = active.filter((index) => index !== correct);
  others.forEach((index, otherIndex) => {
    if (otherIndex === others.length - 1) {
      votes[index] = remaining;
    } else {
      const share = Math.floor(randomFn() * (remaining * 0.7));
      votes[index] = share;
      remaining -= share;
    }
  });

  return votes;
}

export function generateQuizPhoneHint(question, randomFn = Math.random) {
  const isRight = randomFn() < 0.7;
  const wrongOptions = question.options
    .map((_, index) => index)
    .filter((index) => index !== question.correctIndex);
  const suggestedIdx = isRight
    ? question.correctIndex
    : wrongOptions[Math.floor(randomFn() * wrongOptions.length)];
  const confidence = isRight
    ? pickRandom(PHONE_HINT_CONFIDENT, randomFn)
    : pickRandom(PHONE_HINT_UNCERTAIN, randomFn);
  const letter = String.fromCharCode(65 + suggestedIdx);
  return `${confidence} ${letter}.`;
}

export function calculateQuizScore(answers, questions) {
  return answers.reduce((score, answer, index) => (
    score + ((index < questions.length && answer === questions[index].correctIndex) ? 1 : 0)
  ), 0);
}

export function getQuizFinalPoints({
  gameStatus,
  pointsLadder,
  totalQ,
  currentPoints,
  guaranteedPoints,
}) {
  if (gameStatus === 'won') return pointsLadder[totalQ - 1];
  if (gameStatus === 'walkaway') return currentPoints;
  return guaranteedPoints;
}

export function generateQuizShareText({
  todayStr,
  finalPoints,
  score,
  totalQ,
  answers,
  questions,
  origin = 'https://znews.live',
}) {
  let text = `🏆 zNews Ерудит — ${todayStr}\n`;
  text += `Точки: ${formatQuizPoints(finalPoints)}\n`;
  text += `Верни: ${score}/${totalQ}\n\n`;
  answers.forEach((answer, index) => {
    text += (index < questions.length && answer === questions[index].correctIndex) ? '🟩' : '🟥';
  });
  text += `\n\n${origin}/games/quiz`;
  return text;
}

