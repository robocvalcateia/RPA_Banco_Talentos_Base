import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildOpportunityCandidateOutreach,
  registeredCandidateContacts
} from '../server.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('mensagem usa o usuario logado, dados reais da vaga e nao envia informacao interna', () => {
  const result = buildOpportunityCandidateOutreach({
    candidate: { name: 'Ana Candidata' },
    opportunity: {
      opportunity: 'Consultor SAP SuccessFactors ECP Sênior',
      owner: 'Bruno',
      jobDescription: 'Implementação, suporte, incidentes e melhorias em ECP.',
      coreSkill: 'SAP SuccessFactors ECP',
      workModel: 'Híbrido',
      contractType: 'PJ',
      quantity: 2,
      observation: 'Nota interna que não pode ser enviada.',
      contractValue: 210000,
      confidential: true
    },
    client: { customerName: 'Cliente confidencial' },
    user: { name: 'Gerson Scholz' }
  });

  assert.equal(result.subject, 'Oportunidade | Consultor SAP SuccessFactors ECP Sênior');
  assert.match(result.body, /^Olá, Ana Candidata\./);
  assert.match(result.body, /Aqui é Gerson Scholz, da Alcateia Consulting\./);
  assert.match(result.body, /Implementação, suporte, incidentes e melhorias em ECP\./);
  assert.match(result.body, /Skill principal: SAP SuccessFactors ECP/);
  assert.match(result.body, /Modelo de trabalho: Híbrido/);
  assert.match(result.body, /três opções de dia e horário/);
  assert.match(result.body, /Atenciosamente,\nGerson Scholz\nAlcateia Consulting$/);
  assert.doesNotMatch(result.body, /Bruno|Cliente confidencial|Nota interna|210\.000/);
});

test('cliente e valor aparecem somente quando a oportunidade permite a divulgacao', () => {
  const result = buildOpportunityCandidateOutreach({
    candidate: { name: 'Carlos' },
    opportunity: {
      opportunity: 'Analista Fiscal',
      jobDescription: 'Atuação fiscal.',
      contractValue: 8000,
      discloseContractValue: true,
      quantity: 1
    },
    client: { customerName: 'Empresa Cliente' },
    user: { name: 'Usuário Atual' }
  });

  assert.match(result.body, /Cliente: Empresa Cliente/);
  assert.match(result.body, /Remuneração\/valor: R\$\s*8\.000,00/);
});

test('contatos usam apenas campos particulares cadastrados, sem minerar link ou observacao', () => {
  const contacts = registeredCandidateContacts({
    name: 'Ana Candidata',
    email: 'ana@gmail.com',
    consultantEmail: 'recrutador@alcateiaconsulting.com.br',
    whatsapp: '(11) 99876-5432',
    observation: 'interno@empresa.com / (11) 90000-0000',
    link: 'https://exemplo.com/perfil?email=publico@empresa.com'
  }, {
    curriculums: [{ nome: 'Ana Candidata', email: 'ana.secundario@hotmail.com', telefone: '(11) 98765-4321' }]
  });

  assert.deepEqual(contacts.emails.sort(), ['ana.secundario@hotmail.com', 'ana@gmail.com'].sort());
  assert.deepEqual(contacts.phones.sort(), ['5511987654321', '5511998765432'].sort());
  assert.ok(!contacts.emails.some((email) => /alcateia|empresa|publico/.test(email)));
  assert.ok(!contacts.phones.includes('5511900000000'));
});

test('tela oferece email e WhatsApp por candidato e abre somente rascunho ou conversa', () => {
  assert.match(app, /data-outreach-channel="email"/);
  assert.match(app, /data-outreach-channel="whatsapp"/);
  assert.match(app, /function prepareOpportunityCandidateOutreach\(button\)/);
  assert.match(app, /Nenhum e-mail foi enviado automaticamente/);
  assert.match(app, /Nenhuma mensagem foi enviada automaticamente/);
  assert.match(app, /\/candidates\/\$\{encodeURIComponent\(candidateId\)\}\/outreach/);
  assert.match(server, /buildOutlookComposeLink/);
  assert.match(server, /Candidato sem e-mail particular cadastrado/);
  assert.match(server, /Candidato sem WhatsApp particular cadastrado/);
  assert.match(server, /Nenhum envio automático foi realizado/);
  assert.match(styles, /#opportunityCandidatesTable \.opportunity-candidate-actions\s*\{[\s\S]*grid-template-columns: repeat\(2, var\(--action-button-width\)\)/);
});
