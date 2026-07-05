// PresenceConfig.js — enable REAL cross-internet "who's online" presence on the globe.
//
// Leave databaseURL EMPTY to stay on the zero-backend Demo mode (seeded world roster).
// Paste your free Firebase Realtime Database URL to switch on real presence. Either way
// nothing breaks — the app falls back to Demo on empty/invalid config.
//
// ── SETUP (≈5 min · Spark plan · free-forever · NO credit card) ───────────────────────
//   1. https://console.firebase.google.com  →  Add project (any name, disable Analytics).
//   2. Build → Realtime Database → Create Database → pick a location → Start in test mode.
//   3. Copy the database URL shown at the top, e.g.
//        https://YOURPROJECT-default-rtdb.firebaseio.com
//      (region DBs look like  https://YOURPROJECT-default-rtdb.europe-west1.firebasedatabase.app )
//   4. Paste it into databaseURL below, commit, push. Done.
//
// ── RECOMMENDED SECURITY RULES  (Realtime Database → Rules) ───────────────────────────
//   Public read of the presence list, each visitor may only touch their own node,
//   and the rest of the DB stays locked. Records are coarse (~11 km), ephemeral, TTL-pruned.
//     {
//       "rules": {
//         ".read": false, ".write": false,
//         "presence": {
//           ".read": true,
//           "$id": {
//             ".write": true,
//             ".validate": "newData.hasChildren(['lat','lng','ts'])"
//           }
//         }
//       }
//     }
//
// ── FREE-TIER HEADROOM ────────────────────────────────────────────────────────────────
//   Spark RTDB: 100 simultaneous connections, 1 GB stored, 10 GB/month down. This adapter
//   polls a tiny JSON every ~6 s and writes one small node per sharer — a portfolio will
//   never come close. Presence is opt-in and coarse by design (see Presence.js privacy note).

window.MRCARGON_FIREBASE = {
    databaseURL: '',        // ← paste your Realtime Database URL here to go live
    path: 'presence'        // DB node the roster lives under (rules above match this)
};
