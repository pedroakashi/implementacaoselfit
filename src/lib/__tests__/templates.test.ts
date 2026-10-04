import { describe, it, expect } from 'vitest'
import {
  suggestMapping,
  hasUnmappedVars,
  renderPreview,
  getVariableContext,
  buildButtonItems,
  validateMediaUrl,
  hasUnmappedMedia,
  MEDIA_URL_KEY,
} from '../templates'
import type { TemplateInfo, Mapping } from '../templates'

// ──────────────────────────────────────────────────────────────────────────────
// Template fixture — selfit2027
// ──────────────────────────────────────────────────────────────────────────────

const selfit2027: TemplateInfo = {
  name: 'selfit2027',
  language: 'pt_BR',
  category: 'UTILITY',
  bodyText:
    'Olá, {{1}}! Aqui é a Simone, da área de Gente e Gestão da Selfit.\n\n' +
    'Identificamos sua candidatura para a vaga de Assistente de Atendimento, ' +
    'para a unidade {{2}} e gostaríamos de convidá-lo(a) para uma entrevista online.\n\n' +
    '📅 Data: {{3}}\n🕘 Horário: {{4}}\n\n' +
    'Para participar, acesse o link abaixo com 5 minutos de antecedência:\n\n{{5}}',
  variables: [
    { section: 'body', index: 1, key: 'body_1' },
    { section: 'body', index: 2, key: 'body_2' },
    { section: 'body', index: 3, key: 'body_3' },
    { section: 'body', index: 4, key: 'body_4' },
    { section: 'body', index: 5, key: 'body_5' },
  ],
  buttons: [{ type: 'QUICK_REPLY', index: 0 }],
}

// selfit2026: template com texto fixo, sem variáveis, sem botões
const selfit2026: TemplateInfo = {
  name: 'selfit2026',
  language: 'pt_BR',
  category: 'UTILITY',
  bodyText: 'Olá! Aqui é a Selfit. Confirme seu interesse na vaga.',
  variables: [],
  buttons: [],
}

// ──────────────────────────────────────────────────────────────────────────────
// suggestMapping
// ──────────────────────────────────────────────────────────────────────────────

