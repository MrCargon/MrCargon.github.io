// DiscordProxyConfig.js — point the Contact form + Calendar module at the
// portfolio-discord-proxy Vercel deployment so messages/events land in Discord.
//
// Leave proxyUrl EMPTY to stay fully offline: the contact form still validates
// and shows an error state (not a fake success), and calendar events just
// don't get a Discord notification (the local-first store still works fine).
//
// ── SETUP ───────────────────────────────────────────────────────────────────
//   1. Deploy https://github.com/MrCargon/portfolio-discord-proxy to Vercel
//      (see that repo's README for the full walkthrough: create two Discord
//      webhooks, `vercel login`, `vercel`, set DISCORD_WEBHOOK_CONTACT /
//      DISCORD_WEBHOOK_CALENDAR as env vars, redeploy).
//   2. Copy the deployment URL Vercel gives you, e.g.
//        https://portfolio-discord-proxy.vercel.app
//   3. Paste it into proxyUrl below (NO trailing slash), commit, push.

window.MRCARGON_DISCORD_PROXY = {
    proxyUrl: ''   // ← e.g. 'https://portfolio-discord-proxy.vercel.app'
};
