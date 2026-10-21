export async function sendGraphMail({ token, mailbox, to, subject, text, fetchImpl = fetch }) {
  const recipients = (Array.isArray(to) ? to : String(to || '').split(/[;,]/))
    .map(address => String(address).trim())
    .filter(Boolean);
  if (!token) throw new Error('Token Microsoft não informado.');
  if (!mailbox) throw new Error('Caixa Microsoft não informada.');
  if (!recipients.length) throw new Error('Destinatário Microsoft não informado.');
  const response = await fetchImpl(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: String(subject || ''),
          body: { contentType: 'Text', content: String(text || '') },
          toRecipients: recipients.map(address => ({ emailAddress: { address } }))
        },
        saveToSentItems: true
      }),
      signal: AbortSignal.timeout(30000)
    }
  );
  if (!response.ok) throw new Error(`Envio Microsoft Graph recusado: HTTP ${response.status}.`);
}
