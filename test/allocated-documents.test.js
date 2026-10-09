import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { renderAllocatedDocuments, buildAllocatedDocumentsZip, ALLOCATED_DOCUMENT_TEMPLATES } from '../allocated-documents.js';

const allocateds = [{ id: 'test', consultant: 'Consultor Teste', code: 'P-TESTE', clientId: 'client', hourlyRate: 80 }];
const clients = [{ id: 'client', customerName: 'Cliente Teste' }];
const directory = fileURLToPath(new URL('../assets/templates/allocateds/', import.meta.url));

test('todos gera os três DOCX e um ZIP com conteúdo válido', async () => {
  const documents = await renderAllocatedDocuments(allocateds, clients, ['all'], directory);
  assert.equal(documents.length, 3);
  assert.deepEqual(documents.map(d => d.templateId), ALLOCATED_DOCUMENT_TEMPLATES.map(t => t.id));
  const entries = unzipSync(buildAllocatedDocumentsZip(documents));
  assert.equal(Object.keys(entries).length, 3);
  for (const bytes of Object.values(entries)) {
    const xml = new PizZip(bytes).file('word/document.xml').asText();
    assert.ok(xml.includes('Consultor Teste'));
  }
});

test('modelos individuais permanecem funcionais', async () => {
  for (const template of ALLOCATED_DOCUMENT_TEMPLATES) {
    const documents = await renderAllocatedDocuments(allocateds, clients, [template.id], directory);
    assert.equal(documents.length, 1);
    assert.equal(documents[0].templateId, template.id);
    const zip = new PizZip(documents[0].content);
    assert.ok(zip.file('[Content_Types].xml'));
    const xml = zip.file('word/document.xml').asText();
    assert.ok(xml.includes('Consultor Teste'), template.id);
    assert.ok(!xml.includes('{consultant}'), template.id);
  }
});

test('todos e um modelo explícito não duplicam documentos por alocado', async () => {
  const documents = await renderAllocatedDocuments([...allocateds, {...allocateds[0], id:'second', consultant:'Outro Teste', code:'P-OUTRO'}], clients, ['all', 'contrato-base'], directory);
  assert.equal(documents.length, 6);
  assert.equal(Object.keys(unzipSync(buildAllocatedDocumentsZip(documents))).length, 6);
});

test('seleção vazia ou inválida e ZIP vazio retornam erro em vez de falso sucesso', async () => {
  for (const ids of [[], ['inexistente'], ['all','inexistente'], undefined]) {
    await assert.rejects(renderAllocatedDocuments(allocateds, clients, ids, directory), {statusCode:422});
  }
  assert.throws(() => buildAllocatedDocumentsZip([]), {statusCode:422});
});
