import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { compileIntakeRequirements, compareIntakeCurriculum, INTAKE_MATCH_VERSION } from './intake-matching.js';
import { applySeniority } from './intake-seniority.js';
import { normalizePlace, locationEligibility } from './intake-location.js';
export const INTAKE_SENDER = 'poolterceiros@deloitte.com';
import { normalizeSelectedCandidate, normalizeCandidateMovement } from './db.js';

const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (message, statusCode = 422) => { throw Object.assign(new Error(message), { statusCode }); };
export const INTAKE_FIELDS = ['requestId', 'profile', 'seniority', 'quantity', 'workModel', 'city', 'state', 'start', 'duration', 'language', 'minimumYears', 'coreSkill', 'mandatorySkills', 'requirements', 'desirable', 'instructions', 'attachments', 'model', 'contractType', 'observation'];
export const requestIdFromSubject = subject => String(subject || '').match(/\bvaga\s*[:#-]?\s*(\d+)\b/i)?.[1] || '';
export const requestLabelFromSubject = subject => String(subject || '').match(/\bvaga\s*[:#-]?\s*(\d+\b[^\r\n]*)/i)?.[1]?.trim() || '';
const requestNumber = value => String(value || '').match(/^\s*(\d+)\b/)?.[1] || '';
export function normalizeStart(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{1,2})[/-](\d{4})$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) return `${match[1].padStart(2, '0')}/${match[2]}`;
  match = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return `${match[2]}/${match[1]}`;
  match = text.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) return `${match[1].padStart(2, '0')}/${match[2]}`;
  return text;
}

export function extractIntake(email) {
  const body = String(email.body || '').trim();
  const lines = body.split(/\r?\n/).map(line => line.trim());
  const field = label => lines.find(line => label.test(norm(line.split(':')[0])))?.split(':').slice(1).join(':').trim() || '';
  const section = (start, end) => {
    const a = lines.findIndex(line => start.test(norm(line)));
    if (a < 0) return '';
    const b = lines.findIndex((line, i) => i > a && end?.test(norm(line)));
    return [lines[a].split(':').slice(1).join(':'), ...lines.slice(a + 1, b < 0 ? undefined : b)].join('\n').trim();
  };
  const profile = field(/^vaga$|^perfil$/) || String(email.subject || '').match(/\bvaga\s*[:#-]?\s*\d+\s*[-–—]\s*(.+)/i)?.[1]?.trim() || '';
  const requirements = section(/^conhecimento tecnico requerido/, /^conhecimento tecnico desejavel/);
  const requestId = requestLabelFromSubject(email.subject);
  const fields = {
    requestId, profile, seniority: field(/^senioridade$/), quantity: field(/^quantidade$/).match(/\d+/)?.[0] || '',
    workModel: ({ presencial: 'Presencial', remoto: 'Remoto', hibrido: 'Híbrido' })[norm(field(/^modelo de trabalho$/))] || field(/^modelo de trabalho$/),
    city: field(/^local da vaga \(cidade\)$|^cidade$/), state: field(/^local da vaga \(estado\)$|^estado$/),
    start: field(/^inicio$/), duration: field(/^prazo$|^duracao$/),
    language: field(/^idioma$/), minimumYears: requirements.match(/m[ií]nimo\s*(?:de\s*)?(\d+)\s*anos/i)?.[1] || '',
    coreSkill: profile.match(/SAP\s+(?:FI(?:CO)?|MM|SD|CO|ABAP)\b/i)?.[0] || '',
    mandatorySkills: requirements.match(/subm[oó]dulos\s+([^\n.]+)/i)?.[1] || '',
    requirements, desirable: [section(/^conhecimento tecnico desejavel/), ...lines.filter(line => /diferencial/i.test(line) && /agile/i.test(line))].filter(Boolean).join('\n'),
    instructions: lines.filter(line => /modelo em anexo|logos|identifique a consultoria|resumo da entrevista/i.test(line)).join('\n'),
    attachments: /anexo/i.test(body) ? 'Modelos mencionados no e-mail; arquivos não fornecidos neste teste.' : '',
    model: 'Alocação', contractType: 'PJ', observation: ''
  };
  const seniorityAssessment = applySeniority(fields, null, null, Boolean(fields.seniority));
  return { ...cleanIntakeFields(fields), seniorityAssessment };
}

export function cleanIntakeFields(input = {}) {
  const fields = { ...Object.fromEntries(INTAKE_FIELDS.map(key => [key, String(input[key] ?? '').trim().slice(0, 20000)])), contractType: 'PJ' };
  Object.assign(fields, normalizePlace(fields.city, fields.state));
  fields.start = normalizeStart(fields.start);
  return fields;
}

export function intakeWarnings(f) {
  const labels = { requestId: 'Identificação da solicitação ausente: conferir no assunto', seniority: 'Senioridade não informada', city: 'Cidade não informada', language: 'Idioma não informado', start: 'Início não informado', duration: 'Duração não informada', coreSkill: 'Competência principal pendente: preencher para buscar consultores' };
  const warnings = Object.entries(labels).filter(([key]) => !f[key]).map(([, text]) => text);
  if (/^[A-Z]{2}$/i.test(f.city)) warnings.push('Cidade abreviada: confirmar o município (não presumir a cidade).');
  if (/\bFA-(GL|AR|AP|AA)\b/i.test(f.mandatorySkills + '\n' + f.requirements)) warnings.push('Nomenclatura FA-GL/AR/AP/AA preservada. Confirme se corresponde a FI-GL/AR/AP/AA antes de avaliar a aderência.');
  if (f.start && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(f.start)) warnings.push('Início inválido: informar MM/AAAA.');
  if (f.attachments) warnings.push(f.attachments);
  return warnings;
}

export function matchIntakeCandidates(curriculums, f) {
  const plan = compileIntakeRequirements(f), seen = new Set();
  return curriculums.flatMap(cv => {
    const id = String(cv.id_controle || cv.id || '');
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const result = compareIntakeCurriculum(cv, f, plan);
    if (!result) return [];
    const blocked = !result.location.allowed || [cv.blackflag, cv.blacklist].some(v => v === true || ['true', 'sim', '1'].includes(String(v).toLowerCase()));
    return [{ id, name: cv.nome || cv.name || id, ...result, blocked }];
  }).sort((a, b) => Number(b.location.allowed) - Number(a.location.allowed) || b.rankingScore - a.rankingScore || a.name.localeCompare(b.name, 'pt-BR'));
}

function dttClient(db) {
  const exact = db.clients.filter(c => ['dtt', 'deloitte'].includes(norm(c.customerName || c.name)));
  const matches = exact.length ? exact : db.clients.filter(c => /\bdtt\b|deloitte/.test(norm(c.customerName || c.name)) && !/demo|demonstracao/.test(norm(c.customerName || c.name)));
  if (matches.length !== 1) fail('É necessário identificar um único cliente DTT na base local.');
  return matches[0];
}
const fingerprint = email => hash(norm(email.body).replace(/\s+/g, ' '));
const emailKey = email => hash(`${norm(email.mailbox)}|${norm(email.messageId) || `${norm(email.sender)}|${fingerprint(email)}`}`);
function duplicateOpportunity(db, draft, fields) {
  return db.opportunities.find(o => o.clientId === draft.clientId && (
    (fields.requestId && requestNumber(o.clientOpportunityCode) === requestNumber(fields.requestId)) ||
    ((!fields.requestId || !o.clientOpportunityCode || requestNumber(fields.requestId) === requestNumber(o.clientOpportunityCode)) &&
      (o.intakeSource?.emailKey === draft.emailKey || o.intakeSource?.bodyHash === draft.bodyHash))
  ));
}

// One serialized read/modify/atomic replace, so opportunity, links and audit commit together.
export function createIntakeStore(file, { baseUrl = 'http://127.0.0.1:3010', adapter, simulated = true } = {}) {
  const origin = new URL(baseUrl);
  if (simulated ? origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname) : origin.protocol !== 'https:' || !adapter) fail('Use endereço LOCAL para simulação; produção exige HTTPS e armazenamento transacional.');
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') fail('Endereço base inválido.');
  const read = () => adapter ? adapter.read() : fs.readFile(file, 'utf8').then(JSON.parse);
  const reviewLink = id => `${origin.origin}/?view=opportunityIntake&request=${encodeURIComponent(id)}`;
  let queue = Promise.resolve();
  const transaction = operation => {
    if (adapter) return adapter.transaction(operation);
    const run = queue.then(async () => {
      const db = JSON.parse(await fs.readFile(file, 'utf8'));
      db.opportunityIntakes ||= [];
      db.selectedCandidates ||= [];
      db.candidateMovements ||= [];
      const result = await operation(db);
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(db, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
        await fs.rename(temporary, file);
      } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
      return result;
    });
    queue = run.catch(() => {});
    return run;
  };
  const find = (db, id) => db.opportunityIntakes.find(d => d.id === id) || fail('Solicitação não encontrada.', 404);
  const prepareSearch = (db, draft) => {
    const candidates = matchIntakeCandidates(db.curriculums || [], draft.fields);
    const valid = new Set(candidates.filter(c => !c.blocked).map(c => c.id));
    const removedIds = (draft.selectedIds || []).filter(id => !valid.has(id));
    draft.selectedIds = (draft.selectedIds || []).filter(id => valid.has(id));
    draft.search = { version: INTAKE_MATCH_VERSION, candidates, totalEvaluated: (db.curriculums || []).length, searchedAt: new Date().toISOString(), fieldsHash: hash(JSON.stringify(draft.fields)) };
    return removedIds;
  };
  const view = (db, draft) => ({
    draft: { ...draft, search: draft.search ? { searchedAt: draft.search.searchedAt, totalEvaluated: draft.search.totalEvaluated } : null },
    candidates: (draft.search?.candidates || []).map(candidate => {
      const cv = (db.curriculums || []).find(c => String(c.id_controle || c.id) === candidate.id);
      const location = locationEligibility(cv || {}, draft.fields);
      const blocked = !cv || !location.allowed || [cv.blackflag, cv.blacklist].some(v => v === true || ['true', 'sim', '1'].includes(String(v).toLowerCase()));
      return { ...candidate, location, blocked, contact: { telefone: cv?.telefone || '' } };
    }), warnings: intakeWarnings(draft.fields),
    totalEvaluated: draft.search?.totalEvaluated || 0,
    searchReady: draft.search?.version === INTAKE_MATCH_VERSION,
    searchOutdated: Boolean(draft.search && draft.search.fieldsHash !== hash(JSON.stringify(draft.fields))),
    duplicateOpportunity: draft.status === 'pending' ? duplicateOpportunity(db, draft, draft.fields) || null : null,
    reviewLink: reviewLink(draft.id)
  });
  return {
    activate(now, user) {
      return transaction(db => {
        dttClient(db);
        for(const address of ['gerson@alcateiaconsulting.com.br','bruno@alcateiaconsulting.com.br']) if(!(db.users || []).some(u=>norm(u.email)===address && u.active!==false))fail('Revisor não cadastrado ou inativo: '+address);
        db.intakeRuntime ||= [];
        let runtime=db.intakeRuntime.find(r=>r.id==='hourly');
        if(!runtime){runtime={id:'hourly',checkpoint:now,activatedAt:now};db.intakeRuntime.push(runtime);}
        Object.assign(runtime,{enabled:true,activatedBy:user.id});return runtime;
      });
    },
    schedulerStatus() { return adapter?.readRuntime ? adapter.readRuntime() : read().then(db => (db.intakeRuntime || []).find(r => r.id === 'hourly') || null); },
    claimCycle(now, owner, startAt) {
      return transaction(db => {
        db.intakeRuntime ||= [];
        let runtime = db.intakeRuntime.find(r => r.id === 'hourly');
        if (!runtime) { runtime = { id: 'hourly', checkpoint: startAt || now, activatedAt: now }; db.intakeRuntime.push(runtime); }
        if ((runtime.leaseUntil && Date.parse(runtime.leaseUntil) > Date.parse(now)) || (runtime.lastStartedAt && Date.parse(now) - Date.parse(runtime.lastStartedAt) < 3600000)) return null;
        Object.assign(runtime, { owner, lastStartedAt: now, leaseUntil: new Date(Date.parse(now) + 55 * 60000).toISOString(), status: 'running' });
        return { ...runtime };
      });
    },
    finishCycle(owner, now, checkpoint, error = '') {
      return transaction(db => {
        const runtime = (db.intakeRuntime || []).find(r => r.id === 'hourly' && r.owner === owner);
        if (!runtime) return;
        if (checkpoint) runtime.checkpoint = checkpoint;
        Object.assign(runtime, { status: error ? 'error' : 'finished', lastFinishedAt: now, error, leaseUntil: now });
      });
    },
    claimReminder(draftId, to, now, owner) {
      return transaction(db => {
        const draft = find(db, draftId);
        if (draft.status !== 'pending' || duplicateOpportunity(db, draft, draft.fields)) return null;
        if (!(draft.reviewRecipients || []).some(r => r.email === to)) fail('Destinatário fora da revisão.');
        db.intakeNotifications ||= [];
        const prior = db.intakeNotifications.filter(n => n.draftId === draftId && n.to === to && n.attempt).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (prior && Date.parse(now) - Date.parse(prior.createdAt) < 3600000) return null;
        const entry = { id: randomUUID(), draftId, to, owner, type: 'dtt_opportunity_review', attempt: true, status: 'sending', createdAt: now, sentAt: null, link: reviewLink(draftId), opportunityName: draft.fields.requestId || draft.fields.profile, opportunityCode: requestNumber(draft.fields.requestId), simulated };
        db.intakeNotifications.push(entry);
        return { ...entry, subject: `Alcateia | Revisão pendente DTT: ${entry.opportunityName}`, text: `Uma oportunidade DTT aguarda sua revisão:\n${entry.opportunityName}\n\nConfira os dados e os candidatos já pesquisados:\n${entry.link}\n\nO acesso exige login. Gerson e Bruno acessam a mesma solicitação. Os lembretes são enviados a cada hora e encerrados após a gravação da oportunidade ou o cancelamento da solicitação.` };
      });
    },
    finishReminder(id, owner, status, now, error = '') {
      return transaction(db => {
        const entry = (db.intakeNotifications || []).find(n => n.id === id && n.owner === owner);
        if (!entry) fail('Tentativa de envio não encontrada.');
        Object.assign(entry, { status, sentAt: status === 'sent' ? now : null, finishedAt: now, error });
        return entry;
      });
    },
    upgradePending() {
      return transaction(db => {
        let updated = 0;
        for (const draft of db.opportunityIntakes.filter(d => d.status === 'pending' && (d.search?.version !== INTAKE_MATCH_VERSION || !d.subjectLabelVersion))) {
          const before = draft.fields;
          draft.fields = cleanIntakeFields(before);
          draft.fields.requestId = requestLabelFromSubject(draft.email.subject);
          draft.subjectLabelVersion = 1;
          draft.seniorityAssessment = applySeniority(draft.fields, draft.seniorityAssessment, before);
          draft.email.sender = INTAKE_SENDER;
          const removedIds = prepareSearch(db, draft);
          draft.revision++;
          draft.audit.push({ action: 'matching_rules_updated', version: INTAKE_MATCH_VERSION, at: new Date().toISOString(), removedIds });
          updated++;
        }
        return { updated, version: INTAKE_MATCH_VERSION };
      });
    },
    changePassword(userId, previousHash, newHash) {
      return transaction(db => {
        const user = (db.users || []).find(u => u.id === userId && u.active !== false);
        if (!user || user.passwordHash !== previousHash) fail('A senha foi alterada em outra sessão. Entre novamente.', 409);
        user.passwordHash = newHash;
        user.mustChangePassword = false;
        user.passwordChangedAt = new Date().toISOString();
        return { ok: true };
      });
    },
    async list() { await queue; const db = await read(); return (db.opportunityIntakes || []).map(({ search, ...draft }) => ({ ...draft, searchReady: !!search, reviewLink: reviewLink(draft.id) })); },
    async get(id) { await queue; const db = await read(); db.opportunityIntakes ||= []; return view(db, find(db, id)); },
    async notifications() { await queue; const db = await read(); return db.intakeNotifications || []; },
    async receive(email, user) {
      if (!String(email.subject || '').trim()) fail('O recebimento exige assunto no padrão SOLICITAÇÃO DE COTAÇÃO -.');
      const result = await this.create(email, user);
      return transaction(db => {
        const draft = find(db, result.draft.id);
        db.intakeNotifications ||= [];
        // Resends never overwrite another review or generate another invitation.
        if (draft.status === 'pending' && !draft.search) prepareSearch(db, draft);
        if (draft.status === 'pending' && !draft.receivedAt) {
          const recipients = ['gerson@alcateiaconsulting.com.br', 'bruno@alcateiaconsulting.com.br'].map(address => {
            const account = (db.users || []).find(u => norm(u.email) === address && u.active !== false);
            if (!account) fail(`Destinatário não cadastrado/ativo na base local: ${address}`);
            return { name: account.name, email: address };
          });
          draft.receivedAt = new Date().toISOString();
          draft.reviewRecipients = recipients;
          draft.audit.push({ action: 'received_and_searched', at: draft.receivedAt, userId: user.id, candidateCount: draft.search.candidates.length, simulated });
          for (const recipient of recipients) {
            if (db.intakeNotifications.some(n => n.draftId === draft.id && n.to === recipient.email)) continue;
            db.intakeNotifications.push({
              id: randomUUID(), draftId: draft.id, to: recipient.email, recipientName: recipient.name,
              subject: `Alcateia | DTT — revisão de oportunidade: ${draft.fields.profile || 'Perfil a conferir'}`,
              text: `Olá, ${recipient.name}.\n\nUma solicitação DTT está disponível para revisão: ${draft.fields.profile || 'Perfil a conferir'}.\nA pesquisa no banco de talentos foi concluída: ${draft.search.candidates.length} profissionais com evidências relacionadas, sujeitos à conferência.\n\nAcesse os dados da oportunidade e marque os profissionais que deseja selecionar:\n${reviewLink(draft.id)}\n\nVocê e o outro revisor acessam a mesma solicitação. A oportunidade só será cadastrada após Confirmar. O acesso exige login no sistema.\n\nPRÉVIA LOCAL — mensagem não enviada.`,
              link: reviewLink(draft.id), status: simulated ? 'simulated' : 'queued', simulated, createdAt: draft.receivedAt, sentAt: null
            });
          }
          if(!simulated) for(const n of db.intakeNotifications.filter(n=>n.draftId===draft.id)) n.text=n.text.replace('\n\nPRÉVIA LOCAL — mensagem não enviada.','');
        }
        return { ...view(db, draft), duplicate: result.duplicate, changed: result.changed || false, notifications: db.intakeNotifications.filter(n => n.draftId === draft.id), simulated };
      });
    },
    create(email, user) {
      return transaction(db => {
        if (norm(email.mailbox) !== 'gerson@alcateiaconsulting.com.br' || norm(email.sender) !== 'poolterceiros@deloitte.com') fail('Caixa ou remetente fora da regra DTT.');
        if (email.subject && !/^(?:(?:re|fw|fwd|enc):\s*)*solicitacao de cotacao\s*[-–—]/i.test(norm(email.subject))) fail('Assunto fora da regra SOLICITAÇÃO DE COTAÇÃO -.');
        if (!String(email.body || '').trim() || String(email.body).length > 100000) fail('Informe o corpo do e-mail (até 100 mil caracteres).');
        const client = dttClient(db), extracted = extractIntake(email), fields = cleanIntakeFields(extracted);
        const key = emailKey(email), bodyHash = fingerprint(email);
        const existing = db.opportunityIntakes.find(d => d.clientId === client.id && (
          (email.messageId && d.emailKey === key) ||
          (fields.requestId && requestNumber(d.fields.requestId) === requestNumber(fields.requestId)) ||
          ((!fields.requestId || !d.fields.requestId) && (d.emailKey === key || d.bodyHash === bodyHash))
        ));
        if (existing) return { draft: existing, duplicate: true, changed: existing.bodyHash !== bodyHash, warnings: intakeWarnings(existing.fields) };
        const draft = { id: randomUUID(), clientId: client.id, clientName: client.customerName || client.name, emailKey: key, bodyHash, email: { mailbox: email.mailbox, sender: INTAKE_SENDER, subject: String(email.subject || ''), messageId: String(email.messageId || ''), body: email.body }, fields, seniorityAssessment: extracted.seniorityAssessment, status: 'pending', subjectLabelVersion: 1, revision: 1, selectedIds: [], createdAt: new Date().toISOString(), createdBy: user.id, audit: [] };
        const duplicate = duplicateOpportunity(db, draft, fields);
        if (duplicate) { draft.status = 'duplicate'; draft.opportunityId = duplicate.id; }
        if (draft.status === 'pending') prepareSearch(db, draft);
        db.opportunityIntakes.push(draft);
        return { draft, duplicate: !!duplicate, warnings: intakeWarnings(fields) };
      });
    },
    review(id, fields, revision, user) {
      return transaction(db => {
        const draft = find(db, id);
        if (draft.status !== 'pending') fail('Solicitação já encerrada; não é possível editar.', 409);
        if (Number(revision) !== draft.revision) fail('A solicitação mudou em outra tela. Reabra antes de salvar.', 409);
        const previousFields = draft.fields;
        draft.fields = cleanIntakeFields(fields);
        draft.seniorityAssessment = applySeniority(draft.fields, draft.seniorityAssessment, previousFields);
        if (draft.fields.start && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(draft.fields.start)) fail('Início deve estar no formato MM/AAAA, com mês válido.');
        if (draft.fields.requestId && !/^\d+\b[^\r\n]*$/.test(draft.fields.requestId)) fail('A identificação deve iniciar pela numeração da vaga, seguida do título.');
        draft.revision++;
        draft.updatedAt = new Date().toISOString();
        draft.audit.push({ action: 'review', userId: user.id, at: draft.updatedAt });
        return { ...view(db, draft), removedIds: [] };
      });
    },
    select(id, revision, selectedIds, user) {
      return transaction(db => {
        const draft = find(db, id);
        if (draft.status !== 'pending' || Number(revision) !== draft.revision) fail('A solicitação foi alterada ou encerrada por outro revisor. Clique em Atualizar solicitação.', 409);
        if (!draft.search) fail('A pesquisa inicial ainda não está disponível.', 409);
        if (!Array.isArray(selectedIds)) fail('Lista de selecionados inválida.');
        const ids = [...new Set(selectedIds.map(String))];
        if (ids.some(id => !draft.search.candidates.some(c => c.id === id))) fail('Seleção inválida ou profissional impedido.');
        for (const id of ids) {
          if ((draft.selectedIds || []).includes(id)) continue; // Existing choices can be removed even if another one is now ineligible.
          const cv = db.curriculums.find(c => String(c.id_controle || c.id) === id);
          if (!cv || !locationEligibility(cv, draft.fields).allowed) fail('Localização fora do limite de 100 km ou a confirmar.');
          if ([cv.blackflag, cv.blacklist].some(v => v === true || ['true', 'sim', '1'].includes(String(v).toLowerCase()))) fail('Profissional impedido no banco.');
        }
        draft.selectedIds = ids;
        draft.revision++;
        draft.updatedAt = new Date().toISOString();
        draft.audit.push({ action: 'selection', userId: user.id, userName: user.name, at: draft.updatedAt, selectedIds: ids });
        return { draft: view(db, draft).draft };
      });
    },
    confirm(id, revision, selectedIds, user, acknowledged) {
      return transaction(db => {
        const draft = find(db, id);
        if (draft.status === 'confirmed') return { draft, opportunity: db.opportunities.find(o => o.id === draft.opportunityId), repeated: true };
        if (draft.status !== 'pending') fail('Solicitação cancelada ou duplicada; confirmação bloqueada.', 409);
        if (Number(revision) !== draft.revision) fail('Dados alterados. Atualize a solicitação antes de confirmar.', 409);
        const f = draft.fields;
        if (!f.profile || !f.requirements || !f.coreSkill || !Number.isInteger(Number(f.quantity)) || Number(f.quantity) < 1) fail('Preencha perfil, requisitos, competência principal e quantidade inteira maior que zero.');
        if (!['Presencial', 'Remoto', 'Híbrido', ''].includes(f.workModel)) fail('Modelo de trabalho inválido.');
        if (!['Alocação', 'Hunting', 'Projeto', 'Consultoria'].includes(f.model)) fail('Modelo da oportunidade inválido.');
        if (f.contractType !== 'PJ') fail('As solicitações DTT utilizam contratação PJ.');
        if (f.start && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(f.start)) fail('Início deve estar no formato MM/AAAA.');
        if (!db.clients.some(c => c.id === draft.clientId)) fail('Cliente DTT não encontrado.');
        if (duplicateOpportunity(db, draft, f)) fail('Já existe oportunidade para esta solicitação DTT. Nenhum vínculo foi criado.', 409);
        if (intakeWarnings(f).length && acknowledged !== true) fail('Confirme que revisou as pendências antes de cadastrar.');
        if (!Array.isArray(selectedIds)) fail('Lista de selecionados inválida.');
        const ids = [...new Set(selectedIds.map(String))];
        const matches = draft.search?.candidates || [];
        const selected = ids.map(id => matches.find(c => c.id === id) || fail('Um selecionado não corresponde à busca atual. Atualize a revisão.'));
        for (const id of ids) {
          const cv = db.curriculums.find(c => String(c.id_controle || c.id) === id);
          if (!cv || !locationEligibility(cv, f).allowed) fail('Selecionado fora do limite de 100 km ou com localização a confirmar.');
          if ([cv.blackflag, cv.blacklist].some(v => v === true || ['true', 'sim', '1'].includes(String(v).toLowerCase()))) fail('Profissional impedido no banco.');
        }
        const now = new Date().toISOString();
        const opportunity = { id: `opp_${randomUUID()}`, clientId: draft.clientId, opportunity: f.profile, opportunityCode: String(Math.max(0, ...db.opportunities.map(o => Number(o.opportunityCode) || 0)) + 1), clientOpportunityCode: requestNumber(f.requestId), status: 'Open', openingDate: now.slice(0, 10), monthYear: now.slice(0, 7), closingDate: '', model: f.model, contractType: 'PJ', workModel: f.workModel, owner: user.name || '', quantity: Number(f.quantity), closedQuantity: 0, contractValue: 0, jobDescription: `${f.requirements}\n\nDesejáveis:\n${f.desirable}\n\nLocal: ${f.city}/${f.state}\nSenioridade: ${f.seniority || 'A confirmar'}\nIdioma: ${f.language}\nInício: ${f.start}\nDuração: ${f.duration}`, observation: `${f.instructions}\n${f.attachments}\n${f.observation}`.trim(), intakeDetails: f, intakeSource: { draftId: draft.id, emailKey: draft.emailKey, bodyHash: draft.bodyHash }, createdAt: now };
        const links = selected.map(c => normalizeSelectedCandidate({ id: `sel_${randomUUID()}`, name: c.name, curriculumId: c.id, opportunityId: opportunity.id, source: 'Banco de Talentos', origin: simulated ? 'Solicitação DTT / teste LOCAL' : 'Solicitação DTT', score: c.score, observation: c.pending.join('\n'), createdAt: now, notifications: [] }));
        db.opportunities.push(opportunity);
        db.selectedCandidates.push(...links);
        db.candidateMovements.push(...links.map(c => normalizeCandidateMovement({ candidateId: c.id, curriculumId: c.curriculumId, candidateName: c.name, opportunityId: opportunity.id, opportunityCode: opportunity.opportunityCode, opportunityName: opportunity.opportunity, action: 'Selecionado para oportunidade', observation: simulated ? 'Confirmação da solicitação DTT no LOCAL. Nenhum e-mail enviado.' : 'Confirmação da solicitação DTT. Lembretes encerrados.', userId: user.id, userName: user.name, userEmail: user.email, date: now })));
        Object.assign(draft, { status: 'confirmed', opportunityId: opportunity.id, selectedIds: ids, confirmedAt: now, confirmedBy: user.id, confirmedByName: user.name, revision: draft.revision + 1 });
        draft.audit.push({ action: 'confirmed', userId: user.id, at: now, selectedIds: ids, warningsAcknowledged: acknowledged === true });
        return { draft, opportunity, selectedCount: links.length, emailsSent: 0 };
      });
    },
    cancel(id, revision, user) {
      return transaction(db => {
        const draft = find(db, id);
        if (draft.status === 'cancelled') return draft;
        if (draft.status !== 'pending' || Number(revision) !== draft.revision) fail('Solicitação alterada ou já encerrada.', 409);
        draft.status = 'cancelled';
        draft.cancelledAt = new Date().toISOString();
        draft.cancelledByName = user.name;
        draft.revision++;
        draft.audit.push({ action: 'cancelled', userId: user.id, at: new Date().toISOString() });
        return draft;
      });
    }
  };
}
