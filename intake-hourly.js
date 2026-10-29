import { randomUUID } from 'node:crypto';
export const DTT_MAILBOX = 'gerson@alcateiaconsulting.com.br';
export const DTT_SENDER = 'poolterceiros@deloitte.com';
export const DTT_INBOX_INTERVAL_MS = 15 * 60000;
export const DTT_REMINDER_INTERVAL_MS = 6 * 3600000;
export const DTT_ALERT_INTERVAL_MS = DTT_REMINDER_INTERVAL_MS;
export const HOUR_MS = DTT_REMINDER_INTERVAL_MS;
export const DTT_REVIEWERS = [
  { name: 'Gerson', email: 'gerson@alcateiaconsulting.com.br' },
  { name: 'Bruno', email: 'bruno@alcateiaconsulting.com.br' }
];
const DTT_POOL_SENDER = /^pool[^@]*@deloitte\.com(?:\.br)?$/i;
export function isDttMessage(message) {
  const sender=String(message.from?.emailAddress?.address || '').trim();
  const subject=String(message.subject || '');
  return (sender.toLowerCase()===DTT_SENDER || DTT_POOL_SENDER.test(sender)) && /solicita[çc][aã]o de cota[çc][aã]o[\s\S]*\bvaga\b/i.test(subject);
}
export async function listDttMessages({ token, since, until, fetchImpl = fetch }) {
  const from = new Date(Date.parse(since) - 5 * 60000).toISOString();
  const query = new URLSearchParams({ '$select':'id,internetMessageId,subject,from,receivedDateTime,body', '$filter':`receivedDateTime ge ${from} and receivedDateTime le ${until}`, '$orderby':'receivedDateTime desc', '$top':'100' });
  let next = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(DTT_MAILBOX)}/messages?${query}`;
  const rows = [], seen = new Set();
  while (next) {
    const parsed = new URL(next);
    if (parsed.origin !== 'https://graph.microsoft.com' || seen.has(next)) throw Error('Paginação Graph inválida.');
    seen.add(next);
    const res = await fetchImpl(next, { headers:{ Authorization:`Bearer ${token}`, Prefer:'outlook.body-content-type="text", IdType="ImmutableId"' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw Error(`Leitura da caixa do Gerson recusada pelo Graph: HTTP ${res.status}.`);
    const body = await res.json();
    if (!Array.isArray(body.value)) throw Error('Resposta Graph sem lista de mensagens.');
    rows.push(...body.value.filter(isDttMessage)); next = body['@odata.nextLink'];
  }
  return rows;
}
export function createHourlyIntake({ store, getToken, send, log, fetchMessages = listDttMessages, now = () => new Date().toISOString(), startAt, simulated = false }) {
  let running = false;
  const actor = { id:'dtt-inbox-fifteen-minutes', name:'Rotina DTT a cada 15 minutos', email:DTT_MAILBOX };
  return {
    async notifyUpdates(started=now(), owner=randomUUID()) {
      const attempts = await store.claimUpdateNotifications(owner, started);
      const errors = []; let sent = 0;
      for (const attempt of attempts) {
        let status='failed', error='';
        try {
          if (simulated) status='simulated';
          else { await send({to:attempt.to,subject:attempt.subject,text:attempt.text}); status='sent'; sent++; }
        } catch (failure) { error='Falha no transporte do aviso de atualização DTT.'; errors.push(error); }
        const result=await store.finishReminder(attempt.id,owner,status,now(),error);
        try { await log({...result,id:`dtt-update:${result.id}`,provider:'SMTP',source:'dtt_hourly_update'}); } catch { errors.push('Falha ao espelhar histórico do aviso de atualização DTT.'); }
      }
      return { sent, errors };
    },
    async notify(draftId, refreshRevision, started=now(), owner=randomUUID(), manualReason='') {
      const draft=(await store.get(draftId)).draft;
      const errors=[]; let sent=0;
      for(const recipient of DTT_REVIEWERS) {
            const attempt=await store.claimReminder(draft.id,recipient.email,started,owner,refreshRevision,manualReason);
            if (!attempt) continue;
            let status='failed',error='';
            try {
              // Recheck immediately before dispatch: a different reviewer may have completed it.
              if ((await store.get(draft.id)).draft.status !== 'pending') status='cancelled';
              else if (simulated) status='simulated';
              else { await send({to:attempt.to,subject:attempt.subject,text:attempt.text}); status='sent';sent++; }
            } catch(e) { error='Falha no transporte de e-mail; consultar configuração e disponibilidade.'; errors.push(error); }
            const result=await store.finishReminder(attempt.id,owner,status,now(),error);
            try { await log({...result, id:`dtt:${result.id}`,provider:'SMTP',source:'dtt_hourly'}); } catch(e) { errors.push('Falha ao espelhar histórico de envio; tentativa preservada na solicitação.'); }
      }
      return {sent,errors};
    },
    async run() {
      if (running) return { skipped:true };
      running = true; const owner=randomUUID(), started=now(); let claimed=false, checkpoint, failure=''; const errors=[]; let received=0,sent=0;
      try {
        const cycle=await store.claimCycle(started,owner,startAt);
        if (!cycle) return {skipped:true}; claimed=true;
        try {
          const token=await getToken();
          const messages=await fetchMessages({ token, since:cycle.checkpoint, until:started });
          for (const message of messages) {
            if (!isDttMessage(message)) continue;
            if(message.receivedDateTime && Date.parse(message.receivedDateTime)<Date.parse(cycle.activatedAt))continue;
            if (message.body?.contentType?.toLowerCase() !== 'text') throw Error('Graph não retornou corpo em texto; mensagem mantida para nova tentativa.');
            const result=await store.receive({ mailbox:DTT_MAILBOX, sender:DTT_SENDER, subject:message.subject, messageId:message.internetMessageId || message.id, body:message.body.content },actor); received++;
            if(result?.draft?.status==='pending') {
              const dispatched=await this.notify(result.draft.id,undefined,started,owner);
              sent+=dispatched.sent;errors.push(...dispatched.errors);
            }
          }
          checkpoint=started;
        } catch(error) { errors.push(error.message); }
        for (const draft of (await store.list()).filter(d=>d.status==='pending' && d.receivedAt)) {
          for (const recipient of DTT_REVIEWERS) {
            const dispatched = await this.notify(draft.id, undefined, started, owner);
            sent += dispatched.sent; errors.push(...dispatched.errors);
            break; // notify handles all configured recipients
          }
        }
        const updated = await this.notifyUpdates(started, owner);
        sent += updated.sent; errors.push(...updated.errors);
        failure=[...new Set(errors)].join(' ');
        return {received,sent,errors};
      } catch(error) { failure=error.message; throw error; }
      finally { try { if(claimed) await store.finishCycle(owner,now(),checkpoint,failure); } finally { running=false; } }
    },
    start(onError = () => {}) {
      const tick=()=>this.run().catch(onError); tick(); const timer=setInterval(tick,DTT_INBOX_INTERVAL_MS); timer.unref?.(); return ()=>clearInterval(timer);
    }
  };
}
