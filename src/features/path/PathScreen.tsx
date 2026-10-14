import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getCourse } from '@/core/content';
import { LEVEL_LABEL, LEVELS } from '@/core/content/schema';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card, ListRow } from '@/ui/components/Card';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { loadCertificates, type Certificate } from '../certificates/service';
import { StreakXp } from '../progress/Badges';
import {
  estimateWeeks,
  lessonsInLastTwoWeeks,
  remainingInLevel,
  weeksPhrase,
} from '../progress/eta';
import { useProgress } from '../progress/store';
import { KIND_ICON, KIND_LABEL } from './kinds';
import {
  isTrackOpen,
  pathState,
  type ExamNode,
  type PathLevel,
  type PathNode,
  type PathTrack,
  type PathUnit,
} from './state';

/** Horizontal offsets of nodes: a gentle winding road. */
const WIND = [0, 1, 2, 1, 0, -1, -2, -1];
const STEP = 44;
const NODE = 64;

const STATUS_LABEL = { done: 'пройден', next: 'следующий', open: 'не пройден' } as const;

function Node({ node, index }: { node: PathNode; index: number }) {
  const { colors } = useTheme();
  const look = {
    done: { bg: colors.successSoft, border: colors.success, fg: colors.success },
    next: { bg: colors.primary, border: colors.primaryPressed, fg: colors.onPrimary },
    open: { bg: colors.surface, border: colors.borderStrong, fg: colors.textMuted },
  }[node.status];
  const title = /[.!?…]$/.test(node.title) ? node.title : `${node.title}.`;
  const label = `${node.isTest ? 'Тест юнита' : `Урок ${index + 1}: ${title}`} ${KIND_LABEL[node.kind] ?? ''}, ${STATUS_LABEL[node.status]}`;

  return (
    <View
      style={[
        styles.nodeWrap,
        { transform: [{ translateX: (WIND[index % WIND.length] ?? 0) * STEP }] },
      ]}
    >
      {node.status === 'next' && (
        <View style={[styles.bubble, { backgroundColor: colors.primary }]}>
          <AppText variant="caption" style={{ color: colors.onPrimary }}>
            Начать
          </AppText>
        </View>
      )}
      <PressableScale
        role="button"
        aria-label={label}
        testID={`node-${node.id}`}
        onPress={() => router.push(`/lesson/${node.id}`)}
        scaleTo={0.92}
        style={[styles.node, { backgroundColor: look.bg, borderColor: look.border }]}
      >
        <Icon
          name={node.status === 'done' ? 'check' : (KIND_ICON[node.kind] ?? 'book')}
          size={28}
          color={look.fg}
        />
      </PressableScale>
      <AppText
        variant="caption"
        color={node.status === 'open' ? 'textMuted' : 'text'}
        align="center"
        style={styles.nodeTitle}
        numberOfLines={2}
        aria-hidden
      >
        {node.title}
      </AppText>
    </View>
  );
}

function UnitBlock({ unit }: { unit: PathUnit }) {
  const { colors } = useTheme();
  return (
    <View style={styles.unit}>
      <Card tone="surface">
        <View style={styles.unitHead}>
          <View style={styles.flex}>
            <AppText variant="caption" color="textMuted">
              Юнит {unit.order} · {unit.title.en}
            </AppText>
            <AppText variant="title">{unit.title.ru}</AppText>
          </View>
          <AppText variant="smallStrong" color={unit.done === unit.total ? 'success' : 'textMuted'}>
            {unit.done}/{unit.total}
          </AppText>
        </View>
        <ProgressBar
          value={unit.done / unit.total}
          label={`Юнит ${unit.order}: пройдено ${unit.done} из ${unit.total}`}
        />
        {unit.grammar.length > 0 && (
          <Button
            label="Правила юнита"
            icon="book"
            variant="ghost"
            compact
            onPress={() => router.push({ pathname: '/grammar', params: { unit: unit.id } })}
          />
        )}
      </Card>
      <View style={styles.road}>
        {unit.nodes.map((n, i) => (
          <Node key={n.id} node={n} index={i} />
        ))}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
    </View>
  );
}

