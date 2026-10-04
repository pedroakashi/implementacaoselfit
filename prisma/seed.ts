import { PrismaClient, CandidateSource } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed vagas
  const vagasData = [
    { id: 'v1', title: 'Personal Trainer',           location: 'São Paulo',  openings: 3 },
    { id: 'v2', title: 'Instrutor de Musculação',    location: 'Campinas',   openings: 2 },
    { id: 'v3', title: 'Recepcionista',              location: 'São Paulo',  openings: 4 },
    { id: 'v4', title: 'Coordenador de Academia',    location: 'Santos',     openings: 1 },
  ]

  for (const v of vagasData) {
    await prisma.vaga.upsert({ where: { id: v.id }, update: {}, create: v })
  }

  // Seed candidates (test phone)
  const candidatesData = [
    { id: 'c1',  vagaId: 'v1', name: 'Ana Paula Ferreira',   phone: '5511995903793', city: 'São Paulo',       stage: 'Triagem'    },
    { id: 'c2',  vagaId: 'v1', name: 'Carlos Eduardo Lima',   phone: '5511995903793', city: 'Guarulhos',       stage: 'Entrevista' },
    { id: 'c3',  vagaId: 'v1', name: 'Fernanda Souza',        phone: '5511995903793', city: 'São Paulo',       stage: 'Triagem'    },
    { id: 'c4',  vagaId: 'v1', name: 'Ricardo Matos',         phone: '5511995903793', city: 'Santo André',     stage: 'Aprovado'   },
    { id: 'c5',  vagaId: 'v1', name: 'Juliana Costa',         phone: '5511995903793', city: 'São Paulo',       stage: 'Triagem'    },
    { id: 'c6',  vagaId: 'v2', name: 'Marcelo Andrade',       phone: '5511995903793', city: 'Campinas',        stage: 'Entrevista' },
    { id: 'c7',  vagaId: 'v2', name: 'Priscila Nunes',        phone: '5511995903793', city: 'Campinas',        stage: 'Triagem'    },
    { id: 'c8',  vagaId: 'v2', name: 'Diego Rodrigues',       phone: '5511995903793', city: 'Vinhedo',         stage: 'Aprovado'   },
    { id: 'c9',  vagaId: 'v2', name: 'Tatiana Freitas',       phone: '5511995903793', city: 'Campinas',        stage: 'Triagem'    },
    { id: 'c10', vagaId: 'v3', name: 'Beatriz Alves',         phone: '5511995903793', city: 'São Paulo',       stage: 'Triagem'    },
    { id: 'c11', vagaId: 'v3', name: 'Lucas Pereira',         phone: '5511995903793', city: 'São Paulo',       stage: 'Entrevista' },
    { id: 'c12', vagaId: 'v3', name: 'Camila Santos',         phone: '5511995903793', city: 'Osasco',          stage: 'Triagem'    },
    { id: 'c13', vagaId: 'v3', name: 'Rodrigo Mendes',        phone: '5511995903793', city: 'São Paulo',       stage: 'Aprovado'   },
    { id: 'c14', vagaId: 'v3', name: 'Vanessa Lima',          phone: '5511995903793', city: 'Taboão da Serra', stage: 'Triagem'    },
    { id: 'c15', vagaId: 'v3', name: 'Felipe Carvalho',       phone: '5511995903793', city: 'São Paulo',       stage: 'Entrevista' },
    { id: 'c16', vagaId: 'v4', name: 'Patricia Oliveira',     phone: '5511995903793', city: 'Santos',          stage: 'Entrevista' },
    { id: 'c17', vagaId: 'v4', name: 'Alexandre Rocha',       phone: '5511995903793', city: 'Santos',          stage: 'Aprovado'   },
    { id: 'c18', vagaId: 'v4', name: 'Silvia Martins',        phone: '5511995903793', city: 'Praia Grande',    stage: 'Triagem'    },
  ]

  for (const c of candidatesData) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, source: CandidateSource.manual, hasPhone: true },
    })
  }

  console.log('✓ Seed concluído')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
