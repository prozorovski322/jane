// The public home page receives Supabase's existing root callbacks. Preserve
// their query/fragment and let the existing auth client complete the exchange.
// Never inspect, store, or log credentials here, and never accept a redirect URL.
(function () {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (
    query.has('code') ||
    query.has('error') ||
    fragment.has('access_token') ||
    fragment.has('error')
  ) {
    window.location.replace('/auth' + window.location.search + window.location.hash);
  }
})();
