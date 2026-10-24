# Дополнительные способы входа в Jane

## Состояние на 24 октября 2026

- Почта и пароль опубликованы; владелец подтвердил успешный вход.
- Код и ссылка на почту опубликованы; владелец сохранил шаблон письма в Supabase.
  Полный вход этими способами пока не подтверждён владельцем.
- Google и Яндекс настроены; владелец подтвердил полный вход и возврат в Jane для обоих.
  В Production `EXPO_PUBLIC_AUTH_PROVIDERS=google,custom:yandex`.
- Отдельное приложение Jane в Яндекс ID создано владельцем: Client ID
  `6d6b261bc97b4f3eb5bc3e83ed05ccf8`. Supabase-провайдер сохранён владельцем.
- Владелец создал Web-приложение Jane в VK ID: `54849871`, callback
  `https://jane-english.netlify.app/.netlify/functions/vk-callback`.
  Серверные обработчики подготовлены; Supabase-провайдер и полный вход пока не проверены.
  Кнопка VK остаётся скрытой.
- Доступ агента к `supabase.com` ранее отклонён браузерным инструментом сохранённым правилом.
  После сообщения владельца об изменении разрешений повторная проверка также отклонена.
  Доступ к `id.vk.ru` отклонён политикой безопасности сайта. Не обходить эти правила другими
  браузерами, API, сессионными токенами или CDP для доступа к панелям управления.

Не включать кнопки провайдеров до проверки полного входа на тестовой сборке. Значения client
secret сохранять только в настройках серверного провайдера Supabase, не в `EXPO_PUBLIC_*`, git
или клиентском JavaScript.

## Google

1. В Google Cloud создать отдельное приложение OAuth для Jane (Web application). Не менять
   приложение другого продукта из того же аккаунта.
2. Настроить название Jane, контакт владельца, домашнюю страницу
   `https://jane-english.netlify.app` и политику
   `https://jane-english.netlify.app/privacy`. Владелец задаёт контактный адрес сам.
3. В Google-клиент добавить JavaScript origin `https://jane-english.netlify.app` и Redirect URI,
   который показывает **Supabase → Authentication → Sign In / Providers → Google**. Для
   выбранного проекта стандартный callback —
   `https://rfxzrleoebkipamwicrb.supabase.co/auth/v1/callback`.
4. Владелец создаёт/подтверждает учётные данные и переносит Client ID / Client Secret прямо в
   настройки Google-провайдера Supabase. Не присылать секрет в чат.
5. Убедиться, что приложение доступно всем нужным пользователям, а не только тестовым
   аккаунтам. Не запрашивать доступ к Gmail, контактам, диску и другим данным: нужны только
   `openid`, `email`, `profile`.
6. Проверить полный вход, выход и повторный вход. Только затем добавить `google` в
   `EXPO_PUBLIC_AUTH_PROVIDERS` и пересобрать сайт.

Официальная инструкция: https://supabase.com/docs/guides/auth/social-login/auth-google

## Яндекс ID

1. В `https://oauth.yandex.ru` создать отдельное приложение Jane. Достаточно имени и адреса
   почты пользователя. Не использовать уже существующее приложение другого продукта.
2. В Supabase создать Custom OAuth2 provider `custom:yandex`. Callback копировать из формы
   именно этого провайдера, затем зарегистрировать в Яндексе.
3. Настройки Manual OAuth2 в Supabase:
   - Authorization URL: `https://oauth.yandex.ru/authorize`
   - Token URL: `https://oauth.yandex.ru/token`
   - Userinfo URL: `https://jane-english.netlify.app/.netlify/functions/yandex-userinfo`
   - Scopes: `login:email,login:info`
   - Client ID: `6d6b261bc97b4f3eb5bc3e83ed05ccf8`
   - Client Secret владелец переносит из Яндекса непосредственно в Supabase.
   - PKCE включён. Allow users without email выключен.
   - Issuer URL: `https://oauth.yandex.ru` (поле обязательно в текущей форме Dashboard,
     но OAuth2 не использует OIDC discovery). JWKS оставить пустым: ID token здесь не используется.
