import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  enrichStatusReport,
  enrichStatusReportMessage,
  MONGO_APP_COLLECTIONS,
  normalizeDatabase,
  normalizeStatusReportMessage,
  normalizeStatusReport
} from '../db.js';

test('status report normaliza estrutura executiva e farol', () => {
  const report = normalizeStatusReport({
    clienteId: 'client_1',
    consultorId: 'alloc_1',
    periodo: 'Julho/2026',
    farol: 'amarelo',
    resumoExecutivo: 'Acompanhamento estavel',
    tarefas: 'Entrega 1\nEntrega 2',
    pontosAtencao: 'Dependencia do cliente'
  });

  assert.equal(report.clientId, 'client_1');
  assert.equal(report.allocatedId, 'alloc_1');
  assert.equal(report.period, 'Julho/2026');
  assert.equal(report.statusLight, 'amarelo');
  assert.equal(report.referenceMonth, '2026-07');
  assert.equal(report.executiveSummary, 'Acompanhamento estavel');
  assert.match(report.governanceNote, /Gestao diaria/);
});

test('status report preserva farol vazio ate escolha do consultor', () => {
  const report = normalizeStatusReport({
    clienteId: 'client_1',
    consultorId: 'alloc_1',
    periodo: 'Agosto/2026',
    resumoExecutivo: 'Atualizacao mensal'
  });

  assert.equal(report.statusLight, '');
});

test('base normalizada cria colecao de status reports e enriquece cliente e consultor', () => {
  const db = normalizeDatabase({
    clients: [{ id: 'client_1', customerName: 'Totvs', managerContactName: 'Eloi' }],
    allocateds: [{ id: 'alloc_1', code: 'P-1', consultant: 'Maria Silva', clientId: 'client_1', consultantEmail: 'maria@example.com', manager: 'Pedro Gestor', managerEmail: 'pedro@example.com' }],
    statusReports: [{ clientId: 'client_1', allocatedId: 'alloc_1', period: 'Julho/2026', executiveSummary: 'Tudo ok' }]
  });

  assert.equal(db.statusReports.length, 1);
  const enriched = enrichStatusReport(db.statusReports[0], db);
  assert.equal(enriched.clientName, 'Totvs');
  assert.equal(enriched.consultantName, 'Maria Silva');
  assert.equal(enriched.managerName, 'Pedro Gestor');
  assert.equal(enriched.managerEmail, 'pedro@example.com');
  assert.equal(enriched.clientManagerName, 'Eloi');
});

test('status reports fazem parte das colecoes operacionais do Mongo app', () => {
  assert.ok(MONGO_APP_COLLECTIONS.includes('statusReports'));
});

