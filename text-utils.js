const HAS_NODE_BUFFER = typeof Buffer !== 'undefined';

const QUESTION_MARK_REPAIRS = [
  [/\bFormul\?rios\b/g, 'Formulários'],
  [/\bformul\?rios\b/g, 'formulários'],
  [/\bUsu\?rios\b/g, 'Usuários'],
  [/\busu\?rios\b/g, 'usuários'],
  [/\bCurr\?culo\b/g, 'Currículo'],
  [/\bcurr\?culo\b/g, 'currículo'],
  [/\bCurr\?culos\b/g, 'Currículos'],
  [/\bcurr\?culos\b/g, 'currículos'],
  [/\bIngl\?s\b/g, 'Inglês'],
  [/\bingl\?s\b/g, 'inglês'],
  [/\bN\?vel\b/g, 'Nível'],
  [/\bn\?vel\b/g, 'nível'],
  [/\bT\?cnico\b/g, 'Técnico'],
  [/\bt\?cnico\b/g, 'técnico'],
  [/\bGest\?\?o\b/g, 'Gestão'],
  [/\bgest\?\?o\b/g, 'gestão'],
  [/\bS\?\?o\b/g, 'São'],
  [/\bs\?\?o\b/g, 'são'],
  [/\bS\?o\b/g, 'São'],
  [/\bs\?o\b/g, 'são'],
  [/\bN\?\?o\b/g, 'Não'],
  [/\bn\?\?o\b/g, 'não'],
  [/\bN\?o\b/g, 'Não'],
  [/\bn\?o\b/g, 'não'],
  [/\bJo\?\?o\b/g, 'João'],
  [/\bjo\?\?o\b/g, 'joão'],
  [/\bJo\?o\b/g, 'João'],
  [/\bjo\?o\b/g, 'joão'],
  [/\bM\?\?s\b/g, 'Mês'],
  [/\bm\?\?s\b/g, 'mês'],
  [/\bM\?s\b/g, 'Mês'],
  [/\bm\?s\b/g, 'mês'],
  [/\bV\?nculo\b/g, 'Vínculo'],
  [/\bv\?nculo\b/g, 'vínculo'],
  [/\bposs\?vel\b/g, 'possível'],
  [/\bPoss\?vel\b/g, 'Possível'],
  [/\bManuten\?\?o\b/g, 'Manutenção'],
  [/\bmanuten\?\?o\b/g, 'manutenção'],
  [/\bOp\?\?o\b/g, 'Opção'],
  [/\bop\?\?o\b/g, 'opção'],
  [/([Aa])\?\?es/g, '$1ções'],
  [/([Ee])\?\?es/g, '$1ções'],
  [/([Ii])\?\?es/g, '$1ções'],
  [/([Oo])\?\?es/g, '$1ções'],
  [/([Uu])\?\?es/g, '$1ções'],
  [/([Aa])\?\?o/g, '$1ção'],
  [/([Ee])\?\?o/g, '$1ção'],
  [/([Ii])\?\?o/g, '$1ção'],
  [/([Oo])\?\?o/g, '$1ção'],
  [/([Uu])\?\?o/g, '$1ção']
];

function artifactScore(text = '') {
  const value = String(text || '');
  return (
    ((value.match(/[ÃÂ�]/g) || []).length * 3)
    + ((value.match(/(?:â€|â€“|â€”|â€¢|ï¿½)/g) || []).length * 3)
    + ((value.match(/\?\?(?:o|a|es|ao|oes|cao)/gi) || []).length * 2)
    + ((value.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) || []).length)
  );
}

function decodeLatin1AsUtf8(text) {
  if (!/[ÃÂâï]/.test(text)) return text;

  try {
    if (HAS_NODE_BUFFER) {
      return Buffer.from(text, 'latin1').toString('utf8');
    }

    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: false }).decode(
        Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0) & 0xff))
      );
    }
  } catch {
    return text;
  }

  return text;
}

export function repairUnicodeText(value = '') {
  let text = String(value ?? '');
  if (!text) return text;

  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeLatin1AsUtf8(text);
    if (decoded === text || artifactScore(decoded) >= artifactScore(text)) break;
    text = decoded;
  }

  text = text
    .replace(/_x000D_/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  for (const [pattern, replacement] of QUESTION_MARK_REPAIRS) {
    text = text.replace(pattern, replacement);
  }

  return text.normalize('NFC');
}

export function sanitizeUnicodeValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') return repairUnicodeText(value);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (HAS_NODE_BUFFER && Buffer.isBuffer(value)) return value;

  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = sanitizeUnicodeValue(value[index], seen);
    }
    return value;
  }

  for (const [key, item] of Object.entries(value)) {
    value[key] = sanitizeUnicodeValue(item, seen);
  }
  return value;
}
