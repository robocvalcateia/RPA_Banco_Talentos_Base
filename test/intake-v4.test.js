import test from 'node:test';
import assert from 'node:assert/strict';
import { locationEligibility, withinRadius, consultantLocation, haversineKm } from '../intake-location.js';
import { extractIntake, cleanIntakeFields, matchIntakeCandidates, intakeWarnings } from '../opportunity-intake.js';
import { compileIntakeRequirements, compareIntakeCurriculum } from '../intake-matching.js';
import { INTAKE_EXAMPLE } from '../intake-example.js';
const fields = extractIntake({ subject: 'SOLICITAÇÃO DE COTAÇÃO -VAGA 2054 - SAP FI', body: INTAKE_EXAMPLE });
const cv = { id: '1', endereco: 'Niterói/RJ', experiencia_profissional: 'Consultor funcional SAP FI. Implementação SAP FI, configuração FI-GL e FI-AP para clientes.' };
test('request number comes only after VAGA in subject; text profile fallback and leading zeros preserved', () => {
  for (const subject of ['SOLICITAÇÃO DE COTAÇÃO -VAGA 2054 - SAP Successfactors EC', 'RE: SOLICITAÇÃO DE COTAÇÃO - vaga: 2054 - SAP Successfactors EC']) {
    const f = extractIntake({ subject, body: 'Identificação da solicitação: 9999' });
    assert.equal(f.requestId, '2054 - SAP Successfactors EC'); assert.equal(f.profile, 'SAP Successfactors EC');
  }
  assert.equal(extractIntake({ subject: 'SOLICITAÇÃO DE COTAÇÃO - 2054', body: 'Código da solicitação: 9999' }).requestId, '');
  assert.equal(extractIntake({ subject: 'SOLICITAÇÃO DE COTAÇÃO - VAGA 002054', body: '' }).requestId, '002054');
});
test('capital pairs normalize without inferring missing cities; start is valid month/year', () => {
  assert.equal(fields.city, 'Rio de Janeiro'); assert.equal(fields.state, 'Rio de Janeiro');
  const sp = cleanIntakeFields({ city: 'SP', state: 'SP', start: '9/2026' });
  assert.equal(sp.city, 'São Paulo'); assert.equal(sp.state, 'São Paulo'); assert.equal(sp.start, '09/2026');
  assert.equal(cleanIntakeFields({ city: '', state: 'SP' }).city, '');
  assert.equal(cleanIntakeFields({ city: 'Santos', state: 'SP' }).city, 'Santos');
  assert.equal(cleanIntakeFields({ start: '2026-10-01' }).start, '10/2026');
  assert.equal(cleanIntakeFields({ start: '01/10/2026' }).start, '10/2026');
  assert.ok(!intakeWarnings(fields).some(x => /dia ainda/.test(x)));
  assert.ok(intakeWarnings({ ...fields, start: '13/2026' }).some(x => /Início inválido/.test(x)));
});
test('100km geographic gate includes boundary, excludes distant and applies to hybrid only with known address', () => {
  assert.equal(withinRadius(100), true); assert.equal(withinRadius(100.00001), false); assert.equal(withinRadius(null), false);
  assert.equal(locationEligibility(cv, fields).allowed, true);
  assert.equal(locationEligibility({ endereco: 'São Paulo/SP' }, fields).status, 'outside');
  assert.equal(locationEligibility({ endereco: 'São Paulo/SP' }, { ...fields, workModel: 'Híbrido' }).allowed, false);
  assert.equal(locationEligibility({ endereco: 'São Paulo/SP' }, { ...fields, workModel: 'Remoto' }).allowed, true);
  assert.equal(locationEligibility({}, fields).status, 'unknown');
  assert.equal(locationEligibility({ experiencia_profissional: 'Projeto em Rio de Janeiro/RJ' }, fields).allowed, false);
  assert.equal(consultantLocation({ endereco: 'Rua Rio de Janeiro, 50, Campinas/SP' }).nome, 'Campinas');
  assert.equal(consultantLocation({ endereco: 'Campinas/SP e Niterói/RJ' }), null);
  assert.equal(locationEligibility({ city: 'Niterói', state: 'RJ' }, fields).allowed, true);
  assert.ok(Math.abs(haversineKm({latitude:0,longitude:0}, {latitude:0,longitude:1}) - 111.195) < .01);
});
test('outside candidates are omitted and unknown locations cannot be selected', () => {
  const matches = matchIntakeCandidates([cv, { ...cv, id: '2', endereco: 'São Paulo/SP' }, { ...cv, id:'3', endereco:'' }], fields);
  assert.deepEqual(matches.map(c => c.id), ['1','3']);
  assert.equal(matches[1].blocked, true); assert.equal(matches[1].location.status, 'unknown');
});
test('behavioral criteria do not change technical numerator denominator or ranking', () => {
  const base = { ...fields, requirements: 'Implementação SAP FI. Configuração SAP FI.', mandatorySkills:'', desirable:'' };
  const soft = { ...base, requirements: base.requirements + '\nBoa comunicação, capacidade analítica, liderança, proatividade e trabalho em equipe.' };
  const a = compareIntakeCurriculum(cv, base), b = compareIntakeCurriculum(cv, soft);
  assert.deepEqual(b.scoring, a.scoring); assert.equal(a.score, b.score); assert.equal(a.evidenceCoverage,b.evidenceCoverage);
  assert.ok(b.comparison.filter(c => c.group === 'behavioral').every(c => c.status === 'interview'));
  assert.ok(compileIntakeRequirements(soft).criteria.filter(c => c.group === 'behavioral').length >= 5);
});
test('missing technical evidence changes coverage rather than becoming an incompatibility; desirable separate', () => {
  const base = { ...fields, requirements:'Implementação SAP FI.', mandatorySkills:'', desirable:'' };
  const a = compareIntakeCurriculum(cv, base);
  const b = compareIntakeCurriculum(cv, { ...base, requirements: base.requirements + '\nLocalização Brasil.', desirable: 'Certificação SAP será um diferencial.' });
  assert.equal(a.score,b.score); assert.ok(b.evidenceCoverage < a.evidenceCoverage);
  assert.equal(b.comparison.find(c=>c.criterionId==='localization').status,'unknown');
  assert.ok(b.comparison.some(c=>c.group==='desirable'));
});
test('related troubleshooting phrases share one scoring group and FA spelling does not cap strength', () => {
  const plan=compileIntakeRequirements(fields);
  assert.equal(new Set(plan.criteria.filter(c=>['rootcause','workaround','permanent','actionplan'].includes(c.id)).map(c=>c.scoreGroup)).size,1);
  const a = compareIntakeCurriculum(cv, fields), b = compareIntakeCurriculum(cv,{...fields,requirements:fields.requirements.replaceAll('FA-','FI-'),mandatorySkills:fields.mandatorySkills.replaceAll('FA-','FI-')});
  assert.equal(a.score,b.score);
  assert.ok(a.comparison.some(c=>c.status==='ambiguous'));
});