describe('suggestMapping — selfit2027', () => {
  const m = suggestMapping(selfit2027)

  it('{{1}}: sugere firstName (contexto "Olá, __VAR__!")', () => {
    expect(m['body_1'].type).toBe('field')
    expect(m['body_1'].value).toBe('firstName')
  })

  it('{{2}}: sugere unidade (contexto "unidade __VAR__ e")', () => {
    expect(m['body_2'].type).toBe('field')
    expect(m['body_2'].value).toBe('unidade')
  })

  it('{{3}}: sugere fill_on_send date (contexto "📅 Data: __VAR__")', () => {
    expect(m['body_3'].type).toBe('fill_on_send')
    expect(m['body_3'].fillType).toBe('date')
  })

  it('{{4}}: sugere fill_on_send time (contexto "🕘 Horário: __VAR__")', () => {
    expect(m['body_4'].type).toBe('fill_on_send')
    expect(m['body_4'].fillType).toBe('time')
  })

  it('{{5}}: sugere fill_on_send url (contexto "acesse o link... __VAR__")', () => {
    expect(m['body_5'].type).toBe('fill_on_send')
    expect(m['body_5'].fillType).toBe('url')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// hasUnmappedVars
// ──────────────────────────────────────────────────────────────────────────────

describe('hasUnmappedVars', () => {
  const vars = selfit2027.variables

  it('retorna true quando mapeamento está vazio', () => {
    expect(hasUnmappedVars(vars, {})).toBe(true)
  })

  it('retorna true quando fill_on_send não tem fillValue', () => {
    const mapping: Mapping = {
      body_1: { type: 'field',        value: 'firstName' },
      body_2: { type: 'field',        value: 'unidade'   },
      body_3: { type: 'fill_on_send', value: '', fillType: 'date'  },
      body_4: { type: 'fill_on_send', value: '', fillType: 'time'  },
      body_5: { type: 'fill_on_send', value: '', fillType: 'url'   },
    }
    expect(hasUnmappedVars(vars, mapping, {})).toBe(true)
    expect(hasUnmappedVars(vars, mapping, { body_3: '2026-10-15', body_4: '14:00', body_5: 'https://x.com' })).toBe(false)
  })

  it('retorna true quando tipo field tem value vazio', () => {
    const mapping: Mapping = {
      body_1: { type: 'field', value: '' },
      body_2: { type: 'field', value: 'unidade' },
      body_3: { type: 'fill_on_send', value: '', fillType: 'date' },
      body_4: { type: 'fill_on_send', value: '', fillType: 'time' },
      body_5: { type: 'fill_on_send', value: '', fillType: 'url'  },
    }
    expect(hasUnmappedVars(vars, mapping, { body_3: 'd', body_4: 't', body_5: 'u' })).toBe(true)
  })

  it('retorna false quando tudo está preenchido', () => {
    const mapping: Mapping = {
      body_1: { type: 'field', value: 'firstName' },
      body_2: { type: 'field', value: 'unidade'   },
      body_3: { type: 'fill_on_send', value: '', fillType: 'date' },
      body_4: { type: 'fill_on_send', value: '', fillType: 'time' },
      body_5: { type: 'fill_on_send', value: '', fillType: 'url'  },
    }
    const fillValues = { body_3: '2026-10-15', body_4: '14:00', body_5: 'https://teams.com' }
    expect(hasUnmappedVars(vars, mapping, fillValues)).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// renderPreview
// ──────────────────────────────────────────────────────────────────────────────

describe('renderPreview', () => {
  const mapping: Mapping = {
    body_1: { type: 'field',        value: 'firstName' },
    body_2: { type: 'field',        value: 'unidade'   },
    body_3: { type: 'fill_on_send', value: '', fillType: 'date' },
    body_4: { type: 'fill_on_send', value: '', fillType: 'time' },
    body_5: { type: 'fill_on_send', value: '', fillType: 'url'  },
  }
  const fillValues = { body_3: '11/09/2026', body_4: '10:00', body_5: 'https://teams.com/meet' }

  it('substitui {{1}} pelo primeiro nome', () => {
    const result = renderPreview(selfit2027.bodyText, mapping, 'Katy Silva', null, 'Triagem', null, 'Cristo Rei', fillValues)
    expect(result).toContain('Olá, Katy!')
  })

  it('substitui {{2}} pela unidade', () => {
    const result = renderPreview(selfit2027.bodyText, mapping, 'Katy', null, 'Triagem', null, 'Cristo Rei', fillValues)
    expect(result).toContain('unidade Cristo Rei')
  })

  it('substitui {{3}} com fillValue de data', () => {
    const result = renderPreview(selfit2027.bodyText, mapping, 'X', null, '', null, null, fillValues)
    expect(result).toContain('📅 Data: 11/09/2026')
  })

  it('mantém {{N}} quando sem mapeamento', () => {
    const result = renderPreview(selfit2027.bodyText, {}, 'X', null, '', null, null)
    expect(result).toContain('{{1}}')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// getVariableContext
// ──────────────────────────────────────────────────────────────────────────────

describe('getVariableContext', () => {
  it('retorna trecho antes e depois da variável', () => {
    const ctx = getVariableContext(selfit2027.variables[0], selfit2027)
    expect(ctx).toContain('■')
    expect(ctx).toMatch(/Olá,.*■/)
  })

  it('retorna o tag quando variável não encontrada no texto', () => {
    const v = { section: 'body' as const, index: 99, key: 'body_99' }
    expect(getVariableContext(v, selfit2027)).toBe('{{99}}')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// buildButtonItems
// ──────────────────────────────────────────────────────────────────────────────

describe('buildButtonItems — selfit2026 (sem botões)', () => {
  it('retorna array vazio', () => {
    expect(
      buildButtonItems(selfit2026.buttons, selfit2026.variables, {}, 'app123', 'Ana', null, 'Triagem')
    ).toEqual([])
  })
})

describe('buildButtonItems — selfit2027 (1 QUICK_REPLY)', () => {
  const mapping: Mapping = {
    body_1: { type: 'field', value: 'firstName' },
    body_2: { type: 'field', value: 'unidade' },
    body_3: { type: 'fill_on_send', value: '', fillType: 'date' },
    body_4: { type: 'fill_on_send', value: '', fillType: 'time' },
    body_5: { type: 'fill_on_send', value: '', fillType: 'url' },
  }

  it('retorna 1 item QUICK_REPLY', () => {
    const items = buildButtonItems(
      selfit2027.buttons, selfit2027.variables, mapping,
      '98765', 'Katy Silva', 'São Paulo', 'Triagem'
    )
    expect(items).toHaveLength(1)
    expect(items[0]!.type).toBe('QUICK_REPLY')
  })

  it('payload é convoca:<applicationId>:0', () => {
    const items = buildButtonItems(
      selfit2027.buttons, selfit2027.variables, mapping,
      '98765', 'Katy', null, 'Triagem'
    )
    expect(items[0]!.parameter).toBe('convoca:98765:0')
  })

  it('usa candidateRef como fallback quando applicationId é o id interno', () => {
    const items = buildButtonItems(
      selfit2027.buttons, selfit2027.variables, mapping,
      'cuid-interno-xyz', 'Maria', null, 'Triagem'
    )
    expect(items[0]!.parameter).toBe('convoca:cuid-interno-xyz:0')
  })
})

describe('buildButtonItems — URL button com variável', () => {
  const urlTemplate: TemplateInfo = {
    name: 'test_url',
    language: 'pt_BR',
    category: 'UTILITY',
    bodyText: 'Acesse sua vaga em {{1}}.',
    variables: [
      { section: 'body', index: 1, key: 'body_1' },
      { section: 'button_url', index: 1, key: 'button_0_1', buttonIndex: 0 },
    ],
    buttons: [{ type: 'URL', index: 0 }],
  }
  const mapping: Mapping = {
    body_1:     { type: 'fixed', value: 'selfit.com.br' },
    button_0_1: { type: 'fixed', value: 'selfit.com.br/vaga/123' },
  }

  it('retorna 1 item URL com o parâmetro resolvido', () => {
    const items = buildButtonItems(
      urlTemplate.buttons, urlTemplate.variables, mapping,
      'app1', 'Pedro', null, 'Triagem'
    )
    expect(items).toHaveLength(1)
    expect(items[0]!.type).toBe('URL')
    expect(items[0]!.parameter).toBe('selfit.com.br/vaga/123')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// validateMediaUrl
// ──────────────────────────────────────────────────────────────────────────────

describe('validateMediaUrl', () => {
  it('aceita IMAGE com .jpg', () => {
    expect(validateMediaUrl('https://cdn.example.com/foto.jpg', 'IMAGE')).toBeNull()
  })
  it('aceita IMAGE com .jpeg', () => {
    expect(validateMediaUrl('https://cdn.example.com/foto.jpeg', 'IMAGE')).toBeNull()
  })
  it('aceita IMAGE com .png', () => {
    expect(validateMediaUrl('https://cdn.example.com/foto.png', 'IMAGE')).toBeNull()
  })
  it('rejeita IMAGE com .pdf', () => {
    expect(validateMediaUrl('https://cdn.example.com/foto.pdf', 'IMAGE')).toMatch(/jpg|png/)
  })
  it('aceita VIDEO com .mp4', () => {
    expect(validateMediaUrl('https://cdn.example.com/video.mp4', 'VIDEO')).toBeNull()
  })
  it('rejeita VIDEO com .avi', () => {
    expect(validateMediaUrl('https://cdn.example.com/video.avi', 'VIDEO')).toMatch(/mp4/)
  })
  it('aceita DOCUMENT com .pdf', () => {
    expect(validateMediaUrl('https://cdn.example.com/doc.pdf', 'DOCUMENT')).toBeNull()
  })
  it('rejeita quando não começa com https://', () => {
    expect(validateMediaUrl('http://cdn.example.com/doc.pdf', 'DOCUMENT')).toMatch(/https/)
  })
  it('ignora query string ao checar extensão', () => {
    expect(validateMediaUrl('https://cdn.example.com/foto.png?v=1', 'IMAGE')).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// hasUnmappedMedia
// ──────────────────────────────────────────────────────────────────────────────

describe('hasUnmappedMedia', () => {
  it('retorna false quando headerFormat é undefined', () => {
    expect(hasUnmappedMedia(undefined, {})).toBe(false)
  })
  it('retorna true quando URL está vazia', () => {
    expect(hasUnmappedMedia('IMAGE', {})).toBe(true)
  })
  it('retorna true quando URL é inválida', () => {
    const m: Mapping = { [MEDIA_URL_KEY]: { type: 'fixed', value: 'https://cdn.com/file.pdf' } }
    expect(hasUnmappedMedia('IMAGE', m)).toBe(true)
  })
  it('retorna false quando URL é válida para o formato', () => {
    const m: Mapping = { [MEDIA_URL_KEY]: { type: 'fixed', value: 'https://cdn.com/foto.jpg' } }
    expect(hasUnmappedMedia('IMAGE', m)).toBe(false)
  })
})
