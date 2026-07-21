import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { AskAIsApiError, AskAIsClient } from './askais-client.js'
import type { AppConfig } from './config.js'

export interface SessionAccount {
  apiKey?: string
  accountId?: string
  email?: string
}

export interface RequestContext {
  clientIp: string
  userAgent?: string
  authorizationApiKey?: string
  account: SessionAccount
}

function response(data: unknown, message?: string) {
  return {
    content: [{ type: 'text' as const, text: message || JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AskAIsApiError) {
    return {
      isError: true,
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ error: error.code || 'askais_api_error', message: error.message, status: error.status }, null, 2),
      }],
    }
  }
  return {
    isError: true,
    content: [{ type: 'text' as const, text: 'Unexpected AskAIs MCP error.' }],
  }
}

function keyFor(context: RequestContext, explicit?: string): string {
  const key = explicit || context.account.apiKey || context.authorizationApiKey
  if (!key) {
    throw new AskAIsApiError(
      'No AskAIs account is connected. Call create_free_account first, or provide api_key.',
      401,
      'account_required',
    )
  }
  return key
}

export function createAskAIsMcpServer(config: AppConfig, context: RequestContext): McpServer {
  const api = new AskAIsClient(config)
  const server = new McpServer({ name: 'askais-ai-receipt-generator', version: '1.0.0' })

  server.registerTool(
    'get_usage_rules',
    {
      title: 'Get AskAIs usage rules',
      description: 'Read pricing, free-credit, privacy, and acceptable-use rules before creating an account or receipt.',
      inputSchema: {},
    },
    async () => response({
      service: 'AskAIs AI Receipt Generator',
      mcp_url: config.publicMcpUrl,
      price_per_successful_receipt_usd: 0.10,
      billing: 'Charged only when a receipt PDF is generated successfully.',
      free_account: 'One introductory grant may be available per eligible user/network. Abuse prevention applies.',
      acceptable_use: 'Create records only for legitimate transactions. Do not fabricate purchases, expenses, tax evidence, reimbursements, or proof of payment.',
      privacy: 'Do not include unnecessary sensitive personal data. You are responsible for having authority to process submitted data.',
      terms_url: 'https://askais.com/en/terms',
      privacy_url: 'https://askais.com/en/privacy',
      docs_url: 'https://askais.com/en/developers',
    }))

  server.registerTool(
    'create_free_account',
    {
      title: 'Create a free AskAIs account',
      description: 'Create an AskAIs account without opening a browser. Returns one-time login credentials and an API key with introductory receipt credit. The user must explicitly accept the Terms and Privacy Policy.',
      inputSchema: {
        accept_terms: z.literal(true).describe('Must be true after the user agrees to AskAIs Terms and Privacy Policy.'),
        preferred_language: z.enum(['en', 'zh-CN', 'zh-TW', 'ja', 'ko']).optional(),
        client_name: z.string().min(1).max(80).optional().describe('MCP host name, for example Cursor, Claude Code, Codex, or Gemini CLI.'),
        client_version: z.string().max(40).optional(),
      },
    },
    async ({ preferred_language, client_name, client_version }) => {
      try {
        const made = await api.createFreeAccount({
          clientIp: context.clientIp,
          clientName: client_name,
          clientVersion: client_version,
          language: preferred_language,
          userAgent: context.userAgent,
        })
        context.account.apiKey = made.api_key
        context.account.accountId = made.account_id
        context.account.email = made.email
        return response({
          ...made,
          credential_notice: 'Save these credentials now. The password and full API key are shown only once.',
          security_notice: 'Do not paste the API key into public issues, source code, or shared chat logs.',
          login_url: 'https://askais.com/en?showAuth=true',
          developer_console_url: 'https://askais.com/en/developers',
        })
      } catch (error) {
        return errorResponse(error)
      }
    },
  )

  server.registerTool(
    'generate_receipt',
    {
      title: 'Generate a professional receipt PDF',
      description: 'Generate a downloadable receipt PDF for a legitimate transaction. Costs $0.10 only on successful generation.',
      inputSchema: {
        api_key: z.string().startsWith('ak_live_').optional().describe('Optional after create_free_account succeeds in this MCP session.'),
        customer_name: z.string().min(1).max(200),
        contact_person: z.string().max(200).optional(),
        customer_phone: z.string().max(80).optional(),
        customer_email: z.string().email().optional(),
        customer_address: z.string().max(500).optional(),
        customer_registration_number: z.string().max(120).optional(),
        invoice_number: z.string().max(120).optional(),
        date: z.string().max(40).optional().describe('Receipt date, preferably YYYY-MM-DD.'),
        currency: z.string().max(12).optional().describe('Currency symbol or code, for example USD, HKD, or $.') ,
        payment_method: z.string().max(120).optional(),
        total_amount: z.number().positive().optional(),
        items: z.array(z.object({
          description: z.string().min(1).max(300),
          quantity: z.number().positive().optional(),
          unit_price: z.number().nonnegative().optional(),
        })).min(1).max(100).optional(),
        notes: z.string().max(1000).optional(),
        customer_notes: z.string().max(1000).optional(),
        primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        text_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        language: z.string().max(20).optional(),
        confirm_legitimate_transaction: z.literal(true).describe('Must be true. Confirms this receipt represents a legitimate transaction and will not be used to deceive.'),
      },
    },
    async ({ api_key, confirm_legitimate_transaction: _confirmed, ...input }) => {
      try {
        const result = await api.createReceipt(keyFor(context, api_key), input)
        return response(result)
      } catch (error) {
        return errorResponse(error)
      }
    },
  )

  server.registerTool(
    'get_balance',
    {
      title: 'Get AskAIs API balance',
      description: 'Return the remaining prepaid AskAIs API credit for the connected account.',
      inputSchema: {
        api_key: z.string().startsWith('ak_live_').optional().describe('Optional after create_free_account succeeds in this MCP session.'),
      },
    },
    async ({ api_key }) => {
      try {
        const result = await api.getBalance(keyFor(context, api_key))
        return response({ ...result, estimated_receipts: Math.floor(result.balance_cents / 10) })
      } catch (error) {
        return errorResponse(error)
      }
    },
  )

  return server
}
