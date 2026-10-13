/**
 * Achievements. Each one is a threshold on a single number from the learner's history, so the
 * list is easy to extend and every achievement can show "how far along" the learner is.
 * Nothing here punishes: achievements are only ever unlocked, never lost.
 */
import type { IconName } from '@/ui/components/Icon';

/** Numbers computed from the database (see `loadAchievementStats`). */
export interface AchievementStats {
  /** Total XP ever earned. */
  xp: number;
  /** Best streak: the longer of the current and the longest streak. */
  streak: number;
  lessons: number;
  tests: number;
  /** Lessons and tests finished with every first answer right. */
  perfect: number;
  /** Units with all lessons and the unit test passed. */
  units: number;
  /** Levels whose exam was passed (certificates). */
  levels: number;
  /** Cards answered in reviews. */
  reviews: number;
  wordsMastered: number;
  wordsLearning: number;
  activeDays: number;
  /** Days on which the daily goal was reached. */
  goalDays: number;
  listening: number;
  speaking: number;
  writing: number;
  reading: number;
  ownWords: number;
  favorites: number;
  quests: number;
  /** Sessions finished before 8:00 / after 22:00. */
  early: number;
  night: number;
  /** Days of activity on a Saturday or Sunday. */
  weekend: number;
  /** Returns after a break of a week or more. */
  comebacks: number;
  placement: number;
  freezesUsed: number;
}

export type Metric = keyof AchievementStats;

export type AchievementGroup = 'start' | 'streak' | 'xp' | 'words' | 'skills' | 'habits' | 'course';

export interface Achievement {
  id: string;
  group: AchievementGroup;
  title: string;
  description: string;
  icon: IconName;
  metric: Metric;
  target: number;
}

export const GROUP_LABEL: Record<AchievementGroup, string> = {
  start: 'Первые шаги',
  streak: 'Серия',
  xp: 'Опыт',
  words: 'Слова',
  skills: 'Навыки',
  habits: 'Привычки',
  course: 'Курс',
};