4. `netlify/functions/yandex-userinfo.mjs` проверяет access token через фиксированный HTTPS API
   Яндекса и требует совпадения `client_id` с приложением Jane. Переводит `id` в `sub`,
   `default_email` в `email`, `real_name` в `name`. Ответ не кешируется; токены и сырые ошибки
   не выводятся. Адаптер не требует client secret или Supabase service-role key.
   Он не меняет state, PKCE, callback или обмен кода — ими управляет Supabase.
   Локальные проверки: `node --test scripts/tests/yandex-userinfo.test.mjs`.
   Полный вход через настоящий Supabase-провайдер ещё необходимо проверить, включая поведение
   подтверждения почты (`email_verified=false`) и существующие аккаунты.
5. Не выставлять вручную `email_verified=true` и не объединять аккаунты по неподтверждённой
   почте. Параметры PKCE выбирать по документации Яндекса; не отключать защиту наугад.
6. После успешной проверки добавить `custom:yandex` в переменную провайдеров и пересобрать сайт.

Официальные материалы:

- https://yandex.ru/dev/id/doc/ru/
- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://github.com/supabase/auth/blob/master/internal/api/provider/custom_oauth.go

## VK ID

Приложение Jane `54849871` создано владельцем. На экране настройки One Tap код копировать
в приложение не нужно: Jane использует перенаправление с PKCE через Supabase.

Настройки Supabase Custom Provider:

| Поле                      | Значение                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| Provider Identifier       | `vk` (форма сама добавляет `custom:`)                              |
| Display Name              | `VK ID`                                                            |
| Configuration Method      | Manual configuration / OAuth2                                      |
| Issuer URL                | `https://id.vk.ru`                                                 |
| Authorization URL         | `https://jane-english.netlify.app/.netlify/functions/vk-authorize` |
| Token URL                 | `https://jane-english.netlify.app/.netlify/functions/vk-token`     |
| Userinfo URL              | `https://jane-english.netlify.app/.netlify/functions/vk-userinfo`  |
| JWKS URI                  | пусто, ID token не используется                                    |
| Client ID                 | `54849871`                                                         |
| Client Secret             | владелец переносит защищённый ключ прямо из VK в Supabase          |
| Scopes                    | `email`                                                            |
| Allow users without email | выключено                                                          |

PKCE оставлять включённым. Callback в Supabase должен совпадать с
`https://rfxzrleoebkipamwicrb.supabase.co/auth/v1/callback`.
В VK зарегистрирован другой callback: `https://jane-english.netlify.app/.netlify/functions/vk-callback`.

Обработчики в `netlify/functions/vk-*.mjs` передают challenge/state от Supabase в VK, затем
упаковывают code/device_id/state в транспортный code для callback Supabase. Этот envelope не
считается подписанной идентичностью: Supabase проверяет state, VK проверяет одноразовый code и
исходный PKCE verifier. Обмен производится только на фиксированном адресе VK с фиксированным
client_id и callback. Ответный state от VK также должен совпадать.

VK поддерживает публичный обмен с PKCE (его SDK не передаёт client secret). Обработчик не
хранит и не передаёт client secret: секрет из формы Supabase не является способом проверки
запроса переходником; защиту обмена обеспечивает PKCE на стороне VK. Ни service-role key,
ни дополнительный серверный секрет не нужны. Refresh и ID tokens не возвращаются; user_info
проверяется отдельным запросом VK с access token и client_id приложения Jane. Возвращаются
только sub/email/name, `email_verified=false`. Телефон и дополнительные данные не запрашиваются.

Локальные проверки: `node --test scripts/tests/vk-oauth.test.mjs`.
Полный обмен с VK, подтверждение почты, существующий аккаунт и отмену нужно проверить вручную
после сохранения провайдера. До проверки не объявлять вход работающим и не включать кнопку VK.

Первичные источники:

- https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/auth.ts
- https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/types.ts
- https://github.com/VKCOM/vkid-web-sdk/blob/master/src/utils/url/url.ts

## Приёмка перед включением

Для каждого провайдера проверить новый и существующий аккаунт, отмену входа, выход, повторный
вход и восстановление прогресса. Не включать настройку автоматического объединения аккаунтов
по непроверенной почте. В коде перед переходом к провайдеру добавлен отдельный экран согласия
с политикой: вход через внешний сервис может сразу создать новый аккаунт. Без согласия
переход к провайдеру недоступен.

В Supabase выбран проект `rfxzrleoebkipamwicrb` (Jane), в Netlify — `jane-english` в команде
`prozorovski322`. На IAB может быть открыт другой Netlify-аккаунт; не настраивать его.
