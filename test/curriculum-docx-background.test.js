import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import PizZip from 'pizzip';

import { renderCurriculumDocuments } from '../dtt.js';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templateDirectory = path.join(repositoryRoot, 'assets', 'templates', 'dtt');

test('todos os quatro modelos de currículo são gerados com fundo branco explícito', async () => {
  const curriculum = {
    nome: 'Candidata de Teste',
    cargo_alvo: 'Consultora Funcional',
    email: 'candidata@example.com',
  };
  const generated = {
    target_role_pt: 'Consultora Funcional',
    target_role_en: 'Functional Consultant',
    languages_pt: ['Português'],
    languages_en: ['Portuguese'],
  };

  const documents = await renderCurriculumDocuments(
    curriculum,
    generated,
    templateDirectory,
  );

  for (const [name, buffer] of Object.entries(documents)) {
    const zip = new PizZip(buffer);
    const documentXml = zip.file('word/document.xml').asText();
    assert.match(
      documentXml,
      /<w:background w:color="FFFFFF"\s*\/>/,
      `${name} deve declarar fundo branco`,
    );
    assert.doesNotMatch(
      documentXml,
      /<w:shd\b[^>]*w:fill="000000"/i,
      `${name} não pode conter sombreamento preto no corpo`,
    );
  }
});
