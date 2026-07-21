export interface AppConfig {
  host: string
  port: number
  publicMcpUrl: string
  apiBase: string
  gatewaySecret?: string
}

function readPort(value: string | undefined): number {
  const parsed = Number.parseInt(value || '3105', 10)
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : 3105
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    host: env.HOST || '127.0.0.1',
    port: readPort(env.PORT),
    publicMcpUrl: env.PUBLIC_MCP_URL || 'https://askais.com/mcp',
    apiBase: (env.ASKAIS_API_BASE || 'https://api.askais.com').replace(/\/$/, ''),
    gatewaySecret: env.ASKAIS_MCP_GATEWAY_SECRET || undefined,
  }
}
