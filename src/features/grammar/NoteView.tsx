import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GrammarBlock } from '@/core/content/schema';
import { AppText, type AppTextProps } from '@/ui/components/AppText';
import { Icon } from '@/ui/components/Icon';
import { SpeakButtons } from '@/ui/components/SpeakButtons';
import { useTheme } from '@/ui/theme/ThemeProvider';

/** Text with **bold** fragments. */
export function RichText({ text, ...rest }: { text: string } & AppTextProps) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <AppText {...rest}>
      {parts.map((p, i) =>
        i % 2 ? (
          <AppText key={i} variant="bodyStrong" style={rest.style}>
            {p}
          </AppText>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </AppText>
  );
}

function Block({ b }: { b: GrammarBlock }) {
  const { colors, radius } = useTheme();
  switch (b.type) {
    case 'heading':
      return (
        <AppText variant="heading" role="heading" style={styles.heading}>
          {b.text}
        </AppText>
      );
    case 'paragraph':
      return <RichText text={b.text} />;
    case 'list':
      return (
        <View style={styles.list}>
          {b.items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <AppText aria-hidden>•</AppText>
              <RichText text={item} style={styles.flex} />
            </View>
          ))}
        </View>
      );
    case 'example':
      return (
        <View
          style={[
            styles.example,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
            },
          ]}
        >
          <SpeakButtons text={b.en} label={`Прослушать: ${b.en}`} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{b.en}</AppText>
            <AppText variant="small" color="textMuted">
              {b.ru}
            </AppText>
          </View>
        </View>
      );
    case 'mistake':
      return (
        <View
          style={[styles.mistake, { backgroundColor: colors.errorSoft, borderRadius: radius.md }]}
        >
          <View style={styles.row} accessible aria-label={`Неправильно: ${b.wrong}`}>
            <Icon name="cross" size={18} color={colors.error} />
            <AppText variant="body" style={styles.strike}>
              {b.wrong}
            </AppText>
          </View>
          <View style={styles.row} accessible aria-label={`Правильно: ${b.right}`}>
            <Icon name="check" size={18} color={colors.success} />
            <AppText variant="bodyStrong">{b.right}</AppText>
          </View>
          <AppText variant="small">{b.why}</AppText>
        </View>
      );
    case 'tip':
      return (
        <View style={[styles.tip, { backgroundColor: colors.xpSoft, borderRadius: radius.md }]}>
          <Icon name="bulb" size={20} color={colors.xp} />
          <RichText text={b.text} variant="small" style={styles.flex} />
        </View>
      );
    case 'table':
      return (
        <View
          style={[styles.table, { borderColor: colors.border, borderRadius: radius.md }]}
          role="table"
        >
          {[b.header, ...b.rows].map((row, ri) => (
            <View
              key={ri}
              role="row"
              style={[
                styles.tr,
                ri === 0 && { backgroundColor: colors.surfaceAlt },
                ri > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
              ]}
            >
              {row.map((cell, ci) => (
                <AppText key={ci} variant={ri === 0 ? 'smallStrong' : 'small'} style={styles.td}>
                  {cell}
                </AppText>
              ))}
            </View>
          ))}
        </View>
      );
  }
}

export function NoteView({ blocks }: { blocks: readonly GrammarBlock[] }) {
  return (
    <View style={styles.note}>
      {blocks.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { gap: 12 },
  heading: { marginTop: 8 },
  list: { gap: 6 },
  listItem: { flexDirection: 'row', gap: 8 },
  example: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1 },
  mistake: { padding: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strike: { textDecorationLine: 'line-through' },
  tip: { flexDirection: 'row', gap: 10, padding: 12 },
  table: { borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row' },
  td: { flex: 1, padding: 8 },
});
