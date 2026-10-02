import * as dotenv from 'dotenv'
dotenv.config()

// Importar após dotenv para que process.env esteja populado
import { sendTemplateMessages, getConfig } from '../src/lib/infobip'

async function main() {
  const { testPhone, sender, baseUrl } = getConfig()

  console.log('=== Selfit — Test Send ===')
  console.log(`Base URL : ${baseUrl}`)
  console.log(`Sender   : ${sender}`)
  console.log(`Destino  : ${testPhone ?? 'número do candidato (TEST_OVERRIDE_PHONE não setada!)'}`)
  console.log('')

  if (!testPhone) {
    console.warn(
      '⚠  TEST_OVERRIDE_PHONE não está setada.\n' +
      '   O envio pode atingir o número real do candidato.\n' +
      '   Abortando por segurança. Sete TEST_OVERRIDE_PHONE=5511995903793 no .env.'
    )
    process.exit(1)
  }

  // Use o nome exato do seu template aprovado pela Meta
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'teste_envio_modelo_cobranca'

  console.log(`Template : ${templateName}`)
  console.log('Enviando...')

  const results = await sendTemplateMessages([
    {
      to: testPhone,
      candidateName: 'Candidato Teste',
      templateName,
      placeholders: [],
    },
  ])

  console.log('')
  console.log('✓ Envio bem-sucedido!')
  results.forEach((r) => {
    console.log(`  messageId : ${r.messageId}`)
    console.log(`  status    : ${r.status}`)
  })
}

main().catch((err) => {
  console.error('\n✗ Falha:', err.message)
  process.exit(1)
})
