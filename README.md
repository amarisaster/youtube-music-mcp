# YouTube Music MCP

A private-by-default hybrid MCP for YouTube Music:

- `worker/` is the authenticated Cloudflare MCP facade and supported YouTube
  Data API path for personal playlists and ratings.
- `discovery/` uses [`ytmusicapi`](https://github.com/sigma67/ytmusicapi) for
  Music-native search, albums, artists, lyrics, radio queues, and charts.

The split is deliberate. Google does not publish an official YouTube Music
playback API. Account writes use the supported YouTube Data API, while public
Music discovery uses the well-established unofficial web-client library.

## MCP tools

- `ytmusic_search`
- `ytmusic_album`
- `ytmusic_artist`
- `ytmusic_song`
- `ytmusic_lyrics`
- `ytmusic_radio`
- `ytmusic_charts`
- `ytmusic_playlists`
- `ytmusic_playlist_items`
- `ytmusic_create_playlist`
- `ytmusic_add_to_playlist`
- `ytmusic_remove_from_playlist`
- `ytmusic_rate`

The service intentionally does not claim live player, device, volume, queue,
or now-playing control. YouTube Music does not expose those controls through a
supported remote API.
