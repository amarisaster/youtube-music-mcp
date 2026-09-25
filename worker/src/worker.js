const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'

const TOOLS = [
  {
    name: 'ytmusic_search',
    description: 'Search YouTube Music for songs, music videos, artists, or playlists. Returns YouTube Music links.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Song, artist, album, or playlist to find' },
        type: { type: 'string', enum: ['song', 'video', 'album', 'artist', 'playlist'], default: 'song' },
        limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'ytmusic_album',
    description: 'Get YouTube Music album details and its track list.',
    inputSchema: { type: 'object', properties: { browse_id: { type: 'string' } }, required: ['browse_id'] },
  },
  {
    name: 'ytmusic_artist',
    description: 'Get a YouTube Music artist profile, songs, albums, singles, and related artists.',
    inputSchema: { type: 'object', properties: { channel_id: { type: 'string' } }, required: ['channel_id'] },
  },
  {
    name: 'ytmusic_song',
    description: 'Get metadata for a YouTube Music song or music video.',
    inputSchema: { type: 'object', properties: { video_id: { type: 'string' } }, required: ['video_id'] },
  },
  {
    name: 'ytmusic_lyrics',
    description: 'Get lyrics using the lyrics browse ID returned by song/radio data.',
    inputSchema: { type: 'object', properties: { browse_id: { type: 'string' } }, required: ['browse_id'] },
  },
  {
    name: 'ytmusic_radio',
    description: 'Build a YouTube Music radio/watch queue from a song.',
    inputSchema: {
      type: 'object',
      properties: {
        video_id: { type: 'string' },
        playlist_id: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
      },
      required: ['video_id'],
    },
  },
  {
    name: 'ytmusic_charts',
    description: 'Get current YouTube Music charts for a two-letter country code.',
    inputSchema: {
      type: 'object',
      properties: { country: { type: 'string', minLength: 2, maxLength: 2, default: 'PH' } },
    },
  },
  {
    name: 'ytmusic_playlists',
    description: "List Mai's YouTube and YouTube Music playlists.",
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 } },
    },
  },
  {
    name: 'ytmusic_playlist_items',
    description: 'List songs and videos in a YouTube Music playlist.',
    inputSchema: {
      type: 'object',
      properties: {
        playlist_id: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
      },
      required: ['playlist_id'],
    },
  },
  {
    name: 'ytmusic_create_playlist',
    description: 'Create a YouTube Music-compatible playlist, optionally with songs already in it.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        privacy: { type: 'string', enum: ['private', 'unlisted', 'public'], default: 'private' },
        video_ids: { type: 'array', items: { type: 'string' }, maxItems: 50 },
      },
      required: ['title'],
    },
  },
  {
    name: 'ytmusic_add_to_playlist',
    description: 'Add one or more YouTube Music song/video IDs to a playlist.',
    inputSchema: {
      type: 'object',
      properties: {
        playlist_id: { type: 'string' },
        video_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 50 },
      },
      required: ['playlist_id', 'video_ids'],
    },
  },
  {
    name: 'ytmusic_remove_from_playlist',
    description: 'Remove an item from a playlist using its playlist_item_id.',
    inputSchema: {
      type: 'object',
      properties: { playlist_item_id: { type: 'string' } },
      required: ['playlist_item_id'],
    },
  },
  {
    name: 'ytmusic_rate',
    description: 'Like, dislike, or remove the rating from a YouTube Music song/video.',
    inputSchema: {
      type: 'object',
      properties: {
        video_id: { type: 'string' },
        rating: { type: 'string', enum: ['like', 'dislike', 'none'] },
      },
      required: ['video_id', 'rating'],
    },
  },
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: { ...CORS, ...headers } })
}

function secureEqual(a, b) {
  const left = new TextEncoder().encode(a || '')
  const right = new TextEncoder().encode(b || '')
  if (left.length !== right.length) return false
  let difference = 0
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i]
  return difference === 0
}

function requestToken(request, url) {
  const header = request.headers.get('Authorization') || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return url.searchParams.get('k') || ''
}

function isAuthorized(request, url, env) {
  return Boolean(env.MCP_API_KEY) && secureEqual(requestToken(request, url), env.MCP_API_KEY)
}

function boundedInteger(value, fallback, maximum) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.max(1, Math.min(maximum, parsed))
}

function requiredString(value, name, maximum = 500) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  if (value.length > maximum) throw new Error(`${name} is too long`)
  return value.trim()
}

