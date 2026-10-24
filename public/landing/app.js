'use strict';
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
});
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.header')) closeMenu();
});
const levels = {
  'Pre-A1': [
    'Первый шаг — самый важный',
    'Алфавит, звуки и первые слова. Учитесь представляться и понимать простые фразы.',
    ['Звуки и буквы', 'Знакомство', 'Первые фразы'],
  ],
  A1: [
    'Начните говорить о себе',
    'Знакомьтесь, рассказывайте о семье и задавайте простые вопросы в повседневных ситуациях.',
    ['О себе', 'Семья и дом', 'Простые вопросы'],
  ],
  A2: [
    'Английский на каждый день',
    'Общайтесь в поездках, обсуждайте привычные дела и рассказывайте о событиях.',
    ['Повседневные дела', 'Путешествия', 'Прошлые события'],
  ],
  B1: [
    'Больше мыслей — больше свободы',
    'Поддерживайте разговор на знакомые темы и объясняйте свою точку зрения.',
    ['Мнения и планы', 'Истории', 'Общение в поездках'],
  ],
  B2: [
    'Уверенность в сложных темах',
    'Разбирайтесь в сложных текстах и обсуждайте вопросы работы и учёбы.',
    ['Работа и учёба', 'Аргументация', 'Сложные тексты'],
  ],
  C1: [
    'Точность, гибкость, свой голос',
    'Работайте с нюансами языка для академического и делового общения.',
    ['Нюансы значений', 'Академический язык', 'Деловое общение'],
  ],
};
document.querySelectorAll('[data-level]').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-level]').forEach((other) => {
      other.classList.toggle('active', other === button);
      other.setAttribute('aria-pressed', String(other === button));
    });
    const level = button.dataset.level;
    const [title, description, topics] = levels[level];
    document.querySelector('#level-badge').textContent = level;
    document.querySelector('#level-title').textContent = title;
    document.querySelector('#level-description').textContent = description;
    document.querySelector('#level-topics').replaceChildren(
      ...topics.map((topic) => {
        const li = document.createElement('li');
        li.textContent = topic;
        return li;
      }),
    );
  }),
);
const questions = [
  {
    text: 'Как сказать «Привет»?',
    answers: ['Hello', 'Goodbye', 'Thank you'],
    correct: 0,
    explanation:
      'Hello — «Привет» или «Здравствуйте». Goodbye — «До свидания», а Thank you — «Спасибо».',
  },
  {
    text: 'Вы представляете себя. Как правильно?',
    answers: ['I name is Jane.', 'My name is Jane.', 'Me name Jane.'],
    correct: 1,
    explanation: 'My name is Jane — «Меня зовут Джейн». My означает «мой», а name — «имя».',
  },
  {
    text: 'Что ответить на «Nice to meet you»?',
    answers: ['Good night.', 'I am a book.', 'Nice to meet you too.'],
    correct: 2,
    explanation:
      'Nice to meet you too — «Мне тоже приятно познакомиться». Too здесь означает «тоже».',
  },
];
const key = 'jane-demo-lesson-v1';
let selections = [];
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (
    Array.isArray(saved) &&
    saved.length <= questions.length &&
    saved.every(
      (answer, i) =>
        Number.isInteger(answer) && answer >= 0 && answer < questions[i].answers.length,
    )
  )
    selections = saved;
} catch {
  /* Lesson also works when browser storage is unavailable. */
}
let current = selections.length;
let answered = false;
const answers = document.querySelector('#answers');
const feedback = document.querySelector('#feedback');
const next = document.querySelector('#next');
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(selections));
  } catch {}
}
function showQuestion(focus = false) {
  answered = false;
  document.querySelector('#exercise').hidden = false;
  document.querySelector('#result').hidden = true;
  document.querySelector('#question-count').textContent = `${current + 1} из ${questions.length}`;
  document.querySelector('#lesson-progress').value = current;
  const q = questions[current];
  document.querySelector('#question').textContent = q.text;
  feedback.textContent = '';
  next.hidden = true;
  answers.replaceChildren();
  q.answers.forEach((answer, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer';
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = String.fromCharCode(65 + index);
    const text = document.createElement('span');
    text.lang = 'en';
    text.textContent = answer;
    button.append(letter, text);
    button.addEventListener('click', () => submit(index));
    answers.append(button);
  });
  if (focus) document.querySelector('#question').focus({ preventScroll: true });
}
function submit(index) {
  if (answered) return;
  answered = true;
  const q = questions[current];
  selections[current] = index;
  save();
  answers.querySelectorAll('button').forEach((button, i) => {
    button.disabled = true;
    if (i === q.correct || i === index) {
      button.classList.add(i === q.correct ? 'correct' : 'incorrect');
      const symbol = document.createElement('span');
      symbol.className = 'answer-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = i === q.correct ? '✓' : '×';
      button.append(symbol);
    }
  });
  feedback.textContent =
    (index === q.correct
      ? 'Верно! '
      : 'Правильный ответ: ' + q.answers[q.correct].replace(/[.!?]$/, '') + '. ') + q.explanation;
  document.querySelector('#lesson-progress').value = current + 1;
  next.textContent =
    current === questions.length - 1 ? 'Посмотреть результат →' : 'Следующее задание →';
  next.hidden = false;
  next.focus({ preventScroll: true });
}
function finish(focus = false) {
  document.querySelector('#exercise').hidden = true;
  document.querySelector('#result').hidden = false;
  document.querySelector('#question-count').textContent = 'Готово';
  document.querySelector('#lesson-progress').value = questions.length;
  const correct = selections.filter((answer, i) => answer === questions[i].correct).length;
  document.querySelector('#score').textContent =
    `Правильных ответов: ${correct} из ${questions.length}.`;
  if (focus) document.querySelector('#result-title').focus({ preventScroll: true });
}
next.addEventListener('click', () => {
  current++;
  if (current >= questions.length) finish(true);
  else showQuestion(true);
});
document.querySelector('#restart').addEventListener('click', () => {
  selections = [];
  current = 0;
  save();
  showQuestion(true);
});
if (current >= questions.length) finish();
else showQuestion();
