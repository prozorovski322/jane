import { useEffect, useState } from 'react';

import { aiKeySupported, clearAiKey, getAiKey, setAiKey } from '@/core/checker/ai-key';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { SubScreen } from '@/ui/components/SubScreen';
import { TextField } from '@/ui/components/TextField';

type State = 'loading' | 'unsupported' | 'empty' | 'saved';

/** Where the learner turns the optional AI review of writing on or off. Off by default. */
export function AiReviewSettingsScreen() {
  const [state, setState] = useState<State>('loading');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supported = await aiKeySupported();
      const key = supported ? await getAiKey() : null;
      if (alive) setState(!supported ? 'unsupported' : key ? 'saved' : 'empty');
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    const ok = await setAiKey(value);
    if (ok) {
      setValue('');
      setMessage(null);
      setState('saved');
    } else setMessage('Не удалось сохранить ключ на этом устройстве.');
  };

  return (
    <SubScreen title="Проверка письма нейросетью">
      <Card>
        <AppText variant="body">
          Обычная проверка письменных заданий работает без интернета и всегда включена.
          Дополнительно можно разобрать свой текст нейросетью: она найдёт ошибки и объяснит их
          по-русски.
        </AppText>
        <AppText variant="small" color="textMuted">
          Это необязательно и выключено по умолчанию. Нужен ваш собственный ключ Anthropic API.
          Текст отправляется в Anthropic только тогда, когда вы сами нажимаете «Проверить
          нейросетью»; ключ хранится в защищённом хранилище телефона и не попадает ни в резервную
          копию, ни в журналы. Запросы оплачиваются с вашего ключа.
        </AppText>
      </Card>

      {state === 'unsupported' && (
        <AppText variant="small" color="textMuted">
          На этом устройстве нет защищённого хранилища, поэтому функция недоступна.
        </AppText>
      )}

      {state === 'empty' && (
        <>
          <TextField
            label="Ключ API"
            placeholder="sk-ant-…"
            value={value}
            secureTextEntry
            autoComplete="off"
            onChangeText={setValue}
          />
          <Button
            label="Сохранить ключ"
            disabled={value.trim().length < 20}
            onPress={() => void save()}
          />
        </>
      )}

      {state === 'saved' && (
        <>
          <AppText variant="bodyStrong" color="success" aria-live="polite">
            Проверка нейросетью включена
          </AppText>
          <Button
            label="Удалить ключ и выключить"
            variant="secondary"
            onPress={() => {
              void clearAiKey().then(() => setState('empty'));
            }}
          />
        </>
      )}

      {message && (
        <AppText variant="small" color="error" aria-live="polite">
          {message}
        </AppText>
      )}
    </SubScreen>
  );
}
