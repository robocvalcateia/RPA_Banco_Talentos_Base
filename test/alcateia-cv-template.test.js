import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import PizZip from 'pizzip';

const templatePath = new URL(
  '../assets/templates/dtt/alcateia-cv-pt.docx',
  import.meta.url,
);

test('modelo Alcateia usa fundo branco e não contém marca d’água VML', () => {
  const zip = new PizZip(readFileSync(templatePath));
  const documentXml = zip.file('word/document.xml').asText();
  const headerFiles = Object.keys(zip.files).filter((name) =>
    /^word\/header\d+\.xml$/.test(name),
  );
  const headersXml = headerFiles
    .map((name) => zip.file(name).asText())
    .join('\n')
    .toLowerCase();

  assert.match(documentXml, /<w:background\s+w:color="FFFFFF"\s*\/>/);
  assert.doesNotMatch(headersXml, /wordpicturewatermark|marca d(?:'|&#39;|’)?agua/);
  assert.match(headersXml, /descr="logotipo, nome da empresa/);

  const jpegFiles = Object.keys(zip.files).filter((name) => /\.(?:jpe?g)$/i.test(name));
  for (const name of jpegFiles) {
    const jpeg = zip.file(name).asNodeBuffer();
    assert.equal(
      jpeg.includes(Buffer.from('Adobe', 'ascii')),
      false,
      `${name} não pode permanecer em CMYK/Adobe JPEG`,
    );
  }
});
