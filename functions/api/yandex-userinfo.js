import yandexUserinfo from '../../netlify/functions/yandex-userinfo.mjs';

// Keep the provider profile validation shared between Netlify and Cloudflare Pages.
export function onRequest({ request }) {
  return yandexUserinfo(request);
}