const EXAM_TEXT = {
  level: {
    open: 'Около 50 заданий, нужно 75%. Можно сдать, не проходя уроки.',
    soon: 'Появится, когда будут готовы все юниты уровня.',
  },
  module: {
    open: 'Около 20 заданий по темам модуля, нужно 70%.',
    soon: 'Появится, когда будут готовы все юниты модуля.',
  },
  track: {
    open: 'Около 30 заданий по темам трека, нужно 75%.',
    soon: 'Появится, когда будут готовы все юниты трека.',
  },
} as const;

function ExamRow({ exam, title }: { exam: ExamNode; title: string }) {
  const subtitle =
    exam.status === 'done' ? 'Сдан. Можно пересдать.' : EXAM_TEXT[exam.kind][exam.status];
  return (
    <ListRow
      icon={exam.kind === 'level' ? 'trophy' : 'star'}
      title={title}
      subtitle={subtitle}
      done={exam.status === 'done'}
      onPress={exam.status === 'soon' ? undefined : () => router.push(`/lesson/${exam.id}`)}
    />
  );
}

function SoonUnit({ order, title }: { order: number; title: { en: string; ru: string } }) {
  return (
    <Card tone="surface">
      <View style={styles.unitHead} accessible aria-label={`Юнит ${order}: ${title.ru}. Скоро.`}>
        <View style={styles.flex}>
          <AppText variant="caption" color="textMuted">
            Юнит {order} · {title.en}
          </AppText>
          <AppText variant="bodyStrong" color="textMuted">
            {title.ru}
          </AppText>
        </View>
        <AppText variant="smallStrong" color="textMuted">
          Скоро
        </AppText>
      </View>
    </Card>
  );
}

function LevelBlock({ level, certificate }: { level: PathLevel; certificate?: Certificate }) {
  const [open, setOpen] = useState(false);
  const examTitle = `Экзамен уровня ${LEVEL_LABEL[level.level]}`;
  return (
    <View style={styles.level}>
      <View style={styles.unitHead}>
        <AppText variant="heading" role="heading" style={styles.flex}>
          {LEVEL_LABEL[level.level]} · {level.title}
        </AppText>
        {certificate ? (
          <Button
            label={certificate.source === 'exam' ? 'Сертификат' : 'Засчитан тестом'}
            icon="trophy"
            variant="ghost"
            compact
            onPress={() => router.push(`/certificate/${level.level.toLowerCase()}`)}
          />
        ) : (
          <AppText variant="small" color="textMuted">
            {level.done}/{level.total}
          </AppText>
        )}
      </View>
      <Button
        label={open ? 'Скрыть цели уровня' : 'Цели уровня'}
        icon="target"
        variant="ghost"
        compact
        onPress={() => setOpen((v) => !v)}
      />
      {open && (
        <Card tone="primarySoft">
          <AppText variant="small">{level.info.description}</AppText>
          <AppText variant="smallStrong">После уровня я смогу:</AppText>
          {level.info.canDo.map((c) => (
            <AppText key={c} variant="small">
              • {c}
            </AppText>
          ))}
          <AppText variant="caption" color="textMuted">
            Около {level.info.vocabTarget} новых слов. Грамматика:{' '}
            {level.info.grammarScope.join('; ')}.
          </AppText>
        </Card>
      )}

      {level.modules.map((m) => (
        <View key={m.id} style={styles.module}>
          <AppText variant="smallStrong" color="textMuted" role="heading">
            Модуль {m.order} · {m.title.ru}
          </AppText>
          {m.units.map((u) => (
            <UnitBlock key={u.id} unit={u} />
          ))}
          {m.planned.map((p) => (
            <SoonUnit key={p.id} order={Number(p.id.split('.u')[1])} title={p.title} />
          ))}
          <ExamRow exam={m.test} title={`Контрольная: ${m.title.ru}`} />
        </View>
      ))}
      <ExamRow exam={level.exam} title={examTitle} />
    </View>
  );
}

