import test from 'node:test';
import assert from 'node:assert/strict';
import { sendGraphMail } from '../graph-mail.js';

test('Microsoft Graph envia o link DTT e preserva acentuação', async () => {
  let request;
  await sendGraphMail({
    token: 'token', mailbox: 'robocv@alcateiaconsulting.com.br',
    to: 'gerson@alcateiaconsulting.com.br', subject: 'Revisão pendente',
    text: 'Acesse o link para revisão.',
    fetchImpl: async (url, options) => { request={url,options}; return {ok:true,status:202}; }
  });
  assert.match(request.url,/robocv%40alcateiaconsulting\.com\.br\/sendMail$/);
  assert.equal(request.options.headers.Authorization,'Bearer token');
  const body=JSON.parse(request.options.body);
  assert.equal(body.message.toRecipients[0].emailAddress.address,'gerson@alcateiaconsulting.com.br');
  assert.equal(body.message.subject,'Revisão pendente');
  assert.equal(body.saveToSentItems,true);
});

test('Microsoft Graph rejeita resposta de envio com erro', async () => {
  await assert.rejects(
    sendGraphMail({token:'token',mailbox:'robocv@alcateiaconsulting.com.br',to:'bruno@alcateiaconsulting.com.br',fetchImpl:async()=>({ok:false,status:403})}),
    /HTTP 403/
  );
});
