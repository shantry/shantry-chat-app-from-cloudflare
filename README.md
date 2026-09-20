# shat.

a little space for a good conversation, built on cloudflare workers, durable objects, and partyserver.

- named public rooms appear on the home screen; the directory refreshes every 10 seconds.
- private rooms are unlisted and use randomly generated invite ids. anyone with the link or id can join and read the history; they are not password-protected.
- display names and light/dark preferences are saved in the current browser. names are display labels, not verified accounts.
- conversations persist in each room’s sqlite durable object. the latest 200 messages load when joining.
- lowercase branding, responsive layouts, room search, and copyable invites.

## develop

```sh
npm ci
npm run dev
```

## verify

```sh
npm run check
```

this checks both typescript projects and performs a cloudflare deployment dry run. with the local server running on port 8787, run the integration checks:

```sh
npm run test:smoke
```

these create local test rooms and check directory privacy, invite lookup, invalid requests, two-client messaging, safe quote handling, duplicate message protection, history, and room isolation. set `TEST_URL` only to another test environment if needed.

## deploy to cloudflare

```sh
npm run deploy
```

the existing worker name and `Chat` binding are retained. the additive `v2` migration creates the `RoomDirectory` durable object; the existing `v1` chat migration remains intact. wrangler still builds the react bundle and deploys static assets alongside the worker. no separate hosting service or database is required.

rooms created with this version have `/room/:id` links and directory metadata. old `/:id` links redirect to that route, but rooms from the original template without directory metadata are not registered automatically. their stored message data is retained.
