# Security Policy

## Supported versions

Security fixes are applied to the latest commit on `main`. This project has not
yet reached a stable-version release series.

## Reporting a vulnerability

Please do not disclose credentials, tokens, private playlist data, or a working
exploit in a public issue.

Use GitHub's **Security → Report a vulnerability** flow when private
vulnerability reporting is available. Otherwise, contact the repository owner
privately and include only the minimum information needed to reproduce the
problem. Public issues are appropriate for non-sensitive hardening suggestions.

Expected initial response time is seven days. A report should include the
affected component, impact, reproduction conditions, and whether any secret or
personal data may have been exposed.

## Trust boundaries

This repository contains two services with different privileges:

- The discovery service has no Google credentials. It calls the unofficial
  YouTube Music web surface through `ytmusicapi` and must be treated as an
  untrusted-upstream parser.
- The Cloudflare Worker holds the MCP service key, Google OAuth client secret,
  refresh token, and discovery-service key. Compromise of the Worker or its KV
  namespace can permit playlist changes and ratings on the connected account.

Never give the discovery service access to Google OAuth credentials, browser
cookies, or the Worker's KV namespace.

## Required deployment controls

### MCP authentication

- Generate `MCP_API_KEY` with at least 256 bits of randomness.
- Prefer `Authorization: Bearer` over `?k=`. Query parameters may be recorded in
  browser history, access logs, screenshots, and proxy telemetry.
- Do not reuse the MCP key for the discovery service, Google token broker, or
  unrelated applications.
- Rotate the key after accidental disclosure and update every downstream MCP
  client immediately.

### Discovery service

- Set a random `YTMUSIC_DISCOVERY_TOKEN`; the service refuses to start without
  it and compares bearer tokens with `hmac.compare_digest`.
- Bind to loopback and publish it only through an authenticated HTTPS reverse
  proxy or tunnel that preserves the `Authorization` header.
- Keep `/health` free of account data. Do not add raw upstream responses or
  request bodies to logs.
- Treat all values returned by `ytmusicapi` and YouTube Music as untrusted.
  Preserve response-size caps and field filtering before passing data to a
  model context window.

### Google OAuth and token storage

- Use a dedicated Google Cloud OAuth client and the exact production callback
  URL. Never commit the client secret.
- Keep OAuth refresh tokens in a private Cloudflare KV namespace or an
  equivalently protected token broker.
- Preserve the one-time OAuth `state` check. Removing it enables OAuth account
  substitution attacks.
- Request the narrowest viable scope. The current `youtube.force-ssl` scope is
  required for playlist and rating writes and should be considered sensitive.
- Restrict Cloudflare account access, enable multi-factor authentication, and
  review Worker deployments and secret changes after an incident.

### Optional token broker

The Worker can obtain short-lived Google access tokens from a private Worker
service binding named `GOOGLE_BROKER`. If used:

- Gate every broker endpoint with a separate random `YOUTUBE_BROKER_KEY`.
- Return only short-lived access tokens; never return client secrets or refresh
  tokens.
- Keep auth tickets single-use and short-lived.
- Do not expose internal broker routes merely because they are also reachable
  through a service binding. Apply the same bearer check to public requests.

## Secret inventory

Never commit values for:

- `MCP_API_KEY`
- `YOUTUBE_DISCOVERY_KEY` / `YTMUSIC_DISCOVERY_TOKEN`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Google access or refresh tokens
- `YOUTUBE_BROKER_KEY`
- private service URLs that reveal an internal network

The supplied `.gitignore` excludes common local environment and Wrangler state
files. It is still the maintainer's responsibility to inspect the complete Git
diff before every push and release.

## Upstream and platform risk

`ytmusicapi` is unofficial and emulates YouTube Music's web client. Upstream
markup or protocol changes can break discovery without notice. Pin dependency
versions, review upgrades, and test representative calls before deployment.

This server does not provide audio-stream URLs, browser-cookie authentication,
or remote playback controls. Adding any of those materially changes the threat
model and requires a fresh security review.