test('status report remove preview one page da tela principal', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

  assert.doesNotMatch(indexSource, /One page view/);
  assert.doesNotMatch(indexSource, /Exportar imagem/);
  assert.doesNotMatch(indexSource, /Enviar avalia/);
  assert.doesNotMatch(indexSource, /statusReportPreview/);
  assert.doesNotMatch(appSource, /statusReportPreview/);
  assert.doesNotMatch(appSource, /statusReportExportImageButton/);
  assert.doesNotMatch(appSource, /statusReportExportPdfButton/);
  assert.match(appSource, /Status_\$\{statusReportFilenamePart\(report\.consultantName/);
  assert.match(appSource, /ALCATEIA - Relat.rio Acompanhamento Consultor/);
  assert.match(appSource, /mailto:/);
});

test('status report mensal separa formulario, parametros e gestao', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const stylesSource = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(indexSource, /Status Entregues/);
  assert.doesNotMatch(indexSource, /data-status-report-panel="delivered"/);
  assert.doesNotMatch(indexSource, /Mensagens Status/);
  assert.match(indexSource, /Par.metros Status/);
  assert.match(indexSource, /Gest.o dos Status/);
  assert.match(indexSource, /data-status-report-panel="parameters"/);
  assert.match(indexSource, /data-status-report-panel="management"/);
  assert.match(indexSource, /data-status-report-panel="management" data-admin-only hidden/);
  assert.match(indexSource, /data-status-report-panel="parameters" data-admin-only hidden/);
  assert.match(indexSource, /id="statusReportMessageFilterClient"/);
  assert.match(indexSource, /id="statusReportDispatchRecipients"/);
  assert.match(indexSource, /id="statusReportDispatchSelectAll"/);
  assert.match(indexSource, /id="statusReportDispatchButton"/);
  assert.match(indexSource, /value="Consultor"/);
  assert.match(indexSource, /name="active"/);
  assert.match(appSource, /function isCurrentUserConsultant/);
  assert.match(appSource, /activeStatusReportPanel/);
  assert.match(appSource, /Salvar atualiza..o do m.s/);
  assert.match(appSource, /renderStatusReportMessages/);
  assert.match(appSource, /renderStatusReportDispatchRecipients/);
  assert.match(appSource, /filteredStatusReportMessages/);
  assert.match(appSource, /refreshStatusReportMessagesFromApi/);
  assert.match(appSource, /statusReportMessagesFetched/);
  assert.match(appSource, /api\('\/api\/status-report-messages'\)/);
  assert.match(appSource, /statusReportDispatchRecipients/);
  assert.match(appSource, /statusReportMessageForm/);
  assert.match(appSource, /\/api\/admin\/status-reports\/monthly-cycle/);
  assert.match(appSource, /forceInvite:\s*true/);
  assert.match(appSource, /forceReminder:\s*true/);
  assert.match(appSource, /allocatedIds:\s*selectedIds/);
  assert.match(appSource, /state\.activeStatusReportPanel = node\.panel \|\| \(isCurrentUserConsultant\(\) \? 'consultant' : 'editor'\)/);
  assert.match(appSource, /element\.hidden = Boolean\(element\.dataset\.statusPanel\)/);
  assert.match(serverSource, /buildStatusReportUrl/);
  assert.match(serverSource, /request\.method === 'GET' && pathname === '\/api\/status-report-messages'/);
  assert.match(serverSource, /Apenas administradores podem consultar mensagens de status report/);
  assert.match(serverSource, /runMonthlyStatusReportCycle/);
  assert.match(serverSource, /sentInviteThisRun/);
  assert.match(serverSource, /!sentInviteThisRun && isOpen/);
  assert.match(serverSource, /startStatusReportReminderJob/);
  assert.match(serverSource, /consultantSubmission/);
  assert.match(serverSource, /statusReportMessageForClient/);
  assert.match(serverSource, /ensureStatusReportEmailLink/);
  assert.match(serverSource, /statusReportCycleTargetMatches/);
  assert.match(serverSource, /emails:\s*Array\.isArray\(payload\.emails\)/);
  assert.match(serverSource, /allocatedIds:\s*Array\.isArray\(payload\.allocatedIds\)/);
  assert.match(serverSource, /statusLight:\s*''/);
  assert.match(serverSource, /alcateiaOwner:\s*previous\.alcateiaOwner \|\| 'Gerson'/);
  assert.match(serverSource, /Usuario inativo/);
  assert.match(serverSource, /syncAllocatedConsultantUsersOnStartup/);
  assert.match(serverSource, /hasActiveAllocation/);
  assert.match(serverSource, /writeDatabaseCollections\(db, \['users'\]\)/);
  assert.match(serverSource, /canUseExternalUserEmail/);
  assert.match(serverSource, /perfis Admin\/Gestao/);
  assert.match(serverSource, /consultantCanAccessApi/);
  assert.match(serverSource, /Perfil consultor tem acesso apenas ao modulo de Status Report/);
  assert.match(serverSource, /canUserAccessStatusReport/);
  assert.match(appSource, /currentConsultantDraftReport/);
  assert.match(appSource, /statusReportBelongsToCurrentConsultant/);
  assert.match(appSource, /Acesso restrito ao Status Report/);
  assert.match(indexSource, /textarea name="tasks" rows="5" required/);
  assert.match(indexSource, /textarea name="nextSteps" rows="5" required/);
  assert.match(indexSource, /textarea name="attentionPoints" rows="5" required/);
  assert.match(indexSource, /textarea name="risks" rows="5" required/);
  assert.match(indexSource, /textarea name="recommendedActions" rows="3" required/);
  assert.match(indexSource, /textarea name="governanceNote" rows="2" required placeholder="Observa..es de governan.a do per.odo"/);
  assert.match(appSource, /fillStatusReportLockedDefaults/);
  assert.match(appSource, /\['allocatedId', 'clientName', 'period', 'reportDate', 'alcateiaOwner'\]/);
  assert.match(appSource, /CONSULTANT_STATUS_REPORT_REQUIRED_FIELDS/);
  assert.match(appSource, /Preencha os campos obrigat.rios antes de salvar/);
  assert.match(appSource, /executiveSummary:\s*''/);
  assert.match(appSource, /governanceNote:\s*''/);
  assert.match(indexSource, /id="statusReportFilterMonth"/);
  assert.match(indexSource, /id="statusReportFilterStatus"/);
  assert.match(indexSource, /status-report-management-filter-bar/);
  assert.match(indexSource, /<th>E-mail enviado<\/th>/);
  assert.match(indexSource, /<th>Salvo em<\/th>/);
  assert.match(indexSource, /<th>.ltimo lembrete<\/th>/);
  assert.match(appSource, /statusReportFilter:\s*\{ clientId: '', allocatedId: '', statusLight: '', month: '', deliveryStatus: '' \}/);
  assert.match(appSource, /statusReportMatchesDeliveryMonth/);
  assert.match(appSource, /statusReportSentDateLabel/);
  assert.match(appSource, /statusReportDateTimeLabel/);
  assert.match(appSource, /report\.monthlyEmailSentAt/);
  assert.match(appSource, /report\.consultantSubmittedAt/);
  assert.match(appSource, /report\.reportDate/);
  assert.match(appSource, /report\.referenceMonth/);
  assert.doesNotMatch(indexSource, /id="statusReportDeliveryStatus"/);
  assert.doesNotMatch(appSource, /statusFilter = \$\('#statusReportDeliveryStatus'\)/);
  assert.match(appSource, /statusReportDeliveryStatus\(report\) === state\.statusReportFilter\.deliveryStatus/);
  assert.match(indexSource, /<th>Status<\/th>/);
  assert.match(appSource, /function renderStatusReportLightCell/);
  assert.match(appSource, /if \(!light\) return '<span>-<\/span>'/);
  assert.doesNotMatch(appSource, /function statusReportDisplayDate/);
  assert.match(appSource, /function statusReportOwnerLabel/);
  assert.match(appSource, /return 'Gerson'/);
  assert.match(appSource, /: 'Pendente'/);
  assert.match(serverSource, /missingConsultantStatusReportFields/);
  assert.match(serverSource, /Preencha os campos obrigatorios antes de salvar/);
  assert.match(serverSource, /Object\.hasOwn\(writablePayload, 'consultantSubmittedAt'\)/);
  assert.doesNotMatch(serverSource, /Informe o resumo executivo/);
  assert.match(stylesSource, /\[hidden\]\s*\{\s*display: none !important;/);
  assert.match(stylesSource, /status-report-management-filter-bar/);
});

test('mensagem de status report normaliza cliente todos e enriquece nome', () => {
  const message = normalizeStatusReportMessage({
    assunto: 'Status {{periodo}}',
    mensagem: 'Ola {{consultor}}, acesse {{link}}',
    ativo: 'Sim'
  });
  assert.equal(message.clientId, '');
  assert.equal(message.active, true);

  const enriched = enrichStatusReportMessage(message, { clients: [] });
  assert.equal(enriched.clientName, 'Todos');
});
