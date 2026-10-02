import * as dotenv from 'dotenv'
dotenv.config()

import { listTemplates, getConfig } from '../src/lib/infobip'

async function main() {
  const { baseUrl, sender } = getConfig()

  console.log('=== Selfit — Templates Infobip ===')
  console.log(`Base URL : ${baseUrl}`)
  console.log(`Sender   : ${sender}`)
  console.log('')

  const data = await listTemplates() as { templates?: unknown[] } | unknown[]
  type Template = { name: string; language: string; status: string; category: string; structure?: { body?: { text: string } } }
  const templates: Template[] = (Array.isArray(data) ? data : (data as { templates?: Template[] }).templates ?? []) as Template[]

  if (!templates.length) {
    console.log('Nenhum template encontrado.')
    return
  }

  templates.forEach((t, i) => {
    console.log(`[${i + 1}] ${t.name}`)
    console.log(`    Idioma   : ${t.language}`)
    console.log(`    Status   : ${t.status}`)
    console.log(`    Categoria: ${t.category}`)
    if (t.structure?.body?.text) {
      console.log(`    Corpo    : ${t.structure.body.text}`)
    }
    console.log('')
  })

  console.log('Use o campo "name" exato no painel ou como WHATSAPP_TEMPLATE_NAME no .env.')
}

main().catch((err) => {
  console.error('✗ Erro:', err.message)
  process.exit(1)
})
