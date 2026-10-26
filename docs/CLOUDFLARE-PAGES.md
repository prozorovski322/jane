# Публикация Jane на Cloudflare Pages

Проект можно подключить к Cloudflare Pages из репозитория GitHub:

- Production branch: `main`
- Build command: `npm run web:build && node scripts/web-cloudflare.mjs dist`
- Build output directory: `dist`
- Root directory: `/`
- Node.js: `24`

В **Settings → Environment variables** добавить для production и preview:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon ключ, он включается в клиентскую сборку)
- `EXPO_PUBLIC_AUTH_PROVIDERS` со значением `google,custom:yandex`

`functions/api/yandex-userinfo.js` публикует Pages Function по адресу
`https://<project>.pages.dev/api/yandex-userinfo`. Он вызывает тот же проверяющий обработчик,
который используется Netlify. `public/_routes.json` ограничивает вызов Function только этим
маршрутом, чтобы остальные файлы сайта обслуживались как статические ресурсы.
`scripts/web-cloudflare.mjs` удаляет Netlify-only SPA rewrite и обновляет canonical URL в crawler
metadata для адреса Pages; Cloudflare сам обслуживает SPA-маршруты из `index.html`.

## Включение после первой публикации

Пока не проверен новый адрес, сохранить Netlify как резерв. После успешной первой публикации:

1. Установить в Supabase Site URL на новый адрес и добавить его `/` и `/new-password` в Redirect URLs.
2. В custom OAuth provider Яндекса заменить Userinfo URL на
   `https://<project>.pages.dev/api/yandex-userinfo`.
3. Добавить новый адрес сайта в разрешённые origins Google OAuth client, если Google требует его.
4. Проверить регистрацию, вход Google и Яндекс, выход, восстановление пароля и возврат в курс.

После всех проверок можно решить, оставлять ли Netlify в качестве резервного хостинга.
