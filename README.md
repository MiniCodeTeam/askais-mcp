# AskAIs AI Receipt Generator MCP

[![CI](https://github.com/MiniCodeTeam/askais-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MiniCodeTeam/askais-mcp/actions/workflows/ci.yml)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-5ee6b3)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

AskAIs MCP is the remote Model Context Protocol server for the **AskAIs AI Receipt Generator API**. It lets Cursor, Claude Code, Codex, Gemini CLI, and other MCP clients create professional receipt PDFs, return structured receipt data, and check prepaid API credit through one endpoint:

```text
https://askais.com/mcp
```

No website login is required to connect. An eligible new user can ask their AI client to run `create_free_account`, accept the Terms and Privacy Policy, and receive one-time account credentials plus introductory API credit.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `get_usage_rules` | Read pricing, privacy, and acceptable-use rules. |
| `create_free_account` | Create an account and receive one-time credentials and free credit. |
| `generate_receipt` | Generate a downloadable receipt PDF from structured transaction data. |
| `get_balance` | Check remaining API credit. |

## Quick start

### Cursor

Add the remote server in Cursor's MCP settings:

```json
{
  "mcpServers": {
    "askais": {
      "url": "https://askais.com/mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http askais https://askais.com/mcp
```

### Codex

```bash
codex mcp add askais --url https://askais.com/mcp
```

### Gemini CLI

Add this server to the `mcpServers` object in Gemini CLI settings:

```json
{
  "mcpServers": {
    "askais": {
      "httpUrl": "https://askais.com/mcp"
    }
  }
}
```

Client configuration fields can change between client versions. If your client uses `serverUrl` or `url` instead of the example field, keep the endpoint exactly `https://askais.com/mcp` and select **Streamable HTTP**.

## Example prompts

```text
Connect to AskAIs, show me the usage rules, and create a free account after I confirm the terms.
```

```text
Create a legitimate USD receipt for Acme Studio: two hours of design consulting at $75 per hour. Show me the PDF link and remaining balance.
```

## Existing AskAIs accounts

Existing developers may send an API key as an HTTP bearer token:

```http
Authorization: Bearer ak_live_your_key
```

The full API key may also be passed to `generate_receipt` or `get_balance`. Store keys in your MCP client's secret storage or environment configuration—not in source control.

## Pricing and free credit

- Receipt generation costs **US$0.10 per successful PDF**.
- Failed generation is not charged.
- Introductory credit is intended for evaluation and is limited by anti-abuse controls.
- Paid credit and keys can be managed in the [AskAIs developer console](https://askais.com/en/developers).

## Acceptable use

AskAIs is for legitimate business records. Do not use it to fabricate purchases, expenses, tax evidence, reimbursements, warranties, or proof of payment. Do not impersonate a merchant or include personal data you are not authorized to process.

Use of the service is governed by the [Terms of Service](https://askais.com/en/terms) and [Privacy Policy](https://askais.com/en/privacy).

## Self-hosting the gateway

The public gateway can be built and run locally, but free-account provisioning requires a private gateway secret issued by AskAIs. Existing API-key tools work against the public API without that secret.

```bash
npm install
npm run build
HOST=127.0.0.1 PORT=3105 npm start
```

Environment variables are documented in [`.env.example`](.env.example). Never commit `ASKAIS_MCP_GATEWAY_SECRET`.

## Architecture

```text
Cursor / Claude Code / Codex / Gemini
                  |
                  v
       https://askais.com/mcp
                  |
                  v
     AskAIs MCP gateway (Streamable HTTP)
                  |
                  v
     Receipt API / billing / PDF / database
```

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Security reports: `security@askais.com`  
Support: `support@askais.com`

<!-- mcp-name: io.github.minicodeteam/askais-mcp -->
