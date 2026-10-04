#!/usr/bin/env node
/**
 * Gerencia webhooks Gupy.
 *
 * Uso:
 *   node scripts/gupy-webhooks.mjs list
 *   node scripts/gupy-webhooks.mjs register https://seudominio.vercel.app
 *   node scripts/gupy-webhooks.mjs delete <id>
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Carregar .env manualmente (Node puro, sem dotenv) ─────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env')
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
} catch {
  // .env ausente é ok em produção
}

// ── Validações ────────────────────────────────────────────────────────────────
function requireEnv(name) {
  const val = process.env[name]
  if (!val?.trim()) {
    console.error(`✗ Variável ${name} não encontrada no .env`)
    process.exit(1)
  }
  return val.trim()
}

const BASE = 'https://api.gupy.io/api/v1'
const ACTIONS = ['application.created', 'application.moved']

async function gupyFetch(path, options = {}) {
  const token = requireEnv('GUPY_API_TOKEN')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })
  return res
}

// ── Comandos ──────────────────────────────────────────────────────────────────

async function list() {
  const res = await gupyFetch('/webhooks')
  if (!res.ok) {
    const body = await res.text()
    console.error(`✗ Erro HTTP ${res.status}: ${body}`)
    process.exit(1)
  }
  const webhooks = await res.json()
  if (!webhooks.length) {
    console.log('Nenhum webhook cadastrado.')
    return
  }
  console.log(`\n${'ID'.padEnd(36)}  ${'ACTION'.padEnd(25)}  ${'STATUS'.padEnd(10)}  POSTBACK URL`)
  console.log('─'.repeat(110))
  for (const w of webhooks) {
    console.log(
      `${String(w.id).padEnd(36)}  ${String(w.action).padEnd(25)}  ${String(w.status).padEnd(10)}  ${w.postbackUrl}`
    )
  }
  console.log('')
}

async function register(baseUrl) {
  if (!baseUrl) {
    console.error('✗ Informe a base URL. Ex: node scripts/gupy-webhooks.mjs register https://seusite.vercel.app')
    process.exit(1)
  }
  if (!baseUrl.startsWith('https://')) {
    console.error('✗ A base URL deve começar com https://')
    process.exit(1)
  }

  const secret       = requireEnv('GUPY_WEBHOOK_SECRET')
  const techOwnerName  = requireEnv('GUPY_TECH_OWNER_NAME')
  const techOwnerEmail = requireEnv('GUPY_TECH_OWNER_EMAIL')
  const postbackUrl  = `${baseUrl}/api/webhooks/gupy`

  // Buscar existentes para evitar duplicatas
  const listRes = await gupyFetch('/webhooks')
  const existing = listRes.ok ? await listRes.json() : []

  for (const action of ACTIONS) {
    const alreadyExists = existing.some(
      (w) => w.action === action && w.postbackUrl === postbackUrl
    )
    if (alreadyExists) {
      console.log(`ℹ  Já existe webhook para ${action} → ${postbackUrl}`)
      continue
    }

    const body = JSON.stringify({
      action,
      postbackUrl,
      status: 'active',
      clientHeaders: {
        'x-convoca-secret': secret,
        'Content-Type': 'application/json;charset=utf-8',
      },
      techOwnerName,
      techOwnerEmail,
    })

    const res = await gupyFetch('/webhooks', { method: 'POST', body })
    if (!res.ok) {
      const err = await res.text()
      console.error(`✗ Erro ao criar webhook para ${action} (HTTP ${res.status}): ${err}`)
      // Se 400, tente com postBackUrl (variação da doc)
      if (res.status === 400) {
        console.log(`  Tentando com "postBackUrl" (variação da doc)...`)
        const body2 = JSON.stringify({
          action,
          postBackUrl: postbackUrl,
          status: 'active',
          clientHeaders: {
            'x-convoca-secret': secret,
            'Content-Type': 'application/json;charset=utf-8',
          },
          techOwnerName,
          techOwnerEmail,
        })
        const res2 = await gupyFetch('/webhooks', { method: 'POST', body: body2 })
        if (res2.ok) {
          const w = await res2.json()
          console.log(`✓  Criado com "postBackUrl": ${action} → ${postbackUrl} (id: ${w.id})`)
        } else {
          const err2 = await res2.text()
          console.error(`✗  Falhou também com "postBackUrl": ${err2}`)
        }
      }
      continue
    }

    const w = await res.json()
    console.log(`✓  Criado: ${action} → ${postbackUrl} (id: ${w.id})`)
  }
}

async function del(id) {
  if (!id) {
    console.error('✗ Informe o id do webhook. Ex: node scripts/gupy-webhooks.mjs delete abc123')
    process.exit(1)
  }
  const res = await gupyFetch(`/webhooks/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const body = await res.text()
    console.error(`✗ Erro HTTP ${res.status}: ${body}`)
    process.exit(1)
  }
  console.log(`✓  Webhook ${id} deletado.`)
}

// ── Entry point ───────────────────────────────────────────────────────────────
const [,, cmd, arg] = process.argv
switch (cmd) {
  case 'list':     await list();         break
  case 'register': await register(arg);  break
  case 'delete':   await del(arg);       break
  default:
    console.log(`Uso:
  node scripts/gupy-webhooks.mjs list
  node scripts/gupy-webhooks.mjs register <baseUrl>
  node scripts/gupy-webhooks.mjs delete <id>`)
    process.exit(1)
}
