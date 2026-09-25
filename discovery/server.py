#!/usr/bin/env python3
"""Small authenticated HTTP facade around ytmusicapi's public Music surface."""

from __future__ import annotations

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from ytmusicapi import YTMusic

HOST = os.environ.get("YTMUSIC_DISCOVERY_HOST", "127.0.0.1")
PORT = int(os.environ.get("YTMUSIC_DISCOVERY_PORT", "8773"))
AUTH_TOKEN = os.environ.get("YTMUSIC_DISCOVERY_TOKEN", "")
MAX_BODY = 32_768
ytmusic = YTMusic()


def bounded_int(value: Any, default: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(maximum, parsed))


def required_text(value: Any, field: str, maximum: int = 500) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} is required")
    value = value.strip()
    if len(value) > maximum:
        raise ValueError(f"{field} is too long")
    return value


def compact(value: Any, depth: int = 0) -> Any:
    """Remove playback secrets/noise and cap unexpectedly large responses."""
    if depth > 7:
        return None
    if isinstance(value, dict):
        blocked = {
            "streamingData", "playbackTracking", "playerConfig", "storyboards",
            "attestation", "frameworkUpdates", "responseContext", "trackingParams",
        }
        return {key: compact(item, depth + 1) for key, item in value.items() if key not in blocked}
    if isinstance(value, list):
        return [compact(item, depth + 1) for item in value[:100]]
    if isinstance(value, str) and len(value) > 8_000:
        return value[:8_000] + "…"
    return value


class Handler(BaseHTTPRequestHandler):
    server_version = "WonderlandYTMusic/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"ytmusic-discovery: {self.address_string()} {fmt % args}", flush=True)

    def reply(self, status: int, value: Any) -> None:
        payload = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def authorized(self) -> bool:
        supplied = self.headers.get("Authorization", "")
        if supplied.startswith("Bearer "):
            supplied = supplied[7:].strip()
        return bool(AUTH_TOKEN and supplied and hmac.compare_digest(supplied, AUTH_TOKEN))

    def input(self) -> dict[str, Any]:
        size = int(self.headers.get("Content-Length", "0"))
        if size > MAX_BODY:
            raise ValueError("request is too large")
        value = json.loads(self.rfile.read(size) or b"{}")
        if not isinstance(value, dict):
            raise ValueError("JSON body must be an object")
        return value

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self.reply(200, {"status": "ok", "authenticated": False, "library": "ytmusicapi"})
            return
        self.reply(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self.authorized():
            self.reply(401, {"error": "unauthorized"})
            return
        try:
            args = self.input()
            if self.path == "/search":
                query = required_text(args.get("query"), "query")
                limit = bounded_int(args.get("limit"), 10, 25)
                filter_name = args.get("filter")
                allowed = {None, "songs", "videos", "albums", "artists", "playlists", "community_playlists", "featured_playlists", "podcasts", "episodes", "profiles"}
                if filter_name not in allowed:
                    raise ValueError("invalid search filter")
                # YouTube Music sometimes returns a full shelf despite the
                # requested limit, so enforce it again before sending output.
                result = ytmusic.search(query, filter=filter_name, limit=limit)[:limit]
            elif self.path == "/album":
                result = ytmusic.get_album(required_text(args.get("browse_id"), "browse_id", 128))
            elif self.path == "/artist":
                result = ytmusic.get_artist(required_text(args.get("channel_id"), "channel_id", 128))
            elif self.path == "/song":
                result = ytmusic.get_song(required_text(args.get("video_id"), "video_id", 64))
            elif self.path == "/lyrics":
                result = ytmusic.get_lyrics(required_text(args.get("browse_id"), "browse_id", 128))
            elif self.path == "/radio":
                result = ytmusic.get_watch_playlist(
                    videoId=required_text(args.get("video_id"), "video_id", 64),
                    playlistId=args.get("playlist_id"),
                    limit=bounded_int(args.get("limit"), 25, 50),
                    radio=True,
                )
            elif self.path == "/charts":
                country = required_text(args.get("country", "PH"), "country", 2).upper()
                result = ytmusic.get_charts(country=country)
            else:
                self.reply(404, {"error": "not found"})
                return
            self.reply(200, compact(result))
        except ValueError as error:
            self.reply(400, {"error": str(error)})
        except Exception as error:  # ytmusicapi maps upstream errors inconsistently
            print(f"ytmusic-discovery error: {type(error).__name__}: {error}", flush=True)
            self.reply(502, {"error": "YouTube Music did not answer this request"})


if __name__ == "__main__":
    if not AUTH_TOKEN:
        raise SystemExit("YTMUSIC_DISCOVERY_TOKEN must be set")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
