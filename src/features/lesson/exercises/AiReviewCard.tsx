/**
 * The optional AI review under a checked writing answer. It appears only when the learner has
 * saved their own API key, and sends the text only on an explicit button press.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getAiKey } from '@/core/checker/ai-key';
import {
  AI_ERROR_MESSAGE,
  AiReviewError,
  requestAiReview,
  type AiReview,
} from '@/core/checker/ai-review';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';

import { styles as common } from './common';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; review: AiReview }
  | { status: 'error'; message: string };

export function AiReviewCard({ task, text }: { task: string; text: string }) {
  const [hasKey, setHasKey] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    let alive = true;
    void getAiKey().then((k) => alive && setHasKey(!!k));
    return () => {
      alive = false;
    };
  }, []);

  if (!hasKey) return null;

  const run = async () => {
    setState({ status: 'loading' });
    try {
      const apiKey = await getAiKey();
      if (!apiKey) throw new AiReviewError('bad-key');
      setState({ status: 'done', review: await requestAiReview({ task, text, apiKey }) });
    } catch (e) {
      setState({
        status: 'error',
        message: AI_ERROR_MESSAGE[e instanceof AiReviewError ? e.code : 'network'],
      });
    }
  };

  return (
    <Card>
      <AppText variant="heading" role="heading">
        Разбор нейросетью
      </AppText>
      {state.status === 'idle' && (
        <View style={common.stack}>
          <AppText variant="caption" color="textMuted">
            Текст будет отправлен в Anthropic по вашему ключу.
          </AppText>
          <Button label="Проверить нейросетью" icon="star" compact onPress={() => void run()} />
        </View>
      )}
      {state.status === 'loading' && (
        <AppText variant="small" color="textMuted" aria-live="polite">
          Проверяю…
        </AppText>
      )}
      {state.status === 'error' && (
        <View style={common.stack}>
          <AppText variant="small" aria-live="polite">
            {state.message}
          </AppText>
          <Button label="Ещё раз" variant="ghost" compact onPress={() => void run()} />
        </View>
      )}
      {state.status === 'done' && (
        <View style={common.stack} aria-live="polite">
          <AppText variant="body">{state.review.summary}</AppText>
          {state.review.issues.map((issue, i) => (
            <AppText key={i} variant="small">
              «{issue.original}» → «{issue.fix}». {issue.why}
            </AppText>
          ))}
          {state.review.corrected.trim() !== '' && (
            <View>
              <AppText variant="smallStrong" color="textMuted">
                Исправленный вариант:
              </AppText>
              <AppText variant="bodyStrong">{state.review.corrected}</AppText>
            </View>
          )}
          <AppText variant="caption" color="textMuted">
            Нейросеть может ошибаться. Это подсказка, а не оценка.
          </AppText>
        </View>
      )}
    </Card>
  );
}
