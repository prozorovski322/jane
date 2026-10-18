/**
 * Page titles on the website: each address gets its own title (browser tabs, history, search
 * results), e.g. "Словарь — Jane". The app has no titles, so the hook does nothing there.
 */
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getLexicon, lessonTitle } from '@/core/content';
import { LEVEL_LABEL, LEVELS } from '@/core/content/schema';

const SITE = 'Jane — английский с нуля до C1';

const FIXED: Record<string, string> = {
  '/': 'Путь',
  '/today': 'Сегодня',
  '/practice': 'Практика',
  '/dictionary': 'Словарь',
  '/profile': 'Профиль',
  '/settings': 'Настройки',
  '/grammar': 'Грамматика',
  '/onboarding': 'Знакомство',
  '/placement': 'Тест уровня',
  '/review': 'Повторение',
  '/mistakes': 'Ошибки',
  '/flashcards': 'Карточки',
  '/privacy': 'Конфиденциальность',
  '/ai-review': 'Проверка письма',
  '/word/new': 'Новое слово',
};

/** The title for an address; the site's name alone for the start page. */
export function titleFor(path: string): string {
  const [, section, id] = path.split('/');
  let name = FIXED[path];
  if (!name && section === 'lesson' && id) {
    const level = LEVELS.find((l) => `${l.toLowerCase()}.exam` === id);
    name = level ? `Экзамен ${LEVEL_LABEL[level]}` : (lessonTitle(id) ?? 'Урок');
  }
  if (!name && section === 'word' && id) name = getLexicon().get(id)?.en ?? 'Слово';
  if (!name && section === 'grammar') name = 'Грамматика';
  if (!name && section === 'practice') name = 'Практика';
  if (!name && section === 'certificate') name = 'Сертификат';
  return name && path !== '/' ? `${name} — Jane` : SITE;
}

export function usePageTitle() {
  const path = usePathname();
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = titleFor(path);
  }, [path]);
}
