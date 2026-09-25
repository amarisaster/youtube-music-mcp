# Cloudflare MCP worker

This Worker provides the MCP transport and the authenticated YouTube Data API
surface. See the [project README](../README.md) for setup and tool documentation
and [SECURITY.md](../SECURITY.md) before deployment.

The default configuration uses a private KV namespace for OAuth state and
tokens. An advanced deployment can provide a private `GOOGLE_BROKER` Worker
service binding instead; the broker must implement the three internal endpoints
documented in `src/worker.js` and must be protected with a distinct bearer key.
