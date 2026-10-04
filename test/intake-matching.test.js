import test from 'node:test';
import assert from 'node:assert/strict';
import { compareIntakeCurriculum, compileIntakeRequirements, curriculumSources } from '../intake-matching.js';
import { extractIntake, cleanIntakeFields } from '../opportunity-intake.js';
import { INTAKE_EXAMPLE } from '../intake-example.js';
import { applySeniority } from '../intake-seniority.js';
const fields = extractIntake({ body: INTAKE_EXAMPLE });
const core = 'Consultor funcional SAP FI: configuração de contas a pagar e implementação para clientes.';
const result = cv => compareIntakeCurriculum(cv, fields);
test('program management and cloud implementation do not prove functional FI delivery', () => {
  const r = result({ versoes: [{ texto: 'Senior Program Manager - Infrastructure, Cloud & SAP/TAX Enablement.•Led programs impacting SAP finance and logistics.•Implemented cloud migrations and SAP BASIS configuration.' }] });
  for (const id of ['core', 'implementation', 'configuration']) assert.notEqual(r.comparison.find(c => c.criterionId === id)?.status, 'evidence', id);
  const functional = result({ experiencia_profissional: 'Consultor funcional SAP FI.•Configuração de SAP FI-AP e implementação SAP FI para clientes.' });
  assert.equal(functional.comparison.find(c => c.criterionId === 'implementation').status, 'evidence');
});
test('long evidence is displayed concisely while the complete source is retained', () => {
  const text = core + ' atividades profissionais'.repeat(100);
  const r = result({ experiencia_profissional: text });
  assert.ok(r.comparison.find(c => c.criterionId === 'core').excerpt.length <= 422);
  assert.ok(r.cvText.includes(text));
});
test('technology inventories and other ERP projects cannot establish functional FI evidence', () => {
  const r = result({ experiencia_profissional: 'ERP Implementation Analyst. Implementação e configuração de ERP hospitalar.', versoes: 'Orchestrated cutover, leadership communication and go-live stabilization.Tools & Technologies: SAP FI/CO/SD, Azure VMs, Azure Backup.' });
  for (const id of ['core', 'implementation', 'configuration']) assert.notEqual(r.comparison.find(c => c.criterionId === id).status, 'evidence', id);
});
test('reads professional texts, nested projects, interview, structured languages and entire original text', () => {
  const cv = { projetos: [{ descricao: core, atividades: 'Elaboração de especificações funcionais e test scripts.' }], nivel_ingles: 'Avançado', observacoes_entrevista: 'Realizou localização Brasil e withholding tax.', texto_integral_original: 'Texto inicial.\n'.repeat(9000) + '\nExecutou fechamento contábil mensal e anual em SAP FI.' };
  const r = result(cv);
  assert.ok(r); assert.ok(r.charactersRead > 100000);
  for (const id of ['specification', 'testscript', 'localization', 'withholding', 'monthlyclosing', 'annualclosing']) assert.equal(r.comparison.find(c => c.criterionId === id)?.status, 'evidence', id);
  assert.equal(r.operationalChecks.find(c => c.requirement.startsWith('Idioma')).status, 'evidence');
  assert.equal(r.comparison.find(c => c.criterionId === 'specification').source, 'Projetos');
  assert.ok(r.sourcesRead.includes('Entrevista'));
});
test('courses and skill lists remain mentions; professional implementation is stronger', () => {
  const work = result({ experiencia_profissional: core });
  const course = result({ cursos_certificacoes: 'Curso SAP FI: implementação, configuração de contas a pagar.' });
  const list = result({ skills: 'SAP FI, implementação, configuração de contas a pagar.' });
  assert.ok(work.score > course.score); assert.ok(work.score > list.score);
  assert.notEqual(course.comparison.find(c => c.criterionId === 'implementation').status, 'evidence');
  assert.notEqual(list.comparison.find(c => c.criterionId === 'core').status, 'evidence');
});
test('all four FI submodules remain criteria and FA typo stays visibly uncertain', () => {
  const r = result({ projetos: core + '\nConfiguração de SAP FI-GL, FI-AR, FI-AP e FI-AA.' });
  for (const module of ['GL', 'AR', 'AP', 'AA']) assert.equal(r.comparison.find(c => c.criterionId === `module-${module}`).status, 'ambiguous');
  assert.equal(r.classification, 'review');
});
test('unknown clauses and extra technologies are not silently dropped', () => {
  const f = { ...fields, requirements: 'Implementação SAP FI e Oracle Exadata com ferramenta XYZ obrigatória.\nExperiência em conciliação multicambial especial.', mandatorySkills: 'SAP FI' };
  const plan = compileIntakeRequirements(f);
  assert.ok(plan.coverage.some(c => /Oracle Exadata/.test(c.text)));
  assert.ok(plan.criteria.some(c => c.tokens?.includes('exadata')));
  const r = compareIntakeCurriculum({ experiencia_profissional: core }, f, plan);
  assert.ok(r.pending.some(c => /Exadata/.test(c)));
  assert.ok(r.pending.some(c => /multicambial/.test(c)));
});
test('structured English below requirement is visible without rejecting missing data; Spanish is not English', () => {
  const r = result({ experiencia_profissional: core, nivel_ingles: 'Básico', texto_integral_original: core + '\nEspanhol fluente. Inglês avançado.' });
  assert.equal(r.operationalChecks.find(c => c.requirement.startsWith('Idioma')).status, 'conflict');
  const missing = result({ experiencia_profissional: core, nivel_espanhol: 'Fluente' });
  assert.equal(missing.operationalChecks.find(c => c.requirement.startsWith('Idioma')).status, 'unknown');
  const languages = result({ experiencia_profissional: core, texto_integral_original: 'Inglês avançado; espanhol básico.' });
  assert.equal(languages.operationalChecks.find(c => c.requirement.startsWith('Idioma')).status, 'evidence');
});
test('total module tenure or combined support does not become years exclusively in implementation', () => {
  for (const line of ['10 anos em SAP FI, suporte e projetos de implementação.', '10 anos em SAP FI e 1 ano em implementação.', '01/2010 a 01/2026 Consultor SAP FI: sustentação e uma implementação.']) {
    const r = result({ experiencia_profissional: line });
    assert.notEqual(r.operationalChecks.find(c => c.requirement.startsWith('Experiência:')).status, 'evidence');
  }
  const r = result({ experiencia_profissional: '6 anos de experiência em implementação SAP FI.' });
  assert.equal(r.operationalChecks.find(c => c.requirement.startsWith('Experiência:')).status, 'evidence');
});
test('missing availability, dates and PJ remain pending and are not inferred from residence', () => {
  const r = result({ experiencia_profissional: core, endereco: 'Rio de Janeiro/RJ' });
  for (const prefix of ['Modalidade:', 'Local:', 'Início:', 'Duração:', 'Contratação:']) assert.equal(r.operationalChecks.find(c => c.requirement.startsWith(prefix)).status, 'unknown');
});
test('negation, unrelated technical roles and proposed certifications cannot be promoted to evidence', () => {
  const r = result({ experiencia_profissional: 'Desenvolvedor ABAP: extrair dados de SAP FI para BW.', cursos_certificacoes: 'Curso preparatório para certificação SAP.' });
  assert.notEqual(r.comparison.find(c => c.criterionId === 'core').status, 'evidence');
  assert.notEqual(r.comparison.find(c => c.criterionId === 'certification').status, 'evidence');
  const negative = result({ experiencia_profissional: 'Não tenho experiência em implementação SAP FI.' });
  assert.equal(negative.comparison.find(c => c.criterionId === 'implementation').status, 'conflict');
});
test('age, gender, nationality and search-job notes do not influence comparison', () => {
  const a = result({ experiencia_profissional: core });
  const b = result({ experiencia_profissional: core, idade: 61, nacionalidade: 'Brasileiro', estado_civil: 'Casado', genero: 'M', observacao_busca: INTAKE_EXAMPLE });
  assert.deepEqual(a, b);
  assert.equal(curriculumSources({ projetos: { descricao: core, idade: 50, password: 'not-a-real-password' } })[0].text.includes('password'), false);
});
test('seniority respects explicit or manually edited labels; unrelated roles do not receive SAP FI references', () => {
  const explicit = extractIntake({ body: INTAKE_EXAMPLE + '\nSenioridade: Pleno' });
  assert.equal(explicit.seniority, 'Pleno'); assert.equal(explicit.seniorityAssessment.origin, 'email');
  const edited = { ...fields, seniority: 'Pleno' };
  assert.equal(applySeniority(edited, fields.seniorityAssessment, fields).origin, 'manual');
  const different = { ...fields, coreSkill: 'Java', profile: 'Desenvolvedor Java', seniority: '' };
  const assessment = applySeniority(different);
  assert.equal(assessment.suggested, ''); assert.equal(assessment.sources.length, 0);
});
test('PJ cannot be altered by a submitted form and response deadline is removed from persistence fields', () => {
  const f = cleanIntakeFields({ ...fields, contractType: 'CLT', responseDeadline: 'amanhã' });
  assert.equal(f.contractType, 'PJ'); assert.equal('responseDeadline' in f, false);
});
