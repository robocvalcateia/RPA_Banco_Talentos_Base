import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('Voltar usa histórico de uma tela e preserva a tela anterior', () => {
  assert.match(app, /navigationHistory:\s*\[\]/);
  assert.match(app, /function goBackOneScreen\(\)/);
  assert.match(app, /state\.navigationHistory\.pop\(\)/);
  assert.match(app, /showView\(previous\.viewId, \{ skipHistory: true, restoreScrollY: previous\.scrollY \}\)/);
  assert.match(app, /button\.addEventListener\('click', returnToPreviousLauncherMenu\)/);
});

test('oportunidades Open com menos de tres candidatos ficam vermelhas e a tabela rola horizontalmente', () => {
  assert.match(app, /opportunity\.status === 'Open' && linkedCandidateCount < 3/);
  assert.match(app, /opportunity-needs-candidates/);
  assert.match(styles, /\.opportunity-needs-candidates > td/);
  assert.match(styles, /\.dashboard-analytics-table\s*\{[\s\S]*min-width: 1680px/);
  assert.match(styles, /#opportunities \.table-wrap\s*\{[\s\S]*overflow-x: auto/);
});

test('edicao oferece candidatos vinculados e busca exclusiva no Banco Alcateia', () => {
  assert.match(html, /id="opportunityLinkedCandidatesButton"/);
  assert.match(html, /id="opportunitySearchCandidatesButton"/);
  assert.match(app, /openOpportunityCandidateSearch/);
  assert.match(app, /Vincular selecionados/);
  assert.match(server, /candidate-search\$\/\.test\(pathname\)/);
  assert.match(server, /searchAlcateia: true/);
  assert.match(server, /searchApinfo: false/);
  assert.match(server, /searchLinkedin: false/);
  assert.match(server, /Este profissional ja esta vinculado a oportunidade/);
});

test('botoes de acao usam uma unica dimensao e o verde Alcateia em todo o sistema', () => {
  assert.match(styles, /--action-button-width:\s*180px/);
  assert.match(styles, /--action-button-height:\s*52px/);
  assert.match(styles, /\.primary-action,[\s\S]*\.secondary-action,[\s\S]*\.danger-action,[\s\S]*\.ghost-action,[\s\S]*\.compact-action,[\s\S]*background:\s*var\(--alcateia-green\)/);
  assert.doesNotMatch(styles, /--action-button-width:\s*132px/);
  assert.doesNotMatch(styles, /--action-button-height:\s*42px/);
  assert.match(styles, /button\[aria-label="Fechar"\]:not\(\.surface-window-control\)[\s\S]*width:\s*36px/);
});

test('usuario pode assumir oportunidade de outro responsavel com confirmacao e alertas', () => {
  assert.match(html, /id="opportunityClaimButton"[^>]*disabled[^>]*>Pegar Oportunidade<\/button>/);
  assert.match(html, /id="opportunityCandidateActions" style="display: grid; grid-template-columns: repeat\(2, var\(--action-button-width\)\);/);
  assert.match(html, /Candidatos vinculados<\/button>[\s\S]*Procurar novos candidatos<\/button>[\s\S]*Salvar oportunidade<\/button>[\s\S]*Pegar Oportunidade<\/button>/);
  assert.match(app, /\$\$\('\[data-opportunity-edit-action\]'[^\n]+setAttribute\('hidden'/);
  assert.match(app, /\$\$\('\[data-opportunity-edit-action\]'[^\n]+removeAttribute\('hidden'/);
  assert.match(app, /function currentUserOwnsOpportunity\(opportunity\)/);
  assert.match(app, /Confirma a transferência desta oportunidade para sua responsabilidade\?/);
  assert.match(app, /\/api\/opportunities\/\$\{encodeURIComponent\(opportunityId\)\}\/claim/);
  assert.ok(server.includes("/^\\/api\\/opportunities\\/[^/]+\\/claim$/"));
  assert.match(server, /Responsabilidade transferida de \$\{previousOwner \|\| 'Não informado'\} para \$\{currentOwner\}/);
  assert.match(server, /notifyOpportunityResponsibilityTransfer/);
  assert.match(server, /previous_owner/);
  assert.match(server, /current_owner/);
});
