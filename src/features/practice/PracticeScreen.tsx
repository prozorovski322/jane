import { router } from 'expo-router';

import { TROUBLES, type Trouble } from '@/core/content/schema';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { ListRow } from '@/ui/components/Card';
import type { IconName } from '@/ui/components/Icon';
import { Screen, SectionTitle } from '@/ui/components/Screen';

import { TROUBLE_LABEL } from '../progress/insights';
import { useProgress } from '../progress/store';
import { buildPractice, PRACTICE_INFO, type PracticeKind, type PracticeSpec } from './build';
import { loadPracticeSources } from './load';

const SKILLS: { kind: PracticeKind; icon: IconName }[] = [
  { kind: 'words', icon: 'cards' },
  { kind: 'listening', icon: 'speaker' },
  { kind: 'reading', icon: 'eye' },
  { kind: 'speaking', icon: 'mic' },
  { kind: 'writing', icon: 'keyboard' },
  { kind: 'pronunciation', icon: 'speaker-slow' },
];

function open(spec: PracticeSpec, title?: string) {
  router.push({
    pathname: '/practice/[kind]',
    params: { kind: spec.kind, ref: spec.ref ?? '', title: title ?? '' },
  });
}

export function PracticeScreen() {
  const completed = useProgress((s) => s.snapshot?.completedLessons);
  const data = useDbQuery(
    async (db) => {
      const src = await loadPracticeSources(db, completed ?? new Set());
      const count = (spec: PracticeSpec) => buildPractice(spec, src, 'count').length;
      return {
        counts: Object.fromEntries(
          [...SKILLS.map((s) => s.kind), 'mistakes', 'grammar-mix'].map((k) => [
            k,
            count({ kind: k as PracticeKind }),
          ]),
        ) as Record<PracticeKind, number>,
        weak: src.weak,
        // A "series" of one or two exercises is not worth a session.
        troubles: TROUBLES.map((t) => ({ t, n: count({ kind: 'trouble', ref: t }) })).filter(
          (x) => x.n >= 3,
        ),
        anySeen: src.seen.length > 0,
      };
    },
    [completed],
  );

  // Plain values first: the React Compiler hoists `data.x` reads out of callbacks.
  const counts = data ? data.counts : null;
  const weak = data ? data.weak : [];
  const troubles = data ? data.troubles : [];
  const anySeen = data ? data.anySeen : true;

  return (
    <Screen title="Практика" subtitle="Тренировки из того, что вы уже прошли">
      {data && !anySeen && (
        <AppText variant="body" color="textMuted">
          Пройдите первый урок — здесь появятся тренировки по словам, аудированию и остальным
          навыкам.
        </AppText>
      )}

      <SectionTitle>Навыки</SectionTitle>
      {SKILLS.map(({ kind, icon }) => {
        const n = counts ? (counts[kind] ?? 0) : 0;
        return (
          <ListRow
            key={kind}
            icon={icon}
            title={PRACTICE_INFO[kind].title}
            subtitle={n ? `${PRACTICE_INFO[kind].subtitle} · заданий: ${n}` : 'Пока нет материала'}
            onPress={n ? () => open({ kind }) : undefined}
          />
        );
      })}

      <SectionTitle>Ошибки и повторение</SectionTitle>
      <ListRow
        icon="cross"
        iconColor="accent"
        title="Ошибки"
        subtitle={
          counts?.mistakes
            ? `Задания, в которых вы недавно ошиблись · ${counts.mistakes}`
            : 'Пока неверных ответов нет'
        }
        onPress={() => router.push('/mistakes')}
      />
      <ListRow
        icon="refresh"
        title={PRACTICE_INFO['grammar-mix'].title}
        subtitle={
          counts?.['grammar-mix']
            ? PRACTICE_INFO['grammar-mix'].subtitle
            : 'Появится после первых уроков с грамматикой'
        }
        onPress={counts?.['grammar-mix'] ? () => open({ kind: 'grammar-mix' }) : undefined}
      />

      <SectionTitle>Слабые места</SectionTitle>
      {weak.length ? (
        <>
          <ListRow
            icon="target"
            iconColor="accent"
            title="Всё сразу"
            subtitle={PRACTICE_INFO.weak.subtitle}
            onPress={() => open({ kind: 'weak' })}
          />
          {weak.slice(0, 5).map((w) => (
            <ListRow
              key={`${w.kind}:${w.ref}`}
              icon={w.kind === 'grammar' ? 'book' : 'target'}
              iconColor="accent"
              title={w.label}
              subtitle={`Верно ${Math.round(w.accuracy * 100)}% из ${w.attempts} ответов`}
              onPress={() =>
                open({ kind: w.kind === 'grammar' ? 'grammar' : 'trouble', ref: w.ref }, w.label)
              }
            />
          ))}
        </>
      ) : (
        <AppText variant="small" color="textMuted">
          Пока явных слабых мест нет. Они появятся, когда в одном правиле или звуке накопится
          несколько ошибок.
        </AppText>
      )}

      <SectionTitle>Трудности русскоговорящих</SectionTitle>
      {troubles.map(({ t, n }) => (
        <ListRow
          key={t}
          icon="target"
          title={TROUBLE_LABEL[t as Trouble]}
          subtitle={`Целевая серия · заданий: ${n}`}
          onPress={() => open({ kind: 'trouble', ref: t }, TROUBLE_LABEL[t as Trouble])}
        />
      ))}

      <SectionTitle>Грамматика</SectionTitle>
      <ListRow
        icon="book"
        title="Справочник правил"
        subtitle="Правила по уровням с примерами и упражнениями"
        onPress={() => router.push('/grammar')}
      />
    </Screen>
  );
}
