# Underground 🕳️

A 1-to-1 Discord clone with real-time chat and **offline support**. Full-stack recreation of the Discord interface and experience.

## Features

- Discord-style UI (8 themes: Dark, Light, AMOLED, Midnight, Forest, Ocean, Sunset, Candy): server rail, channel sidebar, chat, member list, user panel
- Real-time messaging via WebSocket (Socket.IO) — messages appear instantly across clients
- **Offline mode** — keep reading, browsing and sending while disconnected; everything you do is stored locally and actually syncs to the server when you reconnect (pending items are shown with an indicator)
- Servers, text channels, voice channels, and DMs — create your own
- **Rich markdown:** `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `||spoilers||`, blockquotes, code blocks with language labels, ordered/unordered lists, `@mentions` (with autocomplete), embedded image links
- **Pinned messages** + a pinned drawer with jump-to-message
- **Channel search** with a results panel
- **Friend system** — add by email or from a profile, incoming/outgoing/pending tabs, accept/decline/cancel, friends page
- **Server invites** — generate an invite code, or join a server by pasting a code
- **Roles** — servers have an owner and admins; the member list groups people by role (Owner / Admin / custom roles / Members)
- **Server settings (owner/admin)** — click the server name in the sidebar → **Server Settings** for a Discord-style admin panel: edit the server name/icon/description/banner, create/edit/delete **custom roles** with colors, assign roles to members, promote/demote admins, kick members, rename/reorder/delete channels, list & revoke invites, add/remove **custom emoji**, ban/unban members, or delete the server (Danger Zone)
- **Custom emoji** — servers can define their own emoji (emoji or image/clip); use them in the emoji picker, type `:name:` inline in messages, and react with them
- **Infinite scroll** — chat auto-loads older messages as you scroll to the top (channels and DMs)
- **Voice channels** — join/leave, live connected-user counts, speaking indicators, "voice connected" panel
- **Profile popouts** — click any avatar or name to see a user's themed profile (custom profile background, themed name color, glow), bio, pronouns, banner, status, and Message / Add Friend actions; click **your own avatar** in the bottom-left user panel for your full profile with an Edit Profile shortcut
- **Context menu** — right-click any message for Copy / Reply / Pin / Edit / Delete
- **Emoji picker** (searchable) + quick-reaction bar
- **Replies** with quoted context and a replying bar
- **Attachments** — upload a file (image preview or download card, up to 4 MB)
- **User settings** — light/dark appearance, avatar color, username, custom status
- **Deep customization (appearance)** — 8 built-in themes (Dark, Light, AMOLED, Midnight, Forest, Ocean, Sunset, Candy), a custom accent color picker with preset swatches, message density (Cozy / Compact), adjustable font size, chat background gradients (Aurora / Ocean / Sunset / Neon), and a Reduce-motion toggle — everything applies instantly with no reload
- **Profile customization** — gradient avatar backgrounds, emoji avatars, profile banner gradients, a bio, pronouns, **profile card themes** (Royal, Sunset, Ocean, Forest, Gold, Candy, Neon, Ash — recolors the whole profile popout including the name and a matching glow), and **avatar decorations** (emoji overlays like a crown, headphones or rockets, colored rings, and auras)
- **Custom media uploads** — upload your own **avatar picture or a short looping clip** (images auto-resized, MP4/WebM clips up to 10 seconds) in My Account, and custom **server icon images/clips** when creating a server; they show up in message avatars, member lists, profiles and the server rail
- **Notification sounds** — ping on @mentions (WebAudio, no assets needed), browser notifications when the tab is hidden
- Typing indicators, emoji reactions, message edit + delete
- Online presence / status (online, idle, dnd) with presence dots
- Unread indicators per channel/DM
- Account registration + login (token auth, salted password hashes)
- **Auto re-auth** — if your session is ever invalidated (server restart, data reset, logout elsewhere), the app signs you out gracefully to the login screen instead of showing "Not authenticated" errors on button clicks; login sessions are written to disk immediately so they survive server restarts
- **Performance/scalability layer** — gzip compression on JSON API responses (media exempt), per-IP rate limiting on mutating endpoints (200/min → 429), 7-day immutable static asset caching, and Socket.IO compression (`perMessageDeflate`) to cut payload size and latency under load
- JSON-file persistence (no database required)

## Stack

- **Client:** React 18 + Vite
- **Server:** Node.js + Express + Socket.IO
- **Storage:** JSON files under `server/data/`

## Getting started (local)

Requires Node.js 18+.

```bash
npm install             # root (concurrently)
npm run install:all     # install server + client deps
npm run dev             # dev servers: API :4000 + Vite :5173
```

Open http://localhost:5173

Prefer the one-URL production build? `npm run build && npm start` and open http://localhost:4000 — the server serves the UI, API, and websockets all from one address.

> On Windows PowerShell, npm scripts are run via `npm.cmd` internally, so no
> execution-policy changes are needed.

## Go live — no commands needed on your machine

The whole app (UI + chat backend) is one service, so a single deploy hosts everything.

**Easiest — Deploy to Render (free, supports WebSockets):**

1. Put this folder in a GitHub repo (e.g. `genizymath/underground`) and push it.
2. Go to https://render.com → **New** → **Blueprint** → point it at the repo.
   Render reads `render.yaml` (build + start commands already configured) — no config needed.
3. Wait ~2 minutes. You get a live URL like `https://underground.onrender.com`.
4. (Optional) On the service page set **Auto-Deploy** so every push updates the site.

