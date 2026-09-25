# YouTube Music discovery facade

Local, bearer-gated facade over [`ytmusicapi`](https://github.com/sigma67/ytmusicapi).
It supplies Music-native public discovery to `youtube-music-cloud`: filtered
search, albums, artists, song metadata, lyrics, radio queues, and charts.

Account writes remain on the supported YouTube Data API path. This service does
not store Google cookies or OAuth tokens.
