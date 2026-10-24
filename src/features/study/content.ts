import type { Exercise } from '@/core/content/schema';
import type { LessonSession } from '../lesson/session';

export const STUDY_SCENARIOS = [
  {
    id: 'campus',
    title: 'Первый день в колледже',
    description: 'Представиться, найти аудиторию и уточнить расписание.',
    phrases: [
      {
        en: "I'm a new student.",
        ru: 'Я новый студент.',
        hint: 'После I используйте am; перед new student нужен артикль a.',
        wrong: ['Я новый преподаватель.', 'Я опоздал на занятие.'],
      },
      {
        en: 'Where is the library?',
        ru: 'Где находится библиотека?',
        hint: 'Вопрос о месте начинается с Where; после него — is.',
        wrong: ['Когда открывается библиотека?', 'Можно взять эту книгу?'],
      },
      {
        en: 'Could you show me the timetable?',
        ru: 'Не могли бы вы показать мне расписание?',
        hint: 'Could you — вежливый способ попросить. Timetable — расписание.',
        wrong: ['Не могли бы вы проверить мою работу?', 'Где я могу получить студенческий билет?'],
      },
    ],
    question: 'What would you ask on your first day at college?',
    questionRu: 'Что вы спросили бы в первый день в колледже?',
    keywords: [
      ['where', 'could you'],
      ['library', 'timetable', 'classroom'],
    ],
    sample: 'Where is the library? Could you show me the timetable?',
  },
  {
    id: 'teacher',
    title: 'Разговор с преподавателем',
    description: 'Переспросить, попросить помощь и уточнить срок сдачи.',
    phrases: [
      {
        en: 'Could you repeat that, please?',
        ru: 'Не могли бы вы повторить это, пожалуйста?',
        hint: 'Repeat — повторить. Please делает просьбу вежливее.',
        wrong: ['Могу я ответить на вопрос?', 'Не могли бы вы написать это?'],
      },
      {
        en: "I don't understand this task.",
        ru: 'Я не понимаю это задание.',
        hint: 'Для отрицания с understand используйте do not / don’t.',
        wrong: ['Я уже закончил это задание.', 'Я не согласен с этой оценкой.'],
      },
      {
        en: 'When is the deadline?',
        ru: 'Когда крайний срок сдачи?',
        hint: 'When — когда; deadline — крайний срок.',
        wrong: ['Где проходит экзамен?', 'Когда начинается семестр?'],
      },
    ],
    question: 'You do not understand a task. What would you say to your teacher?',
    questionRu: 'Вы не поняли задание. Что вы скажете преподавателю?',
    keywords: [
      ["don't understand", 'do not understand'],
      ['task', 'assignment'],
    ],
    sample: "I don't understand this task. Could you repeat that, please?",
  },
  {
    id: 'interview',
    title: 'Собеседование для поступления',
    description: 'Рассказать о выборе программы, интересах и планах.',
    phrases: [
      {
        en: 'I would like to study abroad.',
        ru: 'Я хотел бы учиться за границей.',
        hint: 'Would like to — хотел бы; study abroad — учиться за границей.',
        wrong: ['Я уже учился за границей.', 'Я хотел бы преподавать английский.'],
      },
      {
        en: "I'm interested in computer science.",
        ru: 'Я интересуюсь информатикой.',
        hint: 'После interested нужен предлог in. Computer science — информатика.',
        wrong: ['Я работаю преподавателем информатики.', 'Я поступил на языковые курсы.'],
      },
      {
        en: 'I want to improve my English.',
        ru: 'Я хочу улучшить свой английский.',
        hint: 'После want используйте to + глагол. Improve — улучшить.',
        wrong: ['Я хочу сдать экзамен завтра.', 'Я могу свободно говорить на английском.'],
      },
    ],
    question: 'Why would you like to study abroad?',
    questionRu: 'Почему вы хотели бы учиться за границей?',
    keywords: [
      ['study', 'learn'],
      ['english', 'computer science', 'abroad'],
    ],
    sample:
      'I would like to study abroad because I want to improve my English and study computer science.',
  },
] as const;

export function studySession(id: string): LessonSession | null {
  const scenario = STUDY_SCENARIOS.find((s) => s.id === id);
  if (!scenario) return null;
  const exercises: Exercise[] = scenario.phrases.flatMap((p, index) => {
    const base = {
      hint: p.hint,
      explanation: `${p.en} — ${p.ru} ${p.hint}`,
      difficulty: 1 as const,
      words: [],
      grammar: [],
      troubles: [],
    };
    const prefix = `study.${id}.p${index + 1}`;
    return [
      {
        ...base,
        id: `${prefix}.meaning`,
        type: 'translate_choice' as const,
        from: 'en' as const,
        text: p.en,
        options: [p.ru, ...p.wrong],
        answer: 0,
      },
      { ...base, id: `${prefix}.speak`, type: 'speak_repeat' as const, text: p.en },
      {
        ...base,
        id: `${prefix}.write`,
        type: 'type_translation' as const,
        from: 'ru' as const,
        text: p.ru,
        answers: [...new Set([p.en, p.en.replace("I'm", 'I am').replace("don't", 'do not')])],
      },
    ];
  });
  exercises.push({
    id: `study.${id}.answer`,
    type: 'speak_answer',
    hint: 'Используйте фразы из этой тренировки. Можно ответить своими словами.',
    explanation: `Возможный ответ: ${scenario.sample}`,
    difficulty: 3,
    words: [],
    grammar: [],
    troubles: [],
    question: scenario.question,
    questionRu: scenario.questionRu,
    keywords: scenario.keywords.map((k) => [...k]),
    minKeywords: 2,
    samples: [scenario.sample],
  });
  return {
    id: `practice.study-${id}`,
    title: scenario.title,
    kind: 'practice',
    unitId: null,
    texts: [],
    exercises,
  };
}