Once deployed you just open the URL — nothing runs on your computer. Note: Render's free tier pauses the service after ~15 minutes of inactivity; the first visit after that takes a few seconds to wake up.

Alternatives with the same repo: Railway (`railway up` / GitHub deploy) or any host that supports Node + WebSockets. A `Dockerfile` is included for container-based hosts.

## Demo accounts

| Username | Email            | Password      |
| -------- | ---------------- | ------------- |
| Alice    | alice@demo.dev   | password123   |
| Bob      | bob@demo.dev     | password123   |
| Carol    | carol@demo.dev   | password123   |
| Dave     | dave@demo.dev    | password123   |
| Erin     | erin@demo.dev    | password123   |

Try it: log in with Alice in one browser and Bob in another to see real-time chat.

## How offline sync works

- Your sessions, servers, DMs, messages and presence are cached in the browser (localStorage).
- Go offline (wifi off, server down, whatever): you can still open the app, browse and send. Messages you send and reactions/edits/deletes you make are applied instantly **and queued** in an outbox.
- Reconnect: the outbox flushes in order, the server acknowledges each change, and your pending items become real messages (a green "syncing" bar shows while this happens).
- Login/registration still needs a connection; once you're logged in once, everything else works offline.

## Scripts

```bash
npm run dev        # server + client together
npm run server     # backend only (http://localhost:4000)
npm run client     # frontend only (http://localhost:5173)
npm run build      # build the UI
npm run start      # production server (UI + API + websockets on :4000)
```

## API overview

- `POST /api/register` · `POST /api/login` · `POST /api/logout` · `GET /api/me`
- `PATCH /api/me` (username, status, custom status, color)
- `GET /api/servers` (includes roles + admin flag) · `POST /api/servers` · `POST /api/servers/:id/channels` (text or voice)
- `PATCH /api/servers/:id` (name, icon, description, banner) · `DELETE /api/servers/:id` (owner only)
- Roles: `GET|POST /api/servers/:id/roles` · `PATCH|DELETE /api/servers/:id/roles/:rid`
- Members: `PATCH /api/servers/:id/members/:uid/role` · `POST /api/servers/:id/members/:uid/kick|admin`
- Channels: `PATCH|DELETE /api/servers/:id/channels/:cid` · `POST /api/servers/:id/channels/:cid/move`
- Invites: `GET /api/servers/:id/invites` · `DELETE /api/servers/:id/invites/:code`
- Emoji: `POST /api/servers/:id/emoji` · `DELETE /api/servers/:id/emoji/:eid`
- Bans: `GET|POST /api/servers/:id/bans` · `DELETE /api/servers/:id/bans/:uid`
- `POST /api/servers/:id/join|leave` · `POST /api/servers/:id/invite`
- `GET /api/invites/:code` · `POST /api/invites/:code/join`
- `GET /api/channels/:id/messages?before=&limit=` · `GET /api/channels/:id/pins` · `GET /api/channels/:id/search?q=&author=`
- `GET /api/friends` · `POST /api/friends/request` (by email or userId) · `POST /api/friends/:id/accept|decline|remove`
- `GET /api/dms` · `POST /api/dms` · `GET /api/dm/:id/messages?before=&limit=`
- `GET /api/users?query=` 

Real-time events (`/socket.io`): `chat:message`, `chat:ack`, `chat:edit`,
`chat:delete`, `react`, `typing`, `typing:clear`, `presence`, `pin:update`,
`voice:state`, `voice:speaking`, `server:created`, `server:membership`,
`server:joined`, `server:updated`, `server:deleted`, `server:kicked`,
`friendship:update`. Server settings changes (name, icon, description, banner,
roles, members, channels, invites, emoji, bans) are broadcast as
`server:updated`; kicked/banned members also receive `server:kicked`.

## Deploy files

- `render.yaml` — Render Blueprint (free web service, health check included)
- `Dockerfile` + `.dockerignore` — container build for Railway, Fly.io, etc.