function optionalVideoIds(value) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 50) throw new Error('video_ids must be an array of at most 50 IDs')
  return value.map((id) => requiredString(id, 'video_id', 64))
}

async function broker(env, path, method = 'POST') {
  const response = await env.GOOGLE_BROKER.fetch(`https://biometrics.internal${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.YOUTUBE_BROKER_KEY}` },
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `Google authorization broker returned ${response.status}`)
  return value
}

async function discovery(env, path, args) {
  const response = await fetch(`${env.DISCOVERY_URL.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.YOUTUBE_DISCOVERY_KEY}` },
    body: JSON.stringify(args),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `YouTube Music discovery returned ${response.status}`)
  return value
}

async function accessToken(env) {
  const result = await broker(env, '/internal/youtube-token')
  if (!result.access_token) throw new Error('YouTube Music is not connected. Open /auth once to grant access.')
  return result.access_token
}

async function youtubeApi(env, path, init = {}) {
  const token = await accessToken(env)
  const response = await fetch(`${YOUTUBE_API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  // The broker caches Google tokens briefly. A 401 is surfaced cleanly; the
  // broker refreshes automatically once its cache expires.
  if (response.status === 204) return { success: true }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const reason = body?.error?.message || `HTTP ${response.status}`
    throw new Error(`YouTube API error: ${reason}`)
  }
  return body
}

function musicUrl(videoId) {
  return `https://music.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

function playlistUrl(playlistId) {
  return `https://music.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`
}

async function addVideos(env, playlistId, videoIds) {
  const added = []
  for (const videoId of videoIds) {
    const item = await youtubeApi(env, '/playlistItems?part=snippet', {
      method: 'POST',
      body: JSON.stringify({
        snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
      }),
    })
    added.push({ video_id: videoId, playlist_item_id: item.id })
  }
  return added
}

async function callTool(name, args, env) {
  switch (name) {
    case 'ytmusic_search': {
      const query = requiredString(args.query, 'query')
      const type = args.type || 'song'
      if (!['song', 'video', 'album', 'artist', 'playlist'].includes(type)) throw new Error('invalid search type')
      const limit = boundedInteger(args.limit, 10, 25)
      const filters = { song: 'songs', video: 'videos', album: 'albums', artist: 'artists', playlist: 'playlists' }
      return discovery(env, '/search', { query, filter: filters[type], limit })
    }
    case 'ytmusic_album':
      return discovery(env, '/album', { browse_id: requiredString(args.browse_id, 'browse_id', 128) })
    case 'ytmusic_artist':
      return discovery(env, '/artist', { channel_id: requiredString(args.channel_id, 'channel_id', 128) })
    case 'ytmusic_song':
      return discovery(env, '/song', { video_id: requiredString(args.video_id, 'video_id', 64) })
    case 'ytmusic_lyrics':
      return discovery(env, '/lyrics', { browse_id: requiredString(args.browse_id, 'browse_id', 128) })
    case 'ytmusic_radio':
      return discovery(env, '/radio', {
        video_id: requiredString(args.video_id, 'video_id', 64),
        ...(args.playlist_id ? { playlist_id: requiredString(args.playlist_id, 'playlist_id', 128) } : {}),
        limit: boundedInteger(args.limit, 25, 50),
      })
    case 'ytmusic_charts': {
      const country = typeof args.country === 'string' ? args.country.trim().toUpperCase() : 'PH'
      if (!/^[A-Z]{2}$/.test(country)) throw new Error('country must be a two-letter code')
      return discovery(env, '/charts', { country })
    }
    case 'ytmusic_playlists': {
      const limit = boundedInteger(args.limit, 25, 50)
      const data = await youtubeApi(env, `/playlists?part=snippet,contentDetails&mine=true&maxResults=${limit}`)
      return {
        playlists: (data.items || []).map((item) => ({
          id: item.id,
          title: item.snippet?.title,
          description: item.snippet?.description,
          item_count: item.contentDetails?.itemCount,
          url: playlistUrl(item.id),
        })),
      }
    }
    case 'ytmusic_playlist_items': {
      const playlistId = requiredString(args.playlist_id, 'playlist_id', 128)
      const limit = boundedInteger(args.limit, 25, 50)
      const params = new URLSearchParams({ part: 'snippet,contentDetails', playlistId, maxResults: String(limit) })
      const data = await youtubeApi(env, `/playlistItems?${params}`)
      return {
        playlist_id: playlistId,
        items: (data.items || []).map((item) => ({
          playlist_item_id: item.id,
          video_id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
          title: item.snippet?.title,
          creator: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle,
          url: musicUrl(item.contentDetails?.videoId || item.snippet?.resourceId?.videoId),
        })),
      }
    }
    case 'ytmusic_create_playlist': {
      const title = requiredString(args.title, 'title', 150)
      const description = typeof args.description === 'string' ? args.description.slice(0, 5000) : ''
      const privacy = args.privacy || 'private'
      if (!['private', 'unlisted', 'public'].includes(privacy)) throw new Error('invalid privacy')
      const playlist = await youtubeApi(env, '/playlists?part=snippet,status', {
        method: 'POST',
        body: JSON.stringify({ snippet: { title, description }, status: { privacyStatus: privacy } }),
      })
      const added = await addVideos(env, playlist.id, optionalVideoIds(args.video_ids))
      return { id: playlist.id, title, privacy, url: playlistUrl(playlist.id), added }
    }
    case 'ytmusic_add_to_playlist': {
      const playlistId = requiredString(args.playlist_id, 'playlist_id', 128)
      const videoIds = optionalVideoIds(args.video_ids)
      if (!videoIds.length) throw new Error('video_ids must contain at least one ID')
      return { playlist_id: playlistId, added: await addVideos(env, playlistId, videoIds), url: playlistUrl(playlistId) }
    }
    case 'ytmusic_remove_from_playlist': {
      const itemId = requiredString(args.playlist_item_id, 'playlist_item_id', 128)
      await youtubeApi(env, `/playlistItems?id=${encodeURIComponent(itemId)}`, { method: 'DELETE' })
      return { success: true, playlist_item_id: itemId }
    }
    case 'ytmusic_rate': {
      const videoId = requiredString(args.video_id, 'video_id', 64)
      const rating = args.rating
      if (!['like', 'dislike', 'none'].includes(rating)) throw new Error('invalid rating')
      await youtubeApi(env, `/videos/rate?id=${encodeURIComponent(videoId)}&rating=${rating}`, { method: 'POST' })
      return { success: true, video_id: videoId, rating }
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

async function mcp(request, env) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })
  let body
  try { body = await request.json() } catch { return json({ error: 'invalid JSON' }, 400) }
  const { id, method, params } = body
  let result
  try {
    if (method === 'initialize') {
      result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'youtube-music-cloud', version: '1.0.0' } }
    } else if (method === 'tools/list') {
      result = { tools: TOOLS }
    } else if (method === 'tools/call') {
      const value = await callTool(params?.name, params?.arguments || {}, env)
      result = { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
    } else if (method === 'notifications/initialized') {
      return new Response(null, { status: 202, headers: CORS })
    } else {
      return json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Method not found: ${method}` } })
    }
  } catch (error) {
    result = { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true }
  }
  return json({ jsonrpc: '2.0', id: id ?? null, result })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    if (url.pathname === '/') {
      return new Response('YouTube Music MCP\n\n/health - status\n/auth?k=... - connect Google\n/mcp - MCP endpoint\n/sse - discovery endpoint', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
      })
    }

    if (url.pathname === '/health') {
      let connected = false
      try { connected = Boolean((await broker(env, '/internal/youtube-status', 'GET')).connected) } catch { /* reported below */ }
      return json({
        status: connected ? 'authenticated' : 'not_authenticated',
        configured: Boolean(env.GOOGLE_BROKER && env.YOUTUBE_BROKER_KEY && env.MCP_API_KEY && env.DISCOVERY_URL && env.YOUTUBE_DISCOVERY_KEY),
        connected,
      })
    }

    if (url.pathname === '/auth') {
      if (!isAuthorized(request, url, env)) return json({ error: 'unauthorized' }, 401)
      try {
        const { ticket } = await broker(env, '/internal/youtube-auth-ticket')
        return Response.redirect(`${env.BIOMETRICS_AUTH_URL.replace(/\/$/, '')}/auth?ticket=${encodeURIComponent(ticket)}`, 302)
      } catch (error) {
        return json({ error: error.message }, 503)
      }
    }

    if (url.pathname === '/sse') {
      if (!isAuthorized(request, url, env)) return json({ error: 'unauthorized' }, 401)
      return new Response(`event: endpoint\ndata: ${url.origin}/mcp\n\n`, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...CORS },
      })
    }

    if (url.pathname === '/mcp') {
      if (!isAuthorized(request, url, env)) return json({ error: 'unauthorized' }, 401)
      return mcp(request, env)
    }

    return json({ error: 'not found' }, 404)
  },
}
