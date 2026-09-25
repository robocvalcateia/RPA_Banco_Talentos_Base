import { MongoClient } from 'mongodb';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let clientPromise;
let indexPromise;
let localQueue = Promise.resolve();
const localFile = new URL('./data/email-delivery-log.jsonl', import.meta.url);
async function collection() {
  const url = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!url) {
    if (process.env.NODE_ENV === 'production') throw new Error('Banco do histórico de e-mails não configurado.');
    return null;
  }
  if (!clientPromise) clientPromise = new MongoClient(url, { serverSelectionTimeoutMS: 10000 }).connect().catch(error => { clientPromise = null; throw error; });
  const client = await clientPromise;
  const target = client.db(process.env.MONGODB_DB || 'Banco_de_Talentos').collection((process.env.MONGODB_APP_COLLECTION_PREFIX || '') + 'emailDeliveryLogs');
  if (!indexPromise) indexPromise = target.createIndex({ id: 1 }, { unique: true }).catch(error => { indexPromise = null; throw error; });
  await indexPromise;
  return target;
}

export async function writeEmailLog(entry, file) {
  if (!entry.id) throw new Error('Registro de e-mail sem identificador.');
  const target = file ? null : await collection();
  const value = { ...entry, updatedAt: new Date().toISOString() };
  if (target) { await target.updateOne({ id: entry.id }, { $set: value }, { upsert: true }); return; }
  const destination = file || localFile;
  const pending = localQueue.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(destination instanceof URL ? fileURLToPath(destination) : destination), { recursive: true });
    await fs.appendFile(destination, JSON.stringify(value) + '\n', 'utf8');
  });
  localQueue = pending;
  await pending;
}

export async function readEmailLogs(file) {
  const target = file ? null : await collection();
  if (target) return target.find({}, { projection: { _id: 0 } }).toArray();
  await localQueue.catch(() => {});
  const text = await fs.readFile(file || localFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  const rows = new Map();
  for (const line of text.split('\n').filter(Boolean)) { const row = JSON.parse(line); rows.set(row.id, row); }
  return [...rows.values()];
}

export function lifecycleLog(record, notification, opportunity = {}, from = '') {
  return { ...notification, id: `lifecycle:${record.id}:${notification.eventKey}`,
    candidateId: record.curriculumId || record.id, candidateName: record.name || '',
    opportunityId: record.opportunityId || '', opportunityName: opportunity.opportunity || '',
    opportunityCode: opportunity.opportunityCode || '', from, provider: 'SMTP', source: 'system' };
}

export function legacyEmailLogs(db) {
  const rows = [];
  for (const record of [...(db.selectedCandidates || []), ...(db.candidates || [])]) {
    const opportunity = (db.opportunities || []).find(item => item.id === record.opportunityId) || {};
    for (const notification of record.notifications || []) {
      if (['selected', 'rejected'].includes(notification.type)) rows.push(lifecycleLog(record, notification, opportunity));
    }
  }
  return rows;
}

export function queryEmailLogs(rows, filters = {}) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const term = normalize(filters.q);
  const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' });
  const matches = [...byId.values()].filter(row => {
    const stamp = new Date(row.sentAt || row.createdAt);
    const day = Number.isFinite(stamp.getTime()) ? dayFormat.format(stamp) : '';
    return (!filters.type || row.type === filters.type) && (!filters.status || row.status === filters.status)
      && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
      && (!term || normalize([row.candidateName, row.to, row.opportunityName, row.opportunityCode].join(' ')).includes(term));
  }).sort((a, b) => String(b.sentAt || b.createdAt || '').localeCompare(String(a.sentAt || a.createdAt || '')));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize, 10) || 25));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number.parseInt(filters.page, 10) || 1));
  return { total: matches.length, page, pages, pageSize, rows: matches.slice((page - 1) * pageSize, page * pageSize) };
}

export function receivedMessageLog(message, mailbox) {
  if (message.subject !== '[Alcateia] Confirmação de recebimento do seu CV') return null;
  const recipient = message.toRecipients?.[0]?.emailAddress || {};
  return { id: 'graph:' + message.id, type: 'received', candidateName: recipient.name || '', to: recipient.address || '',
    from: mailbox, opportunityName: '', opportunityCode: '', provider: 'Microsoft Graph', source: 'sent_items',
    status: 'sent', createdAt: message.sentDateTime, sentAt: message.sentDateTime, error: '' };
}