const a = (
  id: string,
  group: AchievementGroup,
  title: string,
  description: string,
  icon: IconName,
  metric: Metric,
  target: number,
): Achievement => ({ id, group, title, description, icon, metric, target });

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Первые шаги
  a('first-lesson', 'start', 'Первый урок', 'Пройдите первый урок.', 'book', 'lessons', 1),
  a('lessons-5', 'start', 'Разгон', 'Пройдите 5 уроков.', 'book', 'lessons', 5),
  a('lessons-25', 'start', 'Четверть сотни', 'Пройдите 25 уроков.', 'path', 'lessons', 25),
  a('lessons-50', 'start', 'Полсотни уроков', 'Пройдите 50 уроков.', 'path', 'lessons', 50),
  a('lessons-100', 'start', 'Сотня', 'Пройдите 100 уроков.', 'path', 'lessons', 100),
  a('lessons-200', 'start', 'Долгий путь', 'Пройдите 200 уроков.', 'path', 'lessons', 200),
  a('placement', 'start', 'Знаю, где я', 'Пройдите тест уровня.', 'target', 'placement', 1),
  a(
    'perfect-1',
    'start',
    'Чисто',
    'Пройдите урок без единой ошибки с первой попытки.',
    'check',
    'perfect',
    1,
  ),
  a(
    'perfect-10',
    'start',
    'Мастер чистоты',
    'Десять уроков без ошибок с первой попытки.',
    'check',
    'perfect',
    10,
  ),

  // Серия
  a('streak-3', 'streak', 'Три дня подряд', 'Занимайтесь 3 дня подряд.', 'flame', 'streak', 3),
  a('streak-7', 'streak', 'Неделя', 'Серия в 7 дней.', 'flame', 'streak', 7),
  a('streak-14', 'streak', 'Две недели', 'Серия в 14 дней.', 'flame', 'streak', 14),
  a('streak-30', 'streak', 'Месяц', 'Серия в 30 дней.', 'flame', 'streak', 30),
  a('streak-100', 'streak', 'Сотня дней', 'Серия в 100 дней.', 'flame', 'streak', 100),
  a(
    'freeze-used',
    'streak',
    'Заморозка спасла',
    'Заморозка сохранила серию в пропущенный день.',
    'snow',
    'freezesUsed',
    1,
  ),

  // Опыт
  a('xp-100', 'xp', '100 XP', 'Заработайте 100 XP.', 'star', 'xp', 100),
  a('xp-500', 'xp', '500 XP', 'Заработайте 500 XP.', 'star', 'xp', 500),
  a('xp-1000', 'xp', '1 000 XP', 'Заработайте 1 000 XP.', 'star-filled', 'xp', 1000),
  a('xp-5000', 'xp', '5 000 XP', 'Заработайте 5 000 XP.', 'star-filled', 'xp', 5000),
  a('xp-10000', 'xp', '10 000 XP', 'Заработайте 10 000 XP.', 'star-filled', 'xp', 10000),

  // Слова
  a(
    'words-10',
    'words',
    'Первые слова',
    'Выучите 10 слов: они уже надолго в памяти.',
    'cards',
    'wordsMastered',
    10,
  ),
  a('words-50', 'words', 'Полсотни слов', 'Выучите 50 слов.', 'cards', 'wordsMastered', 50),
  a('words-250', 'words', 'Словарный запас', 'Выучите 250 слов.', 'cards', 'wordsMastered', 250),
  a('words-1000', 'words', 'Тысяча слов', 'Выучите 1 000 слов.', 'cards', 'wordsMastered', 1000),
  a(
    'reviews-20',
    'words',
    'Повторение — мать учения',
    'Ответьте на 20 карточек в повторении.',
    'refresh',
    'reviews',
    20,
  ),
  a(
    'reviews-200',
    'words',
    'Не забываю',
    'Ответьте на 200 карточек в повторении.',
    'refresh',
    'reviews',
    200,
  ),
  a('own-word', 'words', 'Своё слово', 'Добавьте в словарь своё слово.', 'plus', 'ownWords', 1),
  a('favorites-5', 'words', 'Любимые', 'Отметьте 5 слов избранными.', 'star', 'favorites', 5),

  // Навыки
  a('listening-50', 'skills', 'Чуткое ухо', '50 заданий на слух.', 'speaker', 'listening', 50),
  a('speaking-30', 'skills', 'Говорю вслух', '30 заданий на говорение.', 'mic', 'speaking', 30),
  a('writing-10', 'skills', 'Пишу сам', '10 письменных заданий.', 'book', 'writing', 10),
  a(
    'reading-30',
    'skills',
    'Читатель',
    '30 заданий на чтение и понимание текста.',
    'book',
    'reading',
    30,
  ),

  // Привычки
  a('quest-1', 'habits', 'Задание дня', 'Выполните ежедневный квест.', 'target', 'quests', 1),
  a('quest-25', 'habits', 'Квестер', 'Выполните 25 ежедневных квестов.', 'target', 'quests', 25),
  a('goal-7', 'habits', 'Цель достигнута', 'Выполните цель дня 7 раз.', 'target', 'goalDays', 7),
  a(
    'days-30',
    'habits',
    'Тридцать дней с английским',
    'Занимайтесь в 30 разных дней.',
    'sun',
    'activeDays',
    30,
  ),
  a('early-bird', 'habits', 'Ранняя пташка', 'Позанимайтесь до 8 утра.', 'sun', 'early', 1),
  a('night-owl', 'habits', 'Сова', 'Позанимайтесь после 22:00.', 'sun', 'night', 1),
  a(
    'weekend-4',
    'habits',
    'Даже в выходные',
    'Позанимайтесь в 4 выходных дня.',
    'sun',
    'weekend',
    4,
  ),
  a(
    'comeback',
    'habits',
    'С возвращением',
    'Вернитесь к занятиям после недельного перерыва — это нормально.',
    'user',
    'comebacks',
    1,
  ),

  // Курс
  a('first-test', 'course', 'Первый тест', 'Сдайте тест юнита.', 'target', 'tests', 1),
  a('tests-5', 'course', 'Пять тестов', 'Сдайте 5 тестов юнитов.', 'target', 'tests', 5),
  a('unit-1', 'course', 'Юнит пройден', 'Пройдите юнит целиком, с тестом.', 'path', 'units', 1),
  a('units-5', 'course', 'Пять юнитов', 'Пройдите 5 юнитов.', 'path', 'units', 5),
  a(
    'level-1',
    'course',
    'Сертификат уровня',
    'Сдайте экзамен уровня и получите сертификат.',
    'trophy',
    'levels',
    1,
  ),
  a(
    'levels-3',
    'course',
    'Три уровня',
    'Получите сертификаты трёх уровней.',
    'trophy',
    'levels',
    3,
  ),
];

export interface AchievementState extends Achievement {
  value: number;
  unlockedAt: number | null;
}

/** Achievements whose threshold is reached and that are not unlocked yet. */
export function newlyUnlocked(
  stats: AchievementStats,
  unlocked: ReadonlySet<string>,
  list: readonly Achievement[] = ACHIEVEMENTS,
): Achievement[] {
  return list.filter((x) => !unlocked.has(x.id) && stats[x.metric] >= x.target);
}

/** Current value of every achievement, for the profile. */
export function achievementStates(
  stats: AchievementStats,
  unlockedAt: ReadonlyMap<string, number>,
  list: readonly Achievement[] = ACHIEVEMENTS,
): AchievementState[] {
  return list.map((x) => ({
    ...x,
    value: Math.min(stats[x.metric], x.target),
    unlockedAt: unlockedAt.get(x.id) ?? null,
  }));
}
