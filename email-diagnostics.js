export function summarizeCandidateEmails(db) {
  return ['selected', 'rejected'].map(type => {
    const records = type === 'selected' ? db.selectedCandidates : db.candidates;
    const notifications = (records || []).flatMap(record => record.notifications || []).filter(item => item.type === type);
    const counts = { sent: 0, failed: 0, skipped: 0, sending: 0 };
    for (const item of notifications) if (Object.hasOwn(counts, item.status)) counts[item.status]++;
    const latest = [...notifications].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    return { type, counts, latest: latest ? { status: latest.status, date: latest.sentAt || latest.createdAt, error: String(latest.error || '').slice(0, 400) } : null };
  });
}

export function summarizeSentMessages(messages) {
  return [
    ['received', '[Alcateia] Confirmação de recebimento do seu CV'],
    ['selected', '[Alcateia] Processo seletivo - '],
    ['rejected', '[Alcateia] Atualização do processo seletivo']
  ].map(([type, prefix]) => {
    const matches = messages.filter(message => String(message.subject || '').startsWith(prefix));
    return { type, count: matches.length, latest: matches.map(message => message.sentDateTime).filter(Boolean).sort().at(-1) || null };
  });
}
