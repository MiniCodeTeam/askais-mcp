import type { AppConfig } from './config.js'

export interface FreeAccountResult {
  account_id: string
  email: string
  password: string
  api_key: string
  free_credit_cents: number
  balance_cents: number
  free_receipts: number
}

export interface ReceiptItem {
  description: string
  quantity?: number
  unit_price?: number
}

export interface CreateReceiptInput {
  customer_name: string
  contact_person?: string
  customer_phone?: string
  customer_email?: string
  customer_address?: string
  customer_registration_number?: string
  invoice_number?: string
  date?: string
  currency?: string
  payment_method?: string
  total_amount?: number
  items?: ReceiptItem[]
  notes?: string
  customer_notes?: string
  primary_color?: string
  text_color?: string
  language?: string
}

export interface ReceiptResult {
  id: string
  url: string
  currency: string
  total: number
  cost_cents: number
  balance_cents: number
}

export class AskAIsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AskAIsApiError'
  }
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new AskAIsApiError(`AskAIs returned a non-JSON response (${response.status}).`, response.status)
  }
}

async function assertOk(response: Response): Promise<any> {
  const body = await readJson(response)
  if (response.ok) return body
  const error = body?.error
  throw new AskAIsApiError(
    typeof error === 'string' ? error : error?.message || body?.message || `AskAIs request failed (${response.status}).`,
    response.status,
    typeof error === 'object' ? error?.code : undefined,
    body,
  )
}

export class AskAIsClient {
  constructor(private readonly config: AppConfig) {}

  async createFreeAccount(input: {
    clientIp: string
    clientName?: string
    clientVersion?: string
    language?: string
    userAgent?: string
  }): Promise<FreeAccountResult> {
    if (!this.config.gatewaySecret) {
      throw new AskAIsApiError('Free account provisioning is unavailable on this deployment.', 503, 'provisioning_unavailable')
    }

    const response = await fetch(`${this.config.apiBase}/api/mcp/gateway/accounts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mcp-gateway-secret': this.config.gatewaySecret,
        'x-mcp-client-ip': input.clientIp,
        'user-agent': input.userAgent || 'AskAIs-MCP/1.0',
      },
      body: JSON.stringify({
        client_name: input.clientName || 'MCP client',
        client_version: input.clientVersion,
        language: input.language || 'en',
      }),
    })
    return assertOk(response)
  }

  async createReceipt(apiKey: string, input: CreateReceiptInput): Promise<ReceiptResult> {
    const response = await fetch(`${this.config.apiBase}/api/v1/receipts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'user-agent': 'AskAIs-MCP/1.0',
      },
      body: JSON.stringify(input),
    })
    const result = await assertOk(response) as ReceiptResult
    if (result.url?.startsWith('/')) {
      result.url = `${this.config.publicApiBase}${result.url}`
    }
    return result
  }

  async getBalance(apiKey: string): Promise<{ balance_cents: number; currency: string }> {
    const response = await fetch(`${this.config.apiBase}/api/v1/balance`, {
      headers: { 'x-api-key': apiKey, 'user-agent': 'AskAIs-MCP/1.0' },
    })
    return assertOk(response)
  }
}
