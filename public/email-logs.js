function ensureEmailLogButton() {
  const status = document.querySelector('#emailProcessingStatus');
  if (!status || !isCurrentUserAdmin() || document.querySelector('#emailLogButton')) return;
  const button = document.createElement('button');
  button.id = 'emailLogButton';
  button.type = 'button';
  button.className = 'primary-action compact-action';
  button.textContent = 'Histórico de e-mails';
  button.addEventListener('click', openEmailLog);
  status.after(button);
}

function ensureEmailLogModal() {
  let modal = document.querySelector('#emailLogModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'emailLogModal';
  modal.className = 'modal-backdrop hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'emailLogTitle');
  modal.innerHTML = `<style>
    #emailLogFilters { grid-template-columns:repeat(4,minmax(0,1fr)); }
    #emailLogModal table { table-layout:auto; min-width:1100px; }
    #emailLogModal td { white-space:normal; overflow:visible; text-overflow:clip; max-width:none; overflow-wrap:anywhere; }
    #emailLogModal td:first-child { min-width:150px; }
    #emailLogModal td:nth-child(4) { min-width:200px; }
    #emailLogModal td:last-child { min-width:180px; }
    @media (max-width:800px) { #emailLogFilters { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  </style><section class="modal-card" style="max-width:1400px;width:95vw">
    <div class="modal-heading"><div><h2 id="emailLogTitle">Histórico de e-mails</h2><p>Recebimento de currículo, seleção e reprovação. Horários de Brasília.</p></div><button type="button" class="ghost-action" data-close-email-log>Fechar</button></div>
    <form id="emailLogFilters" class="form-grid">
      <label>Candidato, e-mail ou oportunidade<input name="q" type="search" placeholder="Nome, endereço ou código da vaga"></label>
      <label>Tipo<select name="type"><option value="">Todos</option><option value="received">Recebimento de CV</option><option value="selected">Seleção</option><option value="rejected">Reprovação</option></select></label>
      <label>Resultado<select name="status"><option value="">Todos</option><option value="sent">Enviado</option><option value="failed">Falha</option><option value="skipped">Não enviado</option><option value="sending">Em envio</option></select></label>
      <label>De<input name="from" type="date"></label><label>Até<input name="to" type="date"></label>
      <button class="primary-action" type="submit">Consultar</button>
      <button class="ghost-action" type="button" data-clear-email-log>Limpar filtros</button>
      <button class="ghost-action" type="button" id="emailLogImport">Recuperar histórico anterior</button>
    </form>
    <p id="emailLogMessage" role="status"></p>
    <p class="helper-text">“Enviado” indica aceitação pelo serviço de e-mail, não confirmação de leitura ou entrega. A recuperação consulta os 1.000 itens enviados mais recentes da robocv, sem reenviar mensagens. Registros já gravados permanecem neste histórico.</p>
    <div class="table-wrap"><table><thead><tr><th>Data e hora</th><th>Tipo</th><th>Candidato</th><th>Destinatário</th><th>Oportunidade</th><th>Resultado</th><th>Origem</th><th>Detalhes</th></tr></thead><tbody id="emailLogRows"></tbody></table></div>
    <div class="panel-heading-actions"><button type="button" class="ghost-action" id="emailLogPrevious">Anterior</button><span id="emailLogPage"></span><button type="button" class="ghost-action" id="emailLogNext">Próxima</button></div>
  </section>`;
  document.body.appendChild(modal);
  modal.querySelector('[data-close-email-log]').addEventListener('click', () => closeSurfaceDialog(modal));
  modal.addEventListener('click', event => { if (event.target === modal) closeSurfaceDialog(modal); });
  modal.querySelector('form').addEventListener('submit', event => { event.preventDefault(); void loadEmailLog(1); });
  modal.querySelector('[data-clear-email-log]').addEventListener('click', () => { modal.querySelector('form').reset(); void loadEmailLog(1); });
  modal.querySelector('#emailLogPrevious').addEventListener('click', () => void loadEmailLog(Number(modal.dataset.page) - 1));
  modal.querySelector('#emailLogNext').addEventListener('click', () => void loadEmailLog(Number(modal.dataset.page) + 1));
  modal.querySelector('#emailLogImport').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const message = modal.querySelector('#emailLogMessage');
    message.textContent = 'Recuperando registros antigos. Nenhum e-mail será enviado.';
    try {
      const result = await api('/api/admin/email-logs', { method: 'POST', body: '{}' });
      await loadEmailLog(1);
      message.textContent = `${result.imported} registro(s) de recebimento recuperado(s) em ${result.scanned} itens enviados consultados. Nenhum e-mail foi reenviado.`;
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  initPanelMaximizeControls();
  return modal;
}

async function openEmailLog() {
  openSurfaceDialog(ensureEmailLogModal());
  await loadEmailLog(1);
}

async function loadEmailLog(page = 1) {
  const modal = ensureEmailLogModal();
  const message = modal.querySelector('#emailLogMessage');
  const requestId = String(Number(modal.dataset.requestId || 0) + 1);
  modal.dataset.requestId = requestId;
  const params = new URLSearchParams(new FormData(modal.querySelector('form')));
  params.set('page', String(page));
  message.textContent = 'Consultando histórico...';
  try {
    const result = await api('/api/admin/email-logs?' + params);
    if (modal.dataset.requestId !== requestId) return;
    const typeLabels = { received: 'Recebimento de CV', selected: 'Seleção', rejected: 'Reprovação' };
    const statusLabels = { sent: 'Enviado', failed: 'Falha', skipped: 'Não enviado', sending: 'Em envio' };
    modal.querySelector('#emailLogRows').innerHTML = result.rows.length ? result.rows.map(row => {
      const date = new Date(row.sentAt || row.createdAt);
      const stamp = Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }) : '-';
      const values = [stamp, typeLabels[row.type] || row.type, row.candidateName || '-', row.to || '-', [row.opportunityCode, row.opportunityName].filter(Boolean).join(' · ') || 'Banco de talentos', statusLabels[row.status] || row.status, row.source === 'sent_items' ? 'Histórico Microsoft' : row.provider || 'Sistema', row.error || '-'];
      return '<tr>' + values.map(value => '<td>' + escapeHtml(String(value)) + '</td>').join('') + '</tr>';
    }).join('') : '<tr><td colspan="8">Nenhum registro encontrado. Use Recuperar histórico anterior para consultar os envios antigos da robocv.</td></tr>';
    modal.dataset.page = String(result.page);
    modal.querySelector('#emailLogPage').textContent = `Página ${result.page} de ${result.pages} · ${result.total} registro(s)`;
    modal.querySelector('#emailLogPrevious').disabled = result.page <= 1;
    modal.querySelector('#emailLogNext').disabled = result.page >= result.pages;
    message.textContent = `${result.total} registro(s) encontrado(s).`;
  } catch (error) { if (modal.dataset.requestId === requestId) message.textContent = error.message; }
}
