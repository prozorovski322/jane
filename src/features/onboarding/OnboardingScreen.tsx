/**
 * First run: goal, self-assessed level, minutes a day, placement test (skipped for complete
 * beginners), permissions with plain explanations. Every step can be changed later.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  requestMicrophone,
  requestNotifications,
  type PermissionOutcome,
} from '@/core/permissions';
import { getDb } from '@/core/storage';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Choice } from '@/ui/components/Choice';
import { Mascot } from '@/ui/components/Mascot';
import { syncReminders } from '@/core/notifications/reminders';
import { IconButton } from '@/ui/components/IconButton';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { PlacementRunner } from '../placement/PlacementScreen';
import { SELF_LEVELS, type SelfLevel } from '../placement/engine';
import { setDailyMinutes } from '../progress/service';
import { useProgress } from '../progress/store';
import { GOALS, saveReminderPrefs, useOnboarding, type Goal } from './store';

type Step = 'welcome' | 'goal' | 'level' | 'time' | 'test' | 'placement' | 'permissions';
const STEPS: Step[] = ['welcome', 'goal', 'level', 'time', 'test', 'permissions'];

const MINUTES: { m: number; label: string }[] = [
  { m: 5, label: '5 минут — лёгкий темп' },
  { m: 10, label: '10 минут — обычный темп' },
  { m: 15, label: '15 минут — уверенный темп' },
  { m: 30, label: '30 минут — интенсивно' },
];

const OUTCOME_LABEL: Record<PermissionOutcome, string> = {
  granted: 'Разрешено',
  denied: 'Не разрешено. Можно включить позже в настройках телефона.',
  unavailable: 'На этом устройстве недоступно.',
};

function StepScreen({
  title,
  subtitle,
  children,
  footer,
  onBack,
  step,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  onBack?: () => void;
  step: Step;
}) {
  const { colors, space } = useTheme();
  const index = STEPS.indexOf(step);
  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={[styles.header, { paddingHorizontal: space.md }]}>
        {onBack ? (
          <IconButton icon="back" label="Назад" color="text" onPress={onBack} />
        ) : (
          <View style={styles.spacer} />
        )}
        <ProgressBar
          value={index / (STEPS.length - 1)}
          label={`Шаг ${index + 1} из ${STEPS.length}`}
        />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { padding: space.lg, gap: space.md }]}>
        <AppText variant="display" role="heading">
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="body" color="textMuted">
            {subtitle}
          </AppText>
        )}
        {children}
      </ScrollView>
      <View style={[styles.footer, { padding: space.md }]}>{footer}</View>
    </SafeAreaView>
  );
}

export function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [self, setSelf] = useState<SelfLevel | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [notif, setNotif] = useState<PermissionOutcome | null>(null);
  const [mic, setMic] = useState<PermissionOutcome | null>(null);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    const db = getDb();
    await setDailyMinutes(db, minutes);
    await saveReminderPrefs(db, { enabled: notif === 'granted' });
    void syncReminders(db);
    await useOnboarding
      .getState()
      .save(db, { done: true, goal, selfLevel: self, completedAt: Date.now() });
    await useProgress.getState().refresh(db);
    router.replace('/');
  };

  switch (step) {
    case 'welcome':
      return (
        <StepScreen
          step={step}
          title="Привет! Я Jane"
          subtitle="Помогу выучить английский с нуля до уверенного B2: слова, грамматика, аудирование, чтение, говорение и письмо. Без подписок и рекламы, всё работает без интернета."
          footer={<Button label="Начать" icon="arrow-right" onPress={() => setStep('goal')} />}
        >
          <View style={{ alignItems: 'center' }}>
            <Mascot emotion="joy" size={128} />
          </View>
          <Card tone="primarySoft">
            <AppText variant="body">
              Пара вопросов — и составлю план под вас. Это займёт минуту.
            </AppText>
          </Card>
        </StepScreen>
      );

    case 'goal':
      return (
        <StepScreen
          step={step}
          title="Зачем вам английский?"
          subtitle="Главная цель поможет подобрать темы для практики."
          onBack={() => setStep('welcome')}
          footer={<Button label="Дальше" disabled={!goal} onPress={() => setStep('level')} />}
        >
          <View style={styles.list} role="radiogroup">
            {(Object.keys(GOALS) as Goal[]).map((g) => (
              <Choice
                key={g}
                label={GOALS[g]}
                state={goal === g ? 'selected' : 'idle'}
                onPress={() => setGoal(g)}
              />
            ))}
          </View>
        </StepScreen>
      );

    case 'level':
      return (
        <StepScreen
          step={step}
          title="Как у вас с английским сейчас?"
          subtitle="Оцените честно — тест уровня всё уточнит."
          onBack={() => setStep('goal')}
          footer={<Button label="Дальше" disabled={!self} onPress={() => setStep('time')} />}
        >
          <View style={styles.list} role="radiogroup">
            {(Object.keys(SELF_LEVELS) as SelfLevel[]).map((l) => (
              <Choice
                key={l}
                label={SELF_LEVELS[l].label}
                state={self === l ? 'selected' : 'idle'}
                onPress={() => setSelf(l)}
              />
            ))}
          </View>
        </StepScreen>
      );

    case 'time':
      return (
        <StepScreen
          step={step}
          title="Сколько времени в день?"
          subtitle="Регулярность важнее длительности. Цель можно поменять в любой день."
          onBack={() => setStep('level')}
          footer={<Button label="Дальше" onPress={() => setStep('test')} />}
        >
          <View style={styles.list} role="radiogroup">
            {MINUTES.map(({ m, label }) => (
              <Choice
                key={m}
                label={label}
                state={minutes === m ? 'selected' : 'idle'}
                onPress={() => setMinutes(m)}
              />
            ))}
          </View>
        </StepScreen>
      );

    case 'test':
      if (self === 'zero') {
        return (
          <StepScreen
            step={step}
            title="Начнём с самых основ"
            subtitle="Тест уровня не нужен: первые уроки рассчитаны на тех, кто начинает с нуля. Если английский окажется знакомым, тест можно пройти позже в профиле."
            onBack={() => setStep('time')}
            footer={<Button label="Дальше" onPress={() => setStep('permissions')} />}
          />
        );
      }
      return (
        <StepScreen
          step={step}
          title="Тест уровня"
          subtitle="15–25 вопросов, около 10 минут. Вопросы подстраиваются под ответы: верно — следующий сложнее, ошибка — проще. Пройденные темы отмечу на пути, чтобы не повторять известное."
          onBack={() => setStep('time')}
          footer={
            <>
              <Button label="Пройти тест" icon="target" onPress={() => setStep('placement')} />
              <Button
                label="Пропустить и начать с первого урока"
                variant="ghost"
                onPress={() => setStep('permissions')}
              />
            </>
          }
        />
      );

    case 'placement':
      return (
        <PlacementRunner
          self={self ?? 'unknown'}
          onDone={() => setStep('permissions')}
          onCancel={() => setStep('test')}
        />
      );

    case 'permissions':
      return (
        <StepScreen
          step={step}
          title="Пара разрешений"
          subtitle="Оба необязательны — приложение работает и без них."
          footer={<Button label="Готово" loading={saving} onPress={() => void finish()} />}
        >
          <Card>
            <AppText variant="heading">Напоминания</AppText>
            <AppText variant="small">
              Одно мягкое напоминание в день в удобное время. Никаких тревожных сообщений;
              выключаются в настройках в два нажатия.
            </AppText>
            {notif ? (
              <AppText
                variant="smallStrong"
                color={notif === 'granted' ? 'success' : 'textMuted'}
                aria-live="polite"
              >
                {OUTCOME_LABEL[notif]}
              </AppText>
            ) : (
              <Button
                label="Разрешить уведомления"
                variant="secondary"
                compact
                onPress={async () => setNotif(await requestNotifications())}
              />
            )}
          </Card>
          <Card>
            <AppText variant="heading">Микрофон</AppText>
            <AppText variant="small">
              Нужен для заданий на говорение. Звук используется только во время задания и никуда не
              отправляется. Без микрофона можно отвечать текстом.
            </AppText>
            {mic ? (
              <AppText
                variant="smallStrong"
                color={mic === 'granted' ? 'success' : 'textMuted'}
                aria-live="polite"
              >
                {OUTCOME_LABEL[mic]}
              </AppText>
            ) : (
              <Button
                label="Разрешить микрофон"
                variant="secondary"
                compact
                onPress={async () => setMic(await requestMicrophone())}
              />
            )}
          </Card>
        </StepScreen>
      );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  spacer: { width: 48, height: 48 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  list: { gap: 10 },
  footer: { gap: 8, width: '100%', maxWidth: 560, alignSelf: 'center' },
});
