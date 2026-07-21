#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import type { Request, Response } from 'express'
import { loadConfig } from './config.js'
import { createAskAIsMcpServer, type RequestContext } from './mcp-server.js'

const config = loadConfig()
const app = createMcpExpressApp({ host: config.host, allowedHosts: config.allowedHosts })

interface McpSession {
  transport: StreamableHTTPServerTransport
  context: RequestContext
}

const sessions = new Map<string, McpSession>()

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function clientIp(req: Request): string {
  const cf = header(req, 'cf-connecting-ip')
  if (cf) return cf.trim()
  const forwarded = header(req, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function bearerApiKey(req: Request): string | undefined {
  const authorization = header(req, 'authorization')
  if (!authorization?.startsWith('Bearer ')) return undefined
  const token = authorization.slice(7).trim()
  return token.startsWith('ak_live_') ? token : undefined
}

function existingSession(req: Request): McpSession | undefined {
  const id = header(req, 'mcp-session-id')
  return id ? sessions.get(id) : undefined
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'askais-mcp', version: '1.0.0', sessions: sessions.size })
})

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const current = existingSession(req)
    if (current) {
      current.context.clientIp = clientIp(req)
      current.context.userAgent = header(req, 'user-agent')
      current.context.authorizationApiKey = bearerApiKey(req) || current.context.authorizationApiKey
      await current.transport.handleRequest(req, res, req.body)
      return
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Missing or invalid MCP session. Initialize a new session first.' },
        id: null,
      })
      return
    }

    const context: RequestContext = {
      clientIp: clientIp(req),
      userAgent: header(req, 'user-agent'),
      authorizationApiKey: bearerApiKey(req),
      account: {},
    }
    const server = createAskAIsMcpServer(config, context)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { transport, context })
      },
    })
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId)
      void server.close()
    }
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal MCP server error.' }, id: null })
    }
    console.error('[askais-mcp] POST /mcp failed', error)
  }
})

app.get('/mcp', async (req: Request, res: Response) => {
  const session = existingSession(req)
  if (!session) {
    // A person opening the protocol endpoint in a browser does not have an MCP
    // session yet. Send them to the human-readable setup documentation while
    // preserving the protocol error for non-browser clients.
    if ((header(req, 'accept') || '').includes('text/html')) {
      res.redirect(302, 'https://askais.com/en/developers')
      return
    }
    res.status(400).send('Missing or invalid MCP session ID.')
    return
  }
  await session.transport.handleRequest(req, res)
})

app.delete('/mcp', async (req: Request, res: Response) => {
  const session = existingSession(req)
  if (!session) {
    res.status(400).send('Missing or invalid MCP session ID.')
    return
  }
  await session.transport.handleRequest(req, res)
})

app.listen(config.port, config.host, () => {
  console.log(`[askais-mcp] listening on http://${config.host}:${config.port}/mcp`)
})
