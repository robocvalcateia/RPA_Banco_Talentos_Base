/* Integrated local review screen. All content from emails/CVs is escaped as text. */
window.OpportunityIntake = (() => {
  const fields = {
    requestId: 'Identificação da solicitação', profile: 'Perfil / título da vaga', seniority: 'Senioridade', quantity: 'Quantidade',
    workModel: 'Modelo de trabalho', city: 'Cidade', state: 'Estado', start: 'Início previsto (MM/AAAA)', duration: 'Duração da contratação',
    language: 'Idioma e nível', minimumYears: 'Mínimo de anos solicitado', coreSkill: 'Competência principal para busca', mandatorySkills: 'Competências / submódulos obrigatórios',
    model: 'Modelo da oportunidade', contractType: 'Tipo de contratação', requirements: 'Requisitos obrigatórios e experiência', desirable: 'Diferenciais', instructions: 'Orientações do cliente', attachments: 'Modelos / anexos pendentes', observation: 'Observações'
  };
  const long = new Set(['requirements', 'desirable', 'instructions', 'attachments', 'observation', 'mandatorySkills']);
  const options = { workModel: ['', 'Presencial', 'Híbrido', 'Remoto'], model: ['Alocação', 'Hunting', 'Projeto', 'Consultoria'] };
  let root, draft, candidates = [], selected = new Set(), page = 0, dirty = true, busy = false;
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const q = selector => root.querySelector(selector);
  const statusNames = { pending: 'Pendente', confirmed: 'Confirmada', cancelled: 'Cancelada', duplicate: 'Duplicada' };
  function message(text, error = false) { q('#intakeStatus').textContent = text; q('#intakeStatus').classList.toggle('intake-error', error); }
  async function run(fn) {
    if (busy) return;
    busy = true;
    root.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await fn(); } catch (error) { message(error.message, true); }
    finally { busy = false; root.querySelectorAll('button').forEach(b => b.disabled = false); controls(); }
  }
  function controls() {
    const pending = draft?.status === 'pending';
    if (q('#intakeConfirm')) q('#intakeConfirm').disabled = busy || !pending || dirty;
    if (q('#intakeCancel')) q('#intakeCancel').disabled = busy || !pending;
    if (q('#intakeSearch')) q('#intakeSearch').disabled = busy || !pending;
    root.querySelectorAll('[data-select]').forEach(b => b.disabled = busy || !pending || dirty || (b.dataset.blocked === 'true' && !selected.has(b.dataset.select)));
    root.querySelectorAll('[data-wapp]').forEach(b => b.disabled = busy || b.dataset.available !== 'true');
    if (q('#selectedCount')) q('#selectedCount').textContent = `${selected.size} profissional(is) selecionado(s)`;
    if (q('#intakePrevious')) q('#intakePrevious').disabled = busy || page === 0;
    if (q('#intakeNext')) q('#intakeNext').disabled = busy || (page + 1) * 20 >= candidates.length;
  }
  async function load() {
    message('Carregando a oportunidade e a pesquisa de candidatos…');
    let id = new URLSearchParams(location.search).get('request');
    if (!id) {
      const { drafts } = await api('/api/intake/drafts');
      id = drafts.slice().reverse().find(d => d.status === 'pending' && d.searchReady)?.id;
      if (!id) { message('Nenhuma solicitação pronta para revisão. Acesse pelo link recebido.'); return; }
    }
    const result = await api(`/api/intake/${encodeURIComponent(id)}`);
    const url = new URL(location.href); url.searchParams.set('view', 'opportunityIntake'); url.searchParams.set('request', id);
    window.history.replaceState(null, '', url);
    edit(result);
    message(result.draft.status === 'pending' ? 'Candidatos pesquisados. Revise a oportunidade e marque os profissionais desejados.' : 'Esta solicitação já foi encerrada. Os dados abaixo estão disponíveis para consulta.');
  }
  function edit(result) {
    const d = result.draft, warnings = result.warnings || [];
    draft = d; selected = new Set(d.selectedIds || []); candidates = result.candidates || []; page = 0;
    dirty = !result.searchReady || !!result.duplicateOpportunity;
    q('#intakeReview').hidden = false;
    const actor = d.status === 'confirmed' ? d.confirmedByName : d.cancelledByName;
    q('#intakeClient').textContent = `${d.clientName} · ${statusNames[d.status]}${actor ? ` por ${actor}` : ''} · ${d.status === 'confirmed' ? 'Oportunidade cadastrada como Open' : 'Status ao cadastrar: Open'}`;
    q('#intakeShared').textContent = `Revisão compartilhada: ${(d.reviewRecipients || []).map(r => r.name).join(' e ') || 'equipe interna'}. As seleções são salvas a cada clique.`;
    q('#intakeSearchInfo').textContent = d.search ? `${candidates.length} profissionais encontrados · ${result.totalEvaluated} currículos avaliados · Pesquisa em ${new Date(d.search.searchedAt).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}` : 'Pesquisa ainda não disponível.';
    if (result.searchOutdated) q('#intakeSearchInfo').textContent += ' · Revisão alterada após a pesquisa. Lista e percentuais preservados da pesquisa inicial; confira a adequação aos dados editados.';
    q('#intakeJump').textContent = `Ver candidatos (${candidates.length})`;
    q('#intakeOriginal').textContent = `Assunto: ${d.email.subject || 'Não fornecido no teste'}\nRemetente: poolterceiros@deloitte.com\n\n${d.email.body}`;
    q('#intakeFields').innerHTML = Object.entries(fields).map(([key, label]) => {
      const value = e(d.fields[key]);
      const control = key === 'contractType' ? '<input name="contractType" value="PJ" readonly aria-label="Tipo de contratação fixo PJ">' : options[key] ? `<select name="${key}">${options[key].map(v => `<option value="${e(v)}" ${v === d.fields[key] ? 'selected' : ''}>${e(v || 'Não informado')}</option>`).join('')}</select>` : long.has(key) ? `<textarea name="${key}" rows="${key === 'requirements' ? 9 : 3}">${value}</textarea>` : `<input name="${key}" value="${value}" ${['quantity', 'minimumYears'].includes(key) ? 'type="number" min="0" step="1"' : ''}>`;
      return `<label class="${long.has(key) ? 'intake-wide' : ''}">${e(label)}${control}</label>`;
    }).join('');
    const startInput = q('#intakeFields [name=start]'); startInput.placeholder = 'MM/AAAA'; startInput.pattern = '(0[1-9]|1[0-2])/[0-9]{4}'; startInput.maxLength = 7;
    q('#intakeFields').disabled = d.status !== 'pending';
    q('#intakeWarnings').innerHTML = (warnings.length ? `<strong>Conferir antes de confirmar</strong><ul>${warnings.map(w => `<li>${e(w)}</li>`).join('')}</ul>` : '') + (result.duplicateOpportunity ? '<p>Já existe oportunidade para esta solicitação. Confirmação bloqueada.</p>' : '');
    const assessment = d.seniorityAssessment;
    q('#intakeSeniority').innerHTML = assessment ? `<details class="intake-analysis"><summary>Senioridade: ${e(d.fields.seniority || 'A confirmar')} · ${assessment.origin === 'market' ? 'sugerida por análise de mercado' : assessment.origin === 'email' ? 'informada no e-mail' : assessment.origin === 'manual' ? 'ajustada na revisão' : 'a confirmar'}</summary><p>${e(assessment.rationale)}</p><p>Referências consultadas em ${e(assessment.referenceDate)}. Nível editável; sem consulta automática à internet a cada e-mail.</p><ul>${(assessment.sources || []).map(s => `<li><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)}</a> — ${e(s.summary)}</li>`).join('')}</ul></details>` : '';
    q('#intakeAcknowledge').checked = false;
    q('#intakeAcknowledge').disabled = d.status !== 'pending';
    renderCandidates();
    controls();
  }
  function renderCandidates() {
    const rows = candidates.slice(page * 20, (page + 1) * 20);
    q('#intakeCandidates').innerHTML = `<p>${candidates.length} profissional(is) com evidência relacionada. O percentual de aderência considera apenas requisitos técnicos identificados. A cobertura mostra quanto da vaga pôde ser avaliado; percentual alto com cobertura baixa exige conferência. Comportamentais e diferenciais ficam fora da nota. Localização não identificada bloqueia a seleção.</p>
      ${rows.map(c => `<article class="intake-candidate ${selected.has(c.id) ? 'selected' : ''}"><div class="intake-actions"><h3>${e(c.name)} · ID ${e(c.id)}</h3><button type="button" data-select="${e(c.id)}" data-blocked="${c.blocked}" aria-pressed="${selected.has(c.id)}">${selected.has(c.id) ? '✓ Selecionado' : 'Selecionado'}</button><button type="button" data-wapp="${e(c.id)}" data-available="${Boolean(curriculumWhatsappUrl(c.contact))}" title="${curriculumWhatsappUrl(c.contact) ? 'Abrir conversa no WhatsApp' : 'Celular válido com DDD não cadastrado'}">Wapp</button></div>
        <p>${c.classification === 'approved' ? 'Triagem técnica favorável' : 'Requer conferência técnica'} · Aderência nos requisitos identificados: ${c.score === null ? 'A confirmar' : `${c.score}%`} · Cobertura dos requisitos técnicos: ${c.evidenceCoverage}%${c.blocked ? ' · Seleção bloqueada: confira a localização e os impedimentos cadastrais' : ''}</p>
        <p>${e(c.location?.detail || '')}</p>
        <p>${c.sourcesRead?.length || 0} fontes textuais examinadas · ${c.charactersRead || 0} caracteres.</p>
        <details><summary>Comparação requisito a requisito</summary><div class="intake-comparison"><table><thead><tr><th>Requisito</th><th>Resultado</th><th>Evidência / fonte</th></tr></thead><tbody>${(c.comparison || []).map(x => `<tr><td>${e(x.requirement)}<br><small>${x.group === 'desirable' ? 'Diferencial' : x.group === 'operational' ? 'Condição da vaga' : x.group === 'behavioral' ? 'Comportamental — fora do cálculo' : x.group === 'review' ? 'Detalhe a revisar — fora do cálculo' : 'Obrigatório'}</small></td><td>${e(({ evidence: 'Evidência declarada', mention: 'Menção / parcial', unknown: 'A confirmar', conflict: 'Divergência', ambiguous: 'Equivalência a validar', interview: 'Avaliar na entrevista' })[x.status] || x.status)}<br>${e(x.detail)}</td><td>${e(x.excerpt || 'Sem trecho específico localizado')}<br><small>${e(x.source || '')}</small></td></tr>`).join('')}</tbody></table></div></details>
        <details><summary>Evidências no currículo (${c.evidence.length})</summary><ul>${c.evidence.map(x => `<li><strong>${e(x.requirement)}</strong>: ${e(x.excerpt)}</li>`).join('')}</ul></details>
        <details><summary>Pendências a conferir (${c.pending.length})</summary><ul>${c.pending.map(p => `<li>${e(p)}</li>`).join('')}</ul></details>
        <details><summary>Consultar texto do currículo</summary><pre>${e(c.cvText)}</pre></details></article>`).join('')}
      <div class="intake-actions"><button type="button" id="intakePrevious">Anterior</button><span>Página ${page + 1} de ${Math.max(1, Math.ceil(candidates.length / 20))}</span><button type="button" id="intakeNext">Próxima</button></div>`;
    root.querySelectorAll('[data-wapp]').forEach(b => b.onclick = () => { const c = candidates.find(item => item.id === b.dataset.wapp); const url = curriculumWhatsappUrl(c?.contact); if (url) window.open(url, '_blank', 'noopener'); });
    q('#intakePrevious').onclick = () => { if (page > 0) { page--; renderCandidates(); } };
    q('#intakeNext').onclick = () => { if ((page + 1) * 20 < candidates.length) { page++; renderCandidates(); } };
    root.querySelectorAll('[data-select]').forEach(b => b.onclick = () => run(async () => {
      const next = new Set(selected), id = b.dataset.select;
      next.has(id) ? next.delete(id) : next.add(id);
      const result = await api(`/api/intake/${draft.id}/select`, { method: 'POST', body: JSON.stringify({ revision: draft.revision, selectedIds: [...next] }) });
      draft = result.draft; selected = new Set(draft.selectedIds); renderCandidates();
      message('Seleção salva e disponível para os dois revisores.');
    }));
    controls();
  }
  async function review() {
    if (!q('#intakeForm').reportValidity()) return;
    message('Salvando a revisão da oportunidade…');
    const form = Object.fromEntries(new FormData(q('#intakeForm')).entries());
    const result = await api(`/api/intake/${draft.id}/review`, { method: 'POST', body: JSON.stringify({ revision: draft.revision, fields: form }) });
    edit(result);
    message('Revisão salva. Lista de candidatos e seleções preservadas; nenhuma nova busca executada.');
  }
  function mount() {
    if (root) return;
    root = document.createElement('section'); root.className = 'view'; root.id = 'opportunityIntake';
    document.getElementById('opportunities').insertAdjacentElement('afterend', root);
    root.innerHTML = `<div id="intakeStatus" class="intake-status" role="status" aria-live="polite"></div>
      <div class="intake-actions"><button id="intakeReload" type="button">Atualizar solicitação</button></div>
      <section class="panel" id="intakeReview" hidden><h2>Dados da oportunidade</h2><p id="intakeClient"></p><p id="intakeShared"></p>
      <div class="intake-actions"><span id="intakeSearchInfo"></span><button id="intakeJump" type="button">Ver candidatos</button></div>
      <label>E-mail de origem<input value="poolterceiros@deloitte.com" readonly></label><details><summary>Conteúdo do e-mail original</summary><pre id="intakeOriginal"></pre></details><div id="intakeSeniority"></div>
      <form id="intakeForm"><fieldset class="intake-grid" id="intakeFields"></fieldset></form>
      <div id="intakeWarnings" class="intake-warning"></div><div class="intake-actions"><button id="intakeSearch" type="button">Salvar revisão</button></div>
      <h2>Profissionais do banco de talentos</h2><div id="intakeCandidates"></div>
      <label class="intake-check"><input id="intakeAcknowledge" type="checkbox">Revisei os dados e as pendências. A seleção é uma indicação para avaliação, sujeita à confirmação dos requisitos com o profissional.</label>
      <div class="intake-actions"><button id="intakeConfirm" class="primary-action" type="button">Confirmar</button><button id="intakeCancel" type="button">Cancelar</button><strong id="selectedCount"></strong></div></section>`;
    q('#intakeForm').onsubmit = ev => ev.preventDefault();
    q('#intakeFields').oninput = () => { dirty = true; q('#intakeAcknowledge').checked = false; controls(); message('Dados alterados: salve a revisão antes de confirmar. A pesquisa existente será preservada.'); };
    q('#intakeReload').onclick = () => run(load);
    q('#intakeJump').onclick = () => q('#intakeCandidates').scrollIntoView({ behavior: 'smooth', block: 'start' });
    q('#intakeSearch').onclick = () => run(review);
    q('#intakeConfirm').onclick = () => run(async () => {
      message('Conferindo a seleção e gravando a oportunidade na base local…');
      const result = await api(`/api/intake/${draft.id}/confirm`, { method: 'POST', body: JSON.stringify({ revision: draft.revision, selectedIds: [...selected], acknowledged: q('#intakeAcknowledge').checked }) });
      await load(); await refresh(); showView('opportunityIntake');
      message(`Oportunidade ${result.opportunity.opportunityCode} cadastrada como Open. ${result.selectedCount ?? result.draft.selectedIds.length} selecionado(s). Lembretes desta solicitação encerrados.`);
    });
    q('#intakeCancel').onclick = () => run(async () => { await api(`/api/intake/${draft.id}/cancel`, { method: 'POST', body: JSON.stringify({ revision: draft.revision }) }); await load(); message('Solicitação cancelada. Nenhuma oportunidade ou vínculo criado.'); });
    run(load);
  }
  return { mount };
})();
