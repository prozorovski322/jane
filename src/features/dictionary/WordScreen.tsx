import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getLexicon, getUnitOutline } from '@/core/content';
import { getDb } from '@/core/storage';
import { deleteUserWord, setFavorite } from '@/core/storage/words-repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { IconButton } from '@/ui/components/IconButton';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { goBack, SubScreen } from '@/ui/components/SubScreen';

import { useProgress } from '../progress/store';
import { startLearning } from './actions';
import { POS_LABEL } from './entries';
import { loadDictionary } from './load';
import { wordStatus } from './search';

const FORM_LABEL: Record<string, string> = {
  plural: 'мн. число',
  third: 'he/she/it',
  past: 'прошедшее',
  pastParticiple: '3-я форма',
  ing: '-ing',
  comparative: 'сравн. степень',
  superlative: 'превосх. степень',
};

function dateRu(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(d);
}

export function WordScreen({ id }: { id: string }) {
  const data = useDbQuery(loadDictionary, []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const entry = data?.entries.find((e) => e.id === id);
  const lex = getLexicon().get(id);

  if (!data)
    return (
      <SubScreen title="Слово" fallback="/dictionary">
        {null}
      </SubScreen>
    );
  if (!entry) {
    return (
      <SubScreen title="Слово" fallback="/dictionary">
        <AppText variant="body">Такого слова нет в словаре.</AppText>
      </SubScreen>
    );
  }

  const favorite = data.favorites.has(id);
  const status = wordStatus(id, data.cards);
  const card = data.cards.get(`word:${id}`);
  const changed = () => useProgress.getState().refresh(getDb());

  return (
    <SubScreen
      title={entry.own ? 'Моё слово' : 'Слово'}
      fallback="/dictionary"
      right={
        <IconButton
          icon={favorite ? 'star-filled' : 'star'}
          label={favorite ? 'Убрать из избранного' : 'В избранное'}
          color={favorite ? 'xp' : 'textMuted'}
          onPress={async () => {
            await setFavorite(getDb(), id, !favorite);
            useProgress.getState().touch();
          }}
        />
      }
    >
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="display">{entry.en}</AppText>
          {entry.ipa && (
            <AppText variant="body" color="textMuted">
              /{entry.ipa}/
            </AppText>
          )}
          <AppText variant="small" color="textMuted">
            {[
              entry.pos && POS_LABEL[entry.pos],
              entry.level,
              entry.unit && `юнит «${getUnitOutline(entry.unit)?.title.ru ?? entry.unit}»`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
        <SpeakButtons text={entry.en} large label={`Произнести ${entry.en}`} />
      </View>

      <Card>
        <AppText variant="smallStrong" color="textMuted">
          Перевод
        </AppText>
        <AppText variant="heading">{entry.ru.join(', ')}</AppText>
        {entry.note && <AppText variant="small">{entry.note}</AppText>}
      </Card>

      {entry.example && (
        <Card>
          <View style={styles.exampleRow}>
            <SpeakButtons text={entry.example.en} label="Прослушать пример" />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{entry.example.en}</AppText>
              <AppText variant="small" color="textMuted">
                {entry.example.ru}
              </AppText>
            </View>
          </View>
        </Card>
      )}

      {lex?.forms && Object.keys(lex.forms).length > 0 && (
        <Card>
          <AppText variant="smallStrong" color="textMuted">
            Формы
          </AppText>
          {Object.entries(lex.forms).map(([k, v]) => (
            <AppText key={k} variant="body">
              {FORM_LABEL[k] ?? k}: <AppText variant="bodyStrong">{v}</AppText>
            </AppText>
          ))}
        </Card>
      )}

      <Card tone={status === 'known' ? 'primarySoft' : 'surface'}>
        <AppText variant="smallStrong" color="textMuted">
          Изучение
        </AppText>
        <AppText variant="body">
          {status === 'new' && 'Слово ещё не в повторении.'}
          {status === 'learning' && card && `Изучаю. Следующее повторение — ${dateRu(card.due)}.`}
          {status === 'known' && card && `Выучено. Повторю ${dateRu(card.due)}, чтобы не забылось.`}
        </AppText>
        {status === 'new' && (
          <Button
            label="Учить в повторении"
            icon="refresh"
            onPress={async () => {
              await startLearning(getDb(), id);
              await changed();
            }}
          />
        )}
      </Card>

      {entry.own &&
        (confirmDelete ? (
          <Card tone="accentSoft">
            <AppText variant="body">Удалить слово «{entry.en}» и его карточку повторения?</AppText>
            <Button
              label="Удалить"
              variant="danger"
              onPress={async () => {
                await deleteUserWord(getDb(), id);
                await changed();
                goBack('/dictionary');
              }}
            />
            <Button label="Отмена" variant="ghost" onPress={() => setConfirmDelete(false)} />
          </Card>
        ) : (
          <Button
            label="Удалить слово"
            icon="trash"
            variant="ghost"
            onPress={() => setConfirmDelete(true)}
          />
        ))}

      {entry.unit && getUnitOutline(entry.unit) && (
        <Button
          label="Открыть юнит"
          variant="ghost"
          onPress={() => router.push(`/lesson/${getUnitOutline(entry.unit!)!.lessons[0]!.id}`)}
        />
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
