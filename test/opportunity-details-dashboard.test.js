import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

function extractFunction(source, name) {
  const start = source.search(new RegExp(`function ${name}\\(`));
  assert.ok(start >= 0, `funcao ${name} nao encontrada`);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('card Detalhes das oportunidades fica abaixo de Oportunidades abertas', () => {
  assert.match(app, /data-open-opportunity-details/);
  assert.match(app, /<span>Detalhes das oportunidades<\/span>/);
  assert.match(styles, /\.opportunity-details-launch-card\s*\{[\s\S]*grid-column:\s*4/);
});

test('formulario apresenta duas pizzas e o card de pendencias com detalhamento clicavel', () => {
  assert.match(app, /modal\.id = 'opportunityDetailsModal'/);
  assert.match(app, /Oportunidades por cliente/);
  assert.match(app, /Oportunidades em trabalho/);
  assert.match(app, /Sem candidatos vinculados/);
  assert.match(app, /data-opportunity-details-drill/);
  assert.match(app, /opportunityDetailsClient:/);
  assert.match(app, /opportunityDetailsWorking:/);
  assert.match(app, /opportunityDetailsWithoutCandidates/);
  assert.match(styles, /\.opportunity-details-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/);
});

test('calculo considera somente Open e inclui toda oportunidade sem candidatos, com ou sem responsavel', () => {
  const context = vm.createContext({
    state: {
      opportunities: [
        { id: 'o1', status: 'Open', clientId: 'c1', owner: 'Bruno', contractValue: 100, opportunityCode: 1 },
        { id: 'o2', status: 'Open', clientId: 'c1', owner: '', contractValue: 200, opportunityCode: 2 },
        { id: 'o3', status: 'Open', clientId: 'c2', owner: 'Gerson', contractValue: 300, opportunityCode: 3 },
        { id: 'o5', status: 'Open', clientId: 'c2', owner: 'Bruno', contractValue: 500, opportunityCode: 5 },
        { id: 'o4', status: 'Closed', clientId: 'c2', owner: '', contractValue: 400, opportunityCode: 4 },
      ],
    },
    normalizeText: (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    linkedCandidatesForOpportunity: (id) => ({ o1: [{}], o2: [], o3: [{}], o4: [], o5: [] }[id] || []),
    clientNameById: (id) => ({ c1: 'Cliente 1', c2: 'Cliente 2' }[id] || 'Sem cliente'),
    byOpportunityCode: (first, second) => first.opportunityCode - second.opportunityCode,
  });
  vm.runInContext([
    extractFunction(app, 'opportunityOwnerLabel'),
    extractFunction(app, 'groupOpportunityDetails'),
    extractFunction(app, 'buildOpportunityDetailsSnapshot'),
  ].join('\n'), context);

  const snapshot = context.buildOpportunityDetailsSnapshot();
  assert.equal(snapshot.openOpportunities.length, 4);
  assert.equal(snapshot.workingOpportunities.length, 2);
  assert.equal(snapshot.opportunitiesWithoutCandidates.length, 2);
  assert.deepEqual(
    Array.from(snapshot.opportunitiesWithoutCandidates, (opportunity) => opportunity.id),
    ['o2', 'o5']
  );
  assert.equal(snapshot.withoutCandidatesValue, 700);
  assert.deepEqual(
    Array.from(snapshot.clientGroups, (item) => [item.label, item.value]),
    [['Cliente 1', 2], ['Cliente 2', 2]]
  );
  assert.deepEqual(
    Array.from(snapshot.ownerGroups, (item) => [item.label, item.value]),
    [['Bruno', 1], ['Gerson', 1]]
  );
});

test('pizzas e card abrem tabela analitica e o modal segue barras padronizadas', () => {
  assert.match(app, /openDashboardAnalytics\(opportunityDetailsDrill\.dataset\.opportunityDetailsDrill\)/);
  assert.match(app, /rows:\s*rows\.map\(\(opportunity\) => opportunityAnalyticsRow\(opportunity, false\)\)/);
  assert.match(app, /function promoteSurfaceDialog\(dialog\)/);
  assert.match(app, /dialog\.style\.zIndex = String\(Math\.max\(baseZIndex, topVisibleZIndex \+ 1\)\)/);
  assert.match(app, /promoteSurfaceDialog\(dialog\);\s*dialog\.classList\.remove\('hidden'\)/);
  assert.match(styles, /\.opportunity-details-legend\s*\{[\s\S]*overflow-y:\s*scroll/);
  assert.match(styles, /\.opportunity-details-modal-card\s*\{[\s\S]*width:\s*min\(96vw, 1600px\)/);
});

test('detalhamento aberto sobre outro formulario recebe a camada superior', () => {
  const parentDialog = {
    style: {
      zIndex: '45',
      removeProperty() {}
    }
  };
  const detailDialog = {
    style: {
      zIndex: '',
      removeProperty() { this.zIndex = ''; }
    }
  };
  const context = vm.createContext({
    window: {
      getComputedStyle(element) {
        return { zIndex: element.style.zIndex || '45' };
      }
    },
    $$: () => [parentDialog, detailDialog],
  });
  vm.runInContext(extractFunction(app, 'promoteSurfaceDialog'), context);

  context.promoteSurfaceDialog(detailDialog);

  assert.equal(detailDialog.style.zIndex, '46');
});
