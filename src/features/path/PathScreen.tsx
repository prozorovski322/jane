import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { getCourse } from '@/core/content';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { StreakXp } from '../progress/Badges';
import { useProgress } from '../progress/store';
import { KIND_ICON, KIND_LABEL } from './kinds';
import { pathState, type PathNode, type PathUnit } from './state';

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

export function PathScreen() {
  const completed = useProgress((s) => s.snapshot?.completedLessons);
  const state = useMemo(() => pathState(getCourse(), completed ?? new Set()), [completed]);
  const next = state.next;

  return (
    <Screen title="Путь" right={<StreakXp />}>
      {next ? (
        <Card tone="primarySoft">
          <AppText variant="caption" color="textMuted">
            {next.node.isTest ? 'Следующий шаг' : 'Продолжить'}
          </AppText>
          <AppText variant="title">{next.node.title}</AppText>
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
        <View key={l.level} style={styles.level}>
          <View style={styles.unitHead}>
            <AppText variant="heading" role="heading" style={styles.flex}>
              {l.level} · {l.title}
            </AppText>
            <AppText variant="small" color="textMuted">
              {l.done}/{l.total}
            </AppText>
          </View>
          {l.units.map((u) => (
            <UnitBlock key={u.id} unit={u} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  level: { gap: 12 },
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
