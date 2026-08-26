// DiscordProxyConfig.js — where the Contact form sends messages.
//
// TWO DELIVERY PATHS, in priority order:
//
//   1. proxyUrl set   → POSTs to the Vercel proxy, which forwards to a Discord
//                       webhook. Silent, no mail client, best experience.
//   2. proxyUrl empty → falls back to a mailto: link with the message pre-filled.
//                       Needs no account, no deployment and no keys, and works
//                       today. This is why the form is testable right now.
//
// The fallback exists because the form was previously a dead end: with no proxy
// configured every submission failed with "not configured", so a real visitor
// filling it in got an error and their message went nowhere. A contact form that
// cannot deliver is worse than no contact form.
//
// The webhook URL is deliberately NOT in this file. Putting a Discord webhook in
// client-side code on a public GitHub Pages site lets anyone read it out of the
// page source and spam the server. The proxy exists precisely to keep the webhook
// server-side.
//
// ── UPGRADING TO DISCORD ────────────────────────────────────────────────────
//   1. Deploy https://github.com/MrCargon/portfolio-discord-proxy to Vercel
//      (create two Discord webhooks, `vercel login`, `vercel`, set
//      DISCORD_WEBHOOK_CONTACT / DISCORD_WEBHOOK_CALENDAR as env vars, redeploy).
//   2. Paste the deployment URL into proxyUrl below (NO trailing slash).
//   3. Commit and push. The mailto fallback switches itself off automatically.

window.MRCARGON_DISCORD_PROXY = {
    // e.g. 'https://portfolio-discord-proxy.vercel.app'
    proxyUrl: '',

    // Used by the mailto fallback while proxyUrl is empty. Safe to publish: it is
    // already the public contact address, and mailto exposes nothing a visitor
    // could abuse the way a raw webhook would.
    contactEmail: 'andrejs.koladenko.3dprint@gmail.com'
};
