import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LEVELS, type Level } from '@/core/content/schema';
import type { SrsCard } from '@/core/srs/scheduler';
import { tts } from '@/core/speech/tts';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Chip } from '@/ui/components/Chip';
import { Icon } from '@/ui/components/Icon';
import { IconButton } from '@/ui/components/IconButton';
import { PressableScale } from '@/ui/components/PressableScale';
import { TextField } from '@/ui/components/TextField';
import { useTheme } from '@/ui/theme/ThemeProvider';

import type { DictEntry } from './entries';
import { loadDictionary } from './load';
import { searchDictionary, wordStatus, type DictStatus, type WordStatus } from './search';

const STATUSES: { value: DictStatus; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'learning', label: 'Изучаю' },
  { value: 'known', label: 'Выучено' },
  { value: 'favorites', label: 'Избранное' },
  { value: 'mine', label: 'Мои слова' },
];

const STATUS_LABEL: Record<WordStatus, string> = {
  new: 'новое',
  learning: 'изучаю',
  known: 'выучено',
};
const EMPTY: DictEntry[] = [];
const EMPTY_CARDS = new Map<string, SrsCard>();
const EMPTY_SET = new Set<string>();

function Row({ e, status, favorite }: { e: DictEntry; status: WordStatus; favorite: boolean }) {
  const { colors, radius } = useTheme();
  const dot = { new: colors.borderStrong, learning: colors.info, known: colors.success }[status];
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <PressableScale
        role="button"
        aria-label={`${e.en} — ${e.ru[0]}. ${STATUS_LABEL[status]}${favorite ? ', в избранном' : ''}`}
        onPress={() => router.push(`/word/${e.id}`)}
        style={styles.rowMain}
      >
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {e.en}
            {e.ipa ? <AppText variant="small" color="textMuted">{`  /${e.ipa}/`}</AppText> : null}
          </AppText>
          <AppText variant="small" color="textMuted" numberOfLines={1}>
            {e.ru.join(', ')}
          </AppText>
        </View>
        {favorite && <Icon name="star-filled" size={16} color={colors.xp} />}
        {e.own && (
          <AppText variant="caption" color="info">
            моё
          </AppText>
        )}
      </PressableScale>
      <IconButton
        icon="speaker"
        label={`Произнести ${e.en}`}
        color="primary"
        size={20}
        onPress={() => void tts.speak(e.en)}
      />
    </View>
  );
}

export function DictionaryScreen() {
  const { colors, space } = useTheme();
  const data = useDbQuery(loadDictionary, []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DictStatus>('all');
  const [levels, setLevels] = useState<Level[]>([]);
  const deferredQuery = useDeferredValue(query);

  // Read everything from `data` up front: the React Compiler hoists property reads out of
  // callbacks (e.g. `renderItem`) as memo dependencies, so `data.x` inside one would run while
  // `data` is still undefined.
  const entries = data ? data.entries : EMPTY;
  const cards = data ? data.cards : EMPTY_CARDS;
  const favorites = data ? data.favorites : EMPTY_SET;
  const results = useMemo(
    () => searchDictionary(entries, { query: deferredQuery, levels, status }, { cards, favorites }),
    [entries, cards, favorites, deferredQuery, levels, status],
  );
  const presentLevels = useMemo(
    () => LEVELS.filter((l) => entries.some((e) => e.level === l)),
    [entries],
  );

  const header = (
    <View style={{ gap: space.sm, paddingBottom: space.sm }}>
      <View style={styles.titleRow}>
        <AppText variant="display" role="heading" style={styles.flex}>
          Словарь
        </AppText>
      </View>
      <View style={styles.searchRow}>
        <View style={[styles.searchIcon]} pointerEvents="none">
          <Icon name="search" size={20} color={colors.textMuted} />
        </View>
        <TextField
          label="Поиск по словарю"
          placeholder="Слово по-английски или по-русски"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          style={styles.search}
        />
      </View>
      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            selected={status === s.value}
            onPress={() => setStatus(s.value)}
          />
        ))}
      </View>
      {presentLevels.length > 1 && (
        <View style={styles.chips}>
          {presentLevels.map((l) => (
            <Chip
              key={l}
              label={l}
              selected={levels.includes(l)}
              onPress={() =>
                setLevels((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))
              }
            />
          ))}
        </View>
      )}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="Своё слово"
            icon="plus"
            variant="secondary"
            compact
            onPress={() => router.push('/word/new')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="Карточки"
            icon="cards"
            variant="secondary"
            compact
            disabled={!results.length}
            onPress={() =>
              router.push({
                pathname: '/flashcards',
                params: { status, q: deferredQuery, levels: levels.join(',') },
              })
            }
          />
        </View>
      </View>
      <AppText variant="caption" color="textMuted" aria-live="polite">
        {data ? `Найдено: ${results.length}` : 'Загружаю…'}
      </AppText>
    </View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { padding: space.md }]}
        ItemSeparatorComponent={() => <View style={{ height: space.xs }} />}
        renderItem={({ item }) => (
          <Row e={item} status={wordStatus(item.id, cards)} favorite={favorites.has(item.id)} />
        )}
        ListEmptyComponent={
          data ? (
            <AppText variant="body" color="textMuted">
              {status === 'mine'
                ? 'Своих слов пока нет. Добавьте первое кнопкой «Своё слово».'
                : 'Ничего не нашлось.'}
            </AppText>
          ) : null
        }
        initialNumToRender={20}
        windowSize={10}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 16, zIndex: 1 },
  search: { paddingLeft: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingRight: 4 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
