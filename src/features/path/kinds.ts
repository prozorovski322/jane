import type { IconName } from '@/ui/components/Icon';

export const KIND_LABEL: Record<string, string> = {
  vocabulary: 'Слова',
  grammar: 'Грамматика',
  listening: 'Аудирование',
  reading: 'Чтение',
  speaking: 'Говорение',
  writing: 'Письмо',
  pronunciation: 'Произношение',
  review: 'Повторение',
  test: 'Тест',
};

export const KIND_ICON: Record<string, IconName> = {
  vocabulary: 'cards',
  grammar: 'book',
  listening: 'speaker',
  reading: 'eye',
  speaking: 'mic',
  writing: 'keyboard',
  pronunciation: 'speaker-slow',
  review: 'refresh',
  test: 'star',
};
