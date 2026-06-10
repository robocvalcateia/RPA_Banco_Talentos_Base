import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'database.demo.json'));
const createdAt = '2026-06-02T12:00:00.000Z';

const database = {
  clients: [
    {
      id: 'client_demo',
      customerName: 'Cliente Demo',
      primaryContactName: 'Contato Demo',
      primaryContactEmail: 'contato@demo.local',
      primaryContactPhone: '',
      observation: 'Registro ficticio para homologacao.',
      createdAt
    }
  ],
  users: [
    {
      id: 'user_tecnico_demo',
      name: 'Tecnico Demo',
      email: 'tecnico@demo.local',
      role: 'Admin',
      passwordHash: hashPassword('Alcateia123'),
      mustChangePassword: false,
      createdAt
    }
  ],
  opportunities: [
    {
      id: 'opp_demo',
      clientId: 'client_demo',
      opportunity: 'Analista de Sistemas Demo',
      opportunityCode: 'OPP-DEMO-001',
      status: 'Open',
      openingDate: '2026-06-01',
      closingDate: '',
      monthYear: '2026-06',
      model: 'Hunting',
      owner: 'Tecnico Demo',
      quantity: 1,
      closedQuantity: 0,
      contractValue: 100,
      observation: 'Oportunidade ficticia para homologacao.',
      createdAt
    }
  ],
  curriculums: [
    {
      id: 'curr_demo',
      id_controle: 'CV-DEMO-001',
      nome: 'Candidato Demo',
      email: 'candidato@demo.local',
      telefone: '',
      endereco: '',
      nacionalidade: '',
      estado_civil: '',
      idade: '',
      linkedin: '',
      skills: 'JavaScript, SQL',
      formacao_academica: '',
      nivel_ingles: 'intermediario',
      nivel_espanhol: '',
      cursos_certificacoes: '',
      conhecimento_tecnico: 'JavaScript, SQL',
      experiencia_profissional: 'Registro ficticio para homologacao.',
      hash_documento: '',
      fonte: 'Demo',
      data_criacao: createdAt,
      data_atualizacao: createdAt,
      data_origem: '',
      versoes: [],
      data_nascimento: ''
    }
  ],
  candidates: [
    {
      id: 'cand_demo',
      name: 'Candidato Demo',
      curriculumId: 'curr_demo',
      opportunityId: 'opp_demo',
      hourlyRate: 100,
      observation: 'Registro ficticio para testar etapas e conversao para alocado.',
      approved: false,
      stage: 'Triagem',
      aderencia: 75,
      source: 'Demo',
      notes: '',
      status: 'Em andamento',
      stageEnteredAt: createdAt,
      createdAt,
      stageHistory: [
        {
          stage: 'Triagem',
          enteredAt: createdAt,
          leftAt: ''
        }
      ]
    }
  ],
  allocateds: [],
  cvFilters: [],
  selectedCandidates: []
};

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
console.log(`Base demo criada em ${outputFile}`);
