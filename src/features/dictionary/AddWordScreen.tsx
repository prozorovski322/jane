import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getDb } from '@/core/storage';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { SubScreen } from '@/ui/components/SubScreen';
import { TextField } from '@/ui/components/TextField';

import { useProgress } from '../progress/store';
import {
  findDuplicate,
  saveOwnWord,
  validateDraft,
  type DraftErrors,
  type WordDraft,
} from './actions';

const EMPTY: WordDraft = { en: '', ru: '', exampleEn: '', exampleRu: '', note: '' };

function Field({
  label,
  hint,
  error,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
} & React.ComponentProps<typeof TextField>) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="smallStrong">{label}</AppText>
      <TextField label={label} state={error ? 'wrong' : 'idle'} {...rest} />
      {error ? (
        <AppText variant="small" color="error" role="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function AddWordScreen() {
  const [draft, setDraft] = useState<WordDraft>(EMPTY);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [duplicate, setDuplicate] = useState<{ id: string; own: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof WordDraft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    const e = validateDraft(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const db = getDb();
    const dup = await findDuplicate(db, draft.en);
    if (dup && !duplicate) {
      setDuplicate(dup);
      return;
    }
    setSaving(true);
    try {
      const w = await saveOwnWord(db, draft);
      await useProgress.getState().refresh(db);
      router.replace(`/word/${w.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SubScreen
      title="Своё слово"
      fallback="/dictionary"
      footer={
        <Button
          label="Сохранить и учить"
          icon="check"
          loading={saving}
          onPress={() => void save()}
        />
      }
    >
      <AppText variant="small" color="textMuted">
        Слово сразу попадёт в повторение, а в словаре будет отмечено как «моё».
      </AppText>
      <Field
        label="Слово или фраза"
        placeholder="deadline"
        value={draft.en}
        onChangeText={set('en')}
        error={errors.en}
      />
      <Field
        label="Перевод"
        placeholder="срок, крайний срок"
        hint="Несколько вариантов — через запятую."
        value={draft.ru}
        onChangeText={set('ru')}
        error={errors.ru}
        autoCapitalize="none"
      />
      <Field
        label="Пример (по желанию)"
        placeholder="The deadline is Friday."
        value={draft.exampleEn}
        onChangeText={set('exampleEn')}
      />
      <Field
        label="Перевод примера"
        placeholder="Срок — пятница."
        value={draft.exampleRu}
        onChangeText={set('exampleRu')}
        error={errors.exampleRu}
      />
      <Field
        label="Заметка (по желанию)"
        placeholder="Где встретил, как запомнить"
        value={draft.note}
        onChangeText={set('note')}
      />
      {duplicate && (
        <View style={{ gap: 8 }}>
          <AppText variant="body" role="alert">
            {duplicate.own ? 'Такое слово уже есть среди ваших.' : 'Это слово уже есть в курсе.'}{' '}
            Сохранить ещё раз или открыть его?
          </AppText>
          <Button
            label="Открыть слово"
            variant="secondary"
            onPress={() => router.replace(`/word/${duplicate.id}`)}
          />
        </View>
      )}
    </SubScreen>
  );
}
