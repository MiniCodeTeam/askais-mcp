import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from '../src/config.js'

test('loadConfig applies safe defaults', () => {
  const config = loadConfig({})
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 3105)
  assert.equal(config.apiBase, 'https://api.askais.com')
  assert.equal(config.publicMcpUrl, 'https://askais.com/mcp')
  assert.ok(config.allowedHosts.includes('askais.com'))
})

test('loadConfig normalizes API base and invalid port', () => {
  const config = loadConfig({ ASKAIS_API_BASE: 'https://api.example.com/', PORT: 'nope' })
  assert.equal(config.apiBase, 'https://api.example.com')
  assert.equal(config.port, 3105)
})
