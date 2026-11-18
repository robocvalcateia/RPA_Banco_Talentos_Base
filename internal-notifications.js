export const INTERNAL_NOTIFICATION_RECIPIENTS = Object.freeze([
  Object.freeze({ name: 'Gerson', email: 'gerson@alcateiaconsulting.com.br' }),
  Object.freeze({ name: 'Bruno', email: 'bruno@alcateiaconsulting.com.br' }),
  Object.freeze({ name: 'Emerson Viana', email: 'emerson.viana@alcateiaconsulting.com.br' }),
  Object.freeze({ name: 'Luiz Cesar', email: 'luiz.cesar@alcateiaconsulting.com.br' })
]);

export const INTERNAL_NOTIFICATION_EMAILS = Object.freeze(
  INTERNAL_NOTIFICATION_RECIPIENTS.map((recipient) => recipient.email)
);

export const INTERNAL_NOTIFICATION_TO = INTERNAL_NOTIFICATION_EMAILS.join(',');
export const INTERNAL_NOTIFICATION_GREETING = 'Gerson, Bruno, Emerson Viana e Luiz Cesar,';
