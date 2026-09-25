# YouTube Music MCP

Private Cloudflare Worker exposing the supported YouTube Data API surface to
Nexus Gateway. It manages YouTube/YouTube Music playlists and ratings because
both products share those resources.

It deliberately does **not** advertise live playback, queue, volume, device,
or listening-history controls. Google provides no supported YouTube Music API
for those operations.

## Tools

- `ytmusic_search`
- `ytmusic_album`, `ytmusic_artist`, `ytmusic_song`, `ytmusic_lyrics`
- `ytmusic_radio`, `ytmusic_charts`
- `ytmusic_playlists`
- `ytmusic_playlist_items`
- `ytmusic_create_playlist`
- `ytmusic_add_to_playlist`
- `ytmusic_remove_from_playlist`
- `ytmusic_rate`

## Setup

1. Enable YouTube Data API v3 in the Google Cloud project already used by
   `biometrics-cloud`.
2. Store the same generated `YOUTUBE_BROKER_KEY` on this worker and
   `biometrics-cloud`; also set this worker's `MCP_API_KEY`.
3. Open `/auth?k=<MCP_API_KEY>` once and approve the expanded Google consent.

Google credentials and refresh tokens remain in `biometrics-cloud`; this worker
receives only short-lived access tokens over a bearer-gated Worker service
binding. The MCP endpoints fail closed and accept the service bearer used by
Nexus Gateway.
