import { router } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { getCourse } from '@/core/content';
import { LEVEL_LABEL, LEVELS, type Level } from '@/core/content/schema';
import { useDbQuery } from '@/lib/useDbQuery';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Mascot } from '@/ui/components/Mascot';
import { SubScreen } from '@/ui/components/SubScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { levelExamId } from '../exams/exam';
import { loadCertificates } from './service';

const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export function shareText(level: Level, score: number | null): string {
  const result = score ? ` Результат экзамена: ${Math.round(score * 100)}%.` : '';
  return `Я прошёл(а) уровень ${LEVEL_LABEL[level]} в приложении Jane.${result}`;
}

/** The learner's badge for a level. It is an app badge, not an official CEFR certificate. */
export function CertificateScreen({ level: code }: { level: string }) {
  const { colors, radius } = useTheme();
  const level = LEVELS.find((l) => l === code.toUpperCase());
  const certificates = useDbQuery((db) => loadCertificates(db), []);
  const info = level ? getCourse().levels.find((l) => l.level === level) : undefined;
  const cert = certificates?.find((c) => c.level === level);

  if (!level || !info) {
    return (
      <SubScreen title="Сертификат">
        <AppText variant="body">Такого уровня нет.</AppText>
      </SubScreen>
    );
  }
  if (certificates && !cert) {
    return (
      <SubScreen title="Сертификат">
        <AppText variant="body">
          Сертификата уровня {LEVEL_LABEL[level]} пока нет. Он выдаётся после экзамена уровня.
        </AppText>
        <Button
          label="К экзамену уровня"
          icon="arrow-right"
          onPress={() => router.replace(`/lesson/${levelExamId(level)}`)}
        />
      </SubScreen>
    );
  }
  if (!cert) return <SubScreen title="Сертификат">{null}</SubScreen>;

  const byExam = cert.source === 'exam';
  return (
    <SubScreen title="Сертификат">
      <View
        style={[
          styles.badge,
          { backgroundColor: colors.surface, borderColor: colors.xp, borderRadius: radius.xl },
        ]}
      >
        <Mascot emotion="celebrate" size={104} />
        <AppText variant="caption" color="textMuted">
          Jane · сертификат уровня
        </AppText>
        <AppText variant="display" align="center" role="heading" color="primary">
          {LEVEL_LABEL[level]}
        </AppText>
        <AppText variant="heading" align="center">
          {info.title}
        </AppText>
        <AppText variant="small" color="textMuted" align="center">
          {byExam
            ? `Выдан ${fmt.format(new Date(cert.earnedAt))} · экзамен сдан на ${Math.round(cert.score * 100)}%`
            : `Уровень засчитан ${fmt.format(new Date(cert.earnedAt))} по тесту уровня`}
        </AppText>
      </View>

      <Card>
        <AppText variant="heading">Что вы умеете на этом уровне</AppText>
        {info.canDo.map((c) => (
          <AppText key={c} variant="small">
            • {c}
          </AppText>
        ))}
      </Card>

      <AppText variant="caption" color="textMuted">
        Это учебный сертификат приложения Jane, а не официальный документ CEFR, Cambridge или IELTS.
      </AppText>
      {byExam && (
        <Button
          label="Поделиться"
          icon="arrow-right"
          variant="secondary"
          onPress={() =>
            void Share.share({ message: shareText(level, cert.score) }).catch(() => {})
          }
        />
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 3, padding: 20, alignItems: 'center', gap: 6 },
});
