/**
 * Flashcards over the current dictionary selection. Self-study only: they do not change the
 * review schedule. «Ещё раз» puts a card at the end of the deck, «Помню» takes it out.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Level } from '@/core/content/schema';
import { feedback } from '@/core/feedback/feedback';
import { useDbQuery } from '@/lib/useDbQuery';
import { shuffle } from '@/lib/random';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { goBack, SubScreen } from '@/ui/components/SubScreen';

import { loadDictionary } from './load';
import { searchDictionary, type DictStatus } from './search';

const DECK_SIZE = 30;

export function FlashcardsScreen({
  status,
  query,
  levels,
}: {
  status: DictStatus;
  query: string;
  levels: Level[];
}) {
  const data = useDbQuery(loadDictionary, []);
  // Plain values first: the React Compiler hoists `data.x` reads out of callbacks.
  const loaded = data !== undefined;
  const entries = data ? data.entries : null;
  const cards = data ? data.cards : null;
  const favorites = data ? data.favorites : null;
  const initial = useMemo(() => {
    if (!entries || !cards || !favorites) return null;
    const found = searchDictionary(entries, { query, levels, status }, { cards, favorites });
    return shuffle(found, `${new Date().toDateString()}:${status}:${query}`).slice(0, DECK_SIZE);
  }, [entries, cards, favorites, query, levels, status]);

  const [deck, setDeck] = useState<string[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const order = deck ?? initial?.map((e) => e.id) ?? [];
  const byId = useMemo(() => new Map(initial?.map((e) => [e.id, e])), [initial]);
  const current = order[0] ? byId.get(order[0]) : undefined;

  const next = (again: boolean) => {
    feedback.tap();
    const [head, ...rest] = order;
    setDeck(again && head ? [...rest, head] : rest);
    setFlipped(false);
  };

  if (!loaded || !initial)
    return (
      <SubScreen title="Карточки" fallback="/dictionary">
        {null}
      </SubScreen>
    );

  return (
    <SubScreen
      title={`Карточки${order.length ? ` · осталось ${order.length}` : ''}`}
      fallback="/dictionary"
    >
      {!current ? (
        <Card tone="primarySoft">
          <AppText variant="title">
            {initial.length ? 'Колода пройдена' : 'Здесь пока нет слов'}
          </AppText>
          <Button label="Вернуться в словарь" onPress={() => goBack('/dictionary')} />
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <AppText variant="display" align="center">
              {current.en}
            </AppText>
            {current.ipa && (
              <AppText variant="body" color="textMuted" align="center">
                /{current.ipa}/
              </AppText>
            )}
            <View style={styles.center}>
              <SpeakButtons text={current.en} large label={`Произнести ${current.en}`} />
            </View>
            {flipped ? (
              <View style={styles.back} aria-live="polite">
                <AppText variant="title" align="center">
                  {current.ru.join(', ')}
                </AppText>
                {current.example && (
                  <AppText variant="small" color="textMuted" align="center">
                    {current.example.en} — {current.example.ru}
                  </AppText>
                )}
              </View>
            ) : (
              <Button
                label="Показать перевод"
                variant="secondary"
                icon="eye"
                onPress={() => setFlipped(true)}
              />
            )}
          </Card>
          {flipped && (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  label="Ещё раз"
                  variant="secondary"
                  icon="refresh"
                  onPress={() => next(true)}
                />
              </View>
              <View style={styles.flex}>
                <Button label="Помню" variant="success" icon="check" onPress={() => next(false)} />
              </View>
            </View>
          )}
        </>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { paddingVertical: 32, gap: 16 },
  center: { alignItems: 'center' },
  back: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
});
