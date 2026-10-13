import { router } from 'expo-router';
import { Fragment, useMemo } from 'react';

import { getCourse, getGrammarNote } from '@/core/content';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { ListRow } from '@/ui/components/Card';
import { SectionTitle } from '@/ui/components/Screen';
import { SubScreen } from '@/ui/components/SubScreen';

import { NoteView } from './NoteView';

/** Grammar notes in course order, grouped by level; optionally only those of one unit. */
export function GrammarListScreen({ unitId }: { unitId?: string }) {
  const groups = useMemo(() => {
    const course = getCourse();
    return course.levels
      .map((l) => {
        const ids = l.units.filter((u) => !unitId || u.id === unitId).flatMap((u) => u.grammar);
        return {
          level: l.level,
          title: l.title,
          notes: [...new Set(ids)].map((id) => getGrammarNote(id)).filter((n) => !!n),
        };
      })
      .filter((g) => g.notes.length);
  }, [unitId]);

  const unitTitle = unitId
    ? getCourse()
        .levels.flatMap((l) => l.units)
        .find((u) => u.id === unitId)?.title.ru
    : null;

  return (
    <SubScreen title={unitTitle ? `Правила: ${unitTitle}` : 'Справочник'}>
      {groups.map((g) => (
        <Fragment key={g.level}>
          <SectionTitle>{`${g.level} · ${g.title}`}</SectionTitle>
          {g.notes.map((n) => (
            <ListRow
              key={n.id}
              icon="book"
              title={n.title}
              subtitle={n.summary}
              onPress={() => router.push(`/grammar/${n.id}`)}
            />
          ))}
        </Fragment>
      ))}
      {unitId && (
        <Button label="Все правила" variant="ghost" onPress={() => router.replace('/grammar')} />
      )}
    </SubScreen>
  );
}

export function GrammarNoteScreen({ id }: { id: string }) {
  const note = getGrammarNote(id);
  const units = useMemo(
    () =>
      getCourse()
        .levels.flatMap((l) => l.units)
        .filter((u) => u.grammar.includes(id)),
    [id],
  );

  if (!note) {
    return (
      <SubScreen title="Правило">
        <AppText variant="body">Правило не найдено.</AppText>
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={note.level}
      footer={
        <Button
          label="Потренировать правило"
          icon="target"
          onPress={() =>
            router.push({
              pathname: '/practice/[kind]',
              params: { kind: 'grammar', ref: id, title: note.title },
            })
          }
        />
      }
    >
      <AppText variant="title" role="heading">
        {note.title}
      </AppText>
      <AppText variant="body" color="textMuted">
        {note.summary}
      </AppText>
      <NoteView blocks={note.blocks} />
      {units.length > 0 && (
        <>
          <SectionTitle>Где встречается</SectionTitle>
          {units.map((u) => (
            <ListRow
              key={u.id}
              icon="path"
              title={`Юнит ${u.order}: ${u.title.ru}`}
              subtitle={u.title.en}
              onPress={() =>
                router.push(
                  `/lesson/${u.lessons.find((l) => l.kind === 'grammar')?.id ?? u.lessons[0]!.id}`,
                )
              }
            />
          ))}
        </>
      )}
    </SubScreen>
  );
}
