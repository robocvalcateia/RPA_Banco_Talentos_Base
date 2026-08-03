import net from 'node:net';
import tls from 'node:tls';

const DEFAULT_TIMEOUT_MS = 30000;

function encodeHeader(value) {
  const text = String(value ?? '');
  return /^[\x00-\x7F]*$/.test(text)
    ? text
    : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function encodeBodyBase64(value) {
  return Buffer.from(String(value ?? ''), 'utf8')
    .toString('base64')
    .replace(/.{1,76}/g, '$&\r\n')
    .trim();
}

function parseRecipients(to) {
  const recipients = Array.isArray(to) ? to : String(to ?? '').split(/[;,]/);
  return recipients.map((item) => String(item).trim()).filter(Boolean);
}

function createLineReader(socket) {
  let buffer = '';
  const pending = [];

  function rejectPending(error) {
    while (pending.length) {
      pending.shift().reject(error);
    }
  }

  function onData(chunk) {
    buffer += chunk.toString('utf8');
    flush();
  }

  function onError(error) {
    rejectPending(error);
  }

  function onClose() {
    rejectPending(new Error('Conexao SMTP encerrada antes da resposta esperada.'));
  }

  function flush() {
    while (pending.length) {
      const end = buffer.indexOf('\r\n');
      if (end < 0) return;
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      pending.shift().resolve(line);
    }
  }

  socket.on('data', onData);
  socket.on('error', onError);
  socket.on('end', onClose);
  socket.on('close', onClose);

  return {
    readLine() {
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
        flush();
      });
    },
    detach() {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('end', onClose);
      socket.off('close', onClose);
    }
  };
}

async function readResponse(reader) {
  const lines = [];

  while (true) {
    const line = await reader.readLine();
    lines.push(line);

    if (/^\d{3} /.test(line)) {
      return {
        code: Number(line.slice(0, 3)),
        text: lines.join('\n')
      };
    }
  }
}

async function expectResponse(reader, expectedCodes, commandLabel) {
  const response = await readResponse(reader);
  const codes = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];
  if (!codes.includes(response.code)) {
    throw new Error(`${commandLabel} retornou ${response.code}: ${response.text}`);
  }
  return response;
}

function writeCommand(socket, command) {
  socket.write(`${command}\r\n`);
}

function connectSocket({ host, port, secure, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });

    const timer = setTimeout(() => {
      socket.destroy(new Error('Tempo esgotado ao conectar ao SMTP.'));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('secureConnect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', reject);
  });
}

async function upgradeToTls(socket, host) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host });
    secureSocket.once('secureConnect', () => resolve(secureSocket));
    secureSocket.once('error', reject);
  });
}

export function getSmtpConfigFromEnv(env = process.env) {
  const host = env.SMTP_HOST || '';
  const port = Number(env.SMTP_PORT || 587);
  const user = env.SMTP_USER || '';
  const password = env.SMTP_PASSWORD || '';
  const from = env.SMTP_FROM || user;
  const testTo = env.SMTP_TO_TESTE || env.SMTP_TEST_TO || '';
  const secure = String(env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  return {
    host,
    port,
    secure,
    user,
    password,
    from,
    testTo,
    configured: Boolean(host && port && user && password && from && testTo)
  };
}

export async function sendMail({ host, port, secure = false, user, password, from, to, subject, text, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const recipients = parseRecipients(to);
  if (!recipients.length) {
    throw new Error('Nenhum destinatario SMTP informado.');
  }

  let socket = await connectSocket({ host, port, secure, timeoutMs });
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error('Tempo esgotado na comunicacao SMTP.')));
  let reader = createLineReader(socket);

  await expectResponse(reader, 220, 'Conexao SMTP');

  writeCommand(socket, 'EHLO localhost');
  await expectResponse(reader, 250, 'EHLO');

  if (!secure) {
    writeCommand(socket, 'STARTTLS');
    await expectResponse(reader, 220, 'STARTTLS');
    reader.detach();
    socket = await upgradeToTls(socket, host);
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('Tempo esgotado na comunicacao SMTP.')));
    reader = createLineReader(socket);

    writeCommand(socket, 'EHLO localhost');
    await expectResponse(reader, 250, 'EHLO apos STARTTLS');
  }

  writeCommand(socket, 'AUTH LOGIN');
  await expectResponse(reader, 334, 'AUTH LOGIN');
  writeCommand(socket, Buffer.from(user, 'utf8').toString('base64'));
  await expectResponse(reader, 334, 'Usuario SMTP');
  writeCommand(socket, Buffer.from(password, 'utf8').toString('base64'));
  await expectResponse(reader, 235, 'Senha SMTP');

  writeCommand(socket, `MAIL FROM:<${from}>`);
  await expectResponse(reader, 250, 'MAIL FROM');

  for (const recipient of recipients) {
    writeCommand(socket, `RCPT TO:<${recipient}>`);
    await expectResponse(reader, [250, 251], `RCPT TO ${recipient}`);
  }

  writeCommand(socket, 'DATA');
  await expectResponse(reader, 354, 'DATA');

  const message = [
    `From: ${from}`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBodyBase64(text),
    '.'
  ].join('\r\n');

  socket.write(`${message}\r\n`);
  await expectResponse(reader, 250, 'Envio da mensagem');

  writeCommand(socket, 'QUIT');
  await expectResponse(reader, 221, 'QUIT').catch(() => null);
  socket.end();
}
