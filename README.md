# YouTube Music MCP

A self-hosted Model Context Protocol server for searching and organizing
YouTube Music.

It exposes 13 tools for Music-native discovery, lyrics, radio queues, charts,
personal playlists, and ratings. It does **not** claim remote player controls:
Google does not provide a supported API for YouTube Music's live player,
devices, volume, queue, or now-playing state.

## How it works

The project deliberately uses two narrowly scoped services:

| Component | Purpose | Upstream |
| --- | --- | --- |
| `discovery/` | Search, albums, artists, song metadata, lyrics, radio queues, charts | YouTube Music's web surface through `ytmusicapi` |
| `worker/` | MCP transport, authentication, playlist management, ratings | Cloudflare Workers and the official YouTube Data API v3 |

This keeps unofficial Music discovery separate from authenticated account
writes. Google OAuth credentials and refresh tokens never enter the discovery
service.

## Tools

| Tool | Description | Account access |
| --- | --- | --- |
| `ytmusic_search` | Search songs, videos, albums, artists, or playlists | No |
| `ytmusic_album` | Retrieve an album and compact track list | No |
| `ytmusic_artist` | Retrieve an artist, releases, and related artists | No |
| `ytmusic_song` | Retrieve song or music-video metadata | No |
| `ytmusic_lyrics` | Retrieve lyrics from a lyrics browse ID | No |
| `ytmusic_radio` | Build a radio/watch queue from a song | No |
| `ytmusic_charts` | Retrieve regional Music charts | No |
| `ytmusic_playlists` | List the connected account's playlists | Yes |
| `ytmusic_playlist_items` | List items in a playlist | Yes |
| `ytmusic_create_playlist` | Create a playlist, optionally with tracks | Yes |
| `ytmusic_add_to_playlist` | Add tracks to a playlist | Yes |
| `ytmusic_remove_from_playlist` | Remove an item from a playlist | Yes |
| `ytmusic_rate` | Like, dislike, or clear a rating | Yes |

## Requirements

- Python 3.10 or newer
- Node.js 20 or newer
- A Cloudflare account for the MCP worker
- A publicly reachable HTTPS route to the discovery service
- A Google Cloud project with YouTube Data API v3 enabled
- A Web application OAuth client for account-specific tools

## 1. Run the discovery service

```bash
cd discovery
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
export YTMUSIC_DISCOVERY_TOKEN="$(openssl rand -hex 32)"
.venv/bin/python server.py
```

The service binds to `127.0.0.1:8773` by default. Put it behind an HTTPS
reverse proxy or private tunnel, preserve the `Authorization` header, and do
not expose the port directly. A hardened systemd template is included.

Verify it locally:

```bash
curl http://127.0.0.1:8773/health
```

## 2. Configure Google OAuth

In Google Cloud Console:

1. Enable YouTube Data API v3.
2. Configure the OAuth consent screen.
3. Create a **Web application** OAuth client.
4. Add `https://YOUR-WORKER.example/callback` as an authorized redirect URI.

The worker requests only `youtube.force-ssl`, which is required for playlist
and rating operations.

## 3. Configure the Worker

Install dependencies and create a KV namespace:

```bash
cd worker
npm install
npx wrangler kv namespace create YOUTUBE_MUSIC_TOKENS
```

Copy the returned namespace ID into `worker/wrangler.toml` by uncommenting the
`[[kv_namespaces]]` block. Then set the required secrets:

```bash
npx wrangler secret put MCP_API_KEY
npx wrangler secret put YOUTUBE_DISCOVERY_KEY
npx wrangler secret put DISCOVERY_URL
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

`YOUTUBE_DISCOVERY_KEY` must equal the discovery service's
`YTMUSIC_DISCOVERY_TOKEN`. `DISCOVERY_URL` is the public HTTPS base URL of the
discovery service, without a trailing slash.

Deploy and complete OAuth once:

```bash
npm run deploy
```

Open `https://YOUR-WORKER.example/auth?k=YOUR_MCP_API_KEY`, approve Google
access, and verify `/health` reports `authenticated`.

## 4. Connect an MCP client

The primary endpoint is streamable HTTP:

```text
https://YOUR-WORKER.example/mcp?k=YOUR_MCP_API_KEY
```

An SSE discovery endpoint is also available:

```text
https://YOUR-WORKER.example/sse?k=YOUR_MCP_API_KEY
```

Prefer an `Authorization: Bearer ...` header whenever the client supports it;
query-string keys can appear in browser history and intermediary logs.

## Security

The MCP, OAuth start route, discovery service, and token-broker interface fail
closed when their keys are absent. OAuth uses short-lived state values stored
in KV. Read [SECURITY.md](SECURITY.md) before exposing either service.

## Credit and upstream

Music-native discovery is powered by
[`sigma67/ytmusicapi`](https://github.com/sigma67/ytmusicapi), an unofficial
Python client for YouTube Music maintained by Simon Brazell (`sigma67`) and its
contributors. This project would not have the Music-specific discovery surface
without their work. `ytmusicapi` is distributed under the MIT License; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This project is not affiliated with, endorsed by, or sponsored by Google,
YouTube, YouTube Music, or the `ytmusicapi` maintainers.

## License

This project is released under the [MIT License](LICENSE). Third-party
components retain their own copyrights and licenses.