function TrackBlock({ track, open }: { track: PathTrack; open: boolean }) {
  const { colors } = useTheme();
  const level = LEVEL_LABEL[track.requires];
  return (
    <View style={styles.level}>
      <View style={styles.unitHead}>
        <AppText variant="heading" role="heading" style={styles.flex}>
          {track.title.ru}
        </AppText>
        <AppText variant="small" color="textMuted">
          {open ? `${track.done}/${track.total}` : `с уровня ${level}`}
        </AppText>
      </View>
      <AppText variant="small" color="textMuted">
        {track.description}
      </AppText>
      {open ? (
        <>
          {track.units.map((u) => (
            <UnitBlock key={u.id} unit={u} />
          ))}
          {track.planned.map((p) => (
            <SoonUnit key={p.id} order={Number(p.id.split('.u')[1])} title={p.title} />
          ))}
          <ExamRow exam={track.exam} title={`Итоговый тест: ${track.title.ru}`} />
        </>
      ) : (
        <Card tone="surface">
          <View style={styles.unitHead}>
            <Icon name="lock" size={20} color={colors.textMuted} />
            <AppText variant="small" style={styles.flex}>
              Откроется с сертификатом {level}: сдайте экзамен уровня {level} или пройдите входной
              тест.
            </AppText>
          </View>
          <Button
            label={`Экзамен ${level}`}
            icon="trophy"
            variant="ghost"
            compact
            onPress={() => router.push(`/lesson/${track.requires.toLowerCase()}.exam`)}
          />
        </Card>
      )}
    </View>
  );
}

export function PathScreen() {
  const completed = useProgress((s) => s.snapshot?.completedLessons);
  const state = useMemo(() => pathState(getCourse(), completed ?? new Set()), [completed]);
  const next = state.next;
  const certificates = useDbQuery((db) => loadCertificates(db), []);
  const byLevel = new Map((certificates ?? []).map((c) => [c.level, c]));

  // Time left in the current level at the learner's own pace (nothing is shown without history).
  const nextLevel = next ? LEVELS.find((l) => l.toLowerCase() === next.unitId.split('.')[0]) : null;
  const pace = useDbQuery((db) => lessonsInLastTwoWeeks(db), [completed]);
  const weeks =
    nextLevel && pace !== undefined
      ? estimateWeeks(remainingInLevel(nextLevel, completed ?? new Set()), pace)
      : null;

  return (
    <Screen title="Путь" right={<StreakXp />}>
      {next ? (
        <Card tone="primarySoft">
          <AppText variant="caption" color="textMuted">
            {next.node.isTest ? 'Следующий шаг' : 'Продолжить'}
          </AppText>
          <AppText variant="title">{next.node.title}</AppText>
          {weeks !== null && nextLevel && (
            <AppText variant="small" color="textMuted">
              Оставшиеся уроки уровня {LEVEL_LABEL[nextLevel]} — {weeksPhrase(weeks)} в вашем темпе.
            </AppText>
          )}
          <Button
            label="Начать"
            icon="arrow-right"
            onPress={() => router.push(`/lesson/${next.node.id}`)}
          />
        </Card>
      ) : (
        <Card tone="primarySoft">
          <AppText variant="title">Все уроки пройдены</AppText>
          <AppText variant="small" color="textMuted">
            Новые юниты появятся с обновлением курса. Пока — повторение и практика.
          </AppText>
        </Card>
      )}

      {state.levels.map((l) => (
        <LevelBlock key={l.level} level={l} certificate={byLevel.get(l.level)} />
      ))}

      {state.tracks.length > 0 && (
        <AppText variant="heading" role="heading">
          Треки
        </AppText>
      )}
      {state.tracks.map((t) => (
        <TrackBlock key={t.id} track={t} open={isTrackOpen(t.requires, [...byLevel.keys()])} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  level: { gap: 12 },
  module: { gap: 12 },
  unit: { gap: 16 },
  unitHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  road: { alignItems: 'center', gap: 18, paddingVertical: 8 },
  nodeWrap: { alignItems: 'center', width: 140 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 3,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTitle: { marginTop: 6 },
  bubble: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6 },
  divider: { height: 1, marginVertical: 8 },
});
