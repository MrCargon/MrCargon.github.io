// PresenceConfig.js — enable REAL cross-internet "who's online" presence on the globe.
//
// Leave databaseURL EMPTY to stay on the zero-backend Demo mode (seeded world roster).
// Demo mode makes NO network calls: "Share my location" stays on this device.
// Paste your free Firebase Realtime Database URL to switch on real presence. Either way
// nothing breaks — the app falls back to Demo on empty/invalid config.
//
// ── SETUP (≈5 min · Spark plan · free-forever · NO credit card) ───────────────────────
//   1. https://console.firebase.google.com  →  Add project (any name, disable Analytics).
//   2. Build → Authentication → Sign-in method → enable **Anonymous**.
//   3. Build → Realtime Database → Create Database → pick a location → Start in LOCKED mode,
//      then paste the RULES below (never leave the DB in test mode: test mode = anyone writes).
//   4. Copy the database URL shown at the top, e.g.
//        https://YOURPROJECT-default-rtdb.firebaseio.com
//      (region DBs look like  https://YOURPROJECT-default-rtdb.europe-west1.firebasedatabase.app )
//      and the Web API key (Project settings → General). Paste them into databaseURL and
//      apiKey below, commit, push. Without apiKey the globe can SHOW others but never shares.
//
// ── SECURITY RULES  (Realtime Database → Rules) — R3 #12, 2026-11-19 ──────────────────
//   Public read of the presence list; a signed-in (anonymous) visitor may write ONLY the
//   node keyed by their own uid; every field is type/range checked; nothing else is
//   accepted; the rest of the DB stays locked. Mirrored offline by tests/verify-presence-rules.cjs
//   (keep the two in step).
//     {
//       "rules": {
//         ".read": false, ".write": false,
//         "presence": {
//           ".read": true,
//           "$id": {
//             ".write": "auth != null && ($id === auth.uid || (!newData.exists() && data.exists() && data.child('ts').val() < now - 300000))",
//             ".validate": "$id.matches(/^[A-Za-z0-9]+$/) && $id.length >= 20 && $id.length <= 128 && newData.hasChildren(['id','lat','lng','ts'])",
//             "id":   { ".validate": "newData.val() === $id" },
//             "lat":  { ".validate": "newData.isNumber() && newData.val() >= -90 && newData.val() <= 90" },
//             "lng":  { ".validate": "newData.isNumber() && newData.val() >= -180 && newData.val() <= 180" },
//             "ts":   { ".validate": "newData.isNumber() && newData.val() >= now - 60000 && newData.val() <= now + 60000" },
//             "name": { ".validate": "newData.isString() && newData.val().length <= 20" },
//             "$other": { ".validate": false }
//           }
//         }
//       }
//     }
//
//   ID ↔ UID MAPPING. The page's own id ('me-' + 7 base-36 chars, Presence.selfId) is a
//   per-load handle used by Demo / BroadcastChannel and for the local "You" pin. It is NOT
//   what Firebase sees: in Firebase mode the adapter signs in anonymously (REST, on the
//   first "Share my location" only — viewers never get an account) and keys its record by
//   the Firebase uid, so the rule is simply $id === auth.uid and the record's id field ==
//   the key. Others cannot overwrite or delete a live record because they cannot get that
//   uid's token. 'name' may be absent; the client sends 'You' (≤ 20 chars) and PresencePins
//   never puts it in the DOM.
//
//   STALE RECORDS. The REST adapter has no socket, so there is no SDK onDisconnect().remove().
//   Its REST equivalents: (a) a DELETE on stop / disable, (b) a keepalive DELETE on
//   pagehide (tab close, navigation), (c) every signed-in sharer deletes records whose ts
//   is over 5 min old (the second .write branch above allows exactly that, nothing more),
//   and (d) all clients hide records older than 75 s. A record from a hard crash with no
//   sharer online can therefore outlive its owner until the next sharer comes along.
//   Server-side option if that matters: a scheduled Cloud Function (needs the Blaze plan)
//   that deletes presence/* with ts < now - 5 min, or switch the adapter to the Firebase
//   JS SDK and call ref.onDisconnect().remove() right after each write.
//
//   Still open by design: anyone can create many anonymous accounts, each writing one
//   node. Turn on App Check + the Auth sign-up quota if this is ever abused.
//
// ── FREE-TIER HEADROOM ────────────────────────────────────────────────────────────────
//   Spark RTDB: 100 simultaneous connections, 1 GB stored, 10 GB/month down. This adapter
//   polls a tiny JSON every ~6 s and writes one small node per sharer — a portfolio will
//   never come close. Presence is opt-in and coarse by design (see Presence.js privacy note).

window.MRCARGON_FIREBASE = {
    databaseURL: '',        // ← Realtime Database URL — enables live GLOBE PRESENCE
    path: 'presence',       // DB node the roster lives under (rules above match this)
    apiKey: '',             // ← Firebase Web API key — needed to SHARE (anonymous sign-in);
                            //   without it presence is view-only. Public client id, not a secret.
    projectId: ''           // ← Firebase projectId — enables CALENDAR cross-device sync
                            //   (Firestore REST). Set a personal "sync code" in the Calendar
                            //   header once this is filled. Firestore rules: allow read/write
                            //   on /calendars/{code}/events for a personal tool (test mode ok).
};
