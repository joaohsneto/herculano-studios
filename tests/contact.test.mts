import assert from 'node:assert/strict';
import test from 'node:test';
import express from '../backend/node_modules/express/index.js';
import type { AddressInfo } from 'node:net';

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';
process.env.JWT_SECRET ||= 'test-secret-at-least-thirty-two-characters';
const { createContactRouter } = await import('../backend/src/routes/contact.ts');
const { contactEmail, CONTACT_EMAIL, createContactSender } = await import('../backend/src/services/contact.ts');
const valid = { name: 'João Silva', email: 'visitor@example.com', topic: 'Outro assunto', message: 'Olá! Quero conversar sobre um projeto.', website: '' };

async function serve(run: (url: string) => Promise<void>, send = async (_data: unknown) => {}, configured = () => true) {
  const app = express();
  app.use(express.json());
  app.use('/api/contact', createContactRouter(send, configured));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/contact`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('destinatário fixo, resposta ao visitante e HTML escapado', () => {
  const email = contactEmail({ ...valid, topic: 'Outro assunto', name: '<script>alert(1)</script>', message: '<img src=x onerror=alert(1)>\nOlá & obrigado' });
  assert.equal(email.to, CONTACT_EMAIL);
  assert.equal(email.replyTo.address, valid.email);
  assert.ok(!email.html.includes('<script>'));
  assert.ok(!email.html.includes('<img src=x'));
  assert.ok(email.html.includes('&lt;img'));
  assert.ok(email.html.includes('<br>Olá &amp; obrigado'));
  assert.ok(email.text.includes('Olá & obrigado'));
});
test('envia uma vez e só confirma depois do envio', async () => {
  let calls = 0;
  await serve(async url => {
    const response = await post(url, { ...valid, to: 'attacker@example.com' });
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  }, async data => { calls++; assert.equal((data as Record<string, unknown>).to, undefined); });
});
test('rejeita dados inválidos, injeção de cabeçalhos e honeypot sem enviar', async () => {
  await serve(async url => {
    for (const data of [{ ...valid, email: 'invalid' }, { ...valid, name: 'Name\r\nBcc: bad@example.com' }, { ...valid, message: 'x'.repeat(5001) }, { ...valid, website: 'https://spam.example' }, { ...valid, topic: 'injected' }]) {
      assert.equal((await post(url, data)).status, 400);
    }
  }, async () => { assert.fail('não deve enviar'); });
});
test('credenciais ausentes e falha do provedor nunca retornam sucesso', async () => {
  await serve(async url => assert.equal((await post(url, valid)).status, 503), async () => assert.fail(), () => false);
  await serve(async url => assert.equal((await post(url, valid)).status, 502), async () => { throw new Error('private credential'); });
});
test('limita tentativas e não permite burlar com cabeçalho de IP', async () => {
  await serve(async url => {
    for (let i = 0; i < 5; i++) assert.equal((await post(url, valid)).status, 200);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' }, body: JSON.stringify(valid) });
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get('retry-after')) > 0);
  });
});

test('SMTP envia HTML e texto com destinatário fixo e resposta ao visitante', async () => {
  let calls = 0;
  const sender = createContactSender({ sendMail: async message => {
    calls++;
    assert.equal(message.to, CONTACT_EMAIL);
    assert.equal(message.from.address, CONTACT_EMAIL);
    assert.equal(message.replyTo.address, valid.email);
    assert.ok(message.html.includes('Novo contato'));
    assert.ok(message.text.includes(valid.message));
    return { accepted: [CONTACT_EMAIL] };
  } }, CONTACT_EMAIL);
  await sender({ ...valid, topic: 'Outro assunto' });
  assert.equal(calls, 1);
});

test('SMTP ausente, destinatário rejeitado e falha não confirmam envio', async () => {
  await assert.rejects(createContactSender(null, CONTACT_EMAIL)({ ...valid, topic: 'Outro assunto' }), /SMTP_NOT_CONFIGURED/);
  for (const accepted of [[], ['other@example.com']]) {
    await assert.rejects(createContactSender({ sendMail: async () => ({ accepted }) }, CONTACT_EMAIL)({ ...valid, topic: 'Outro assunto' }), /SMTP_RECIPIENT_REJECTED/);
  }
  await assert.rejects(createContactSender({ sendMail: async () => { throw new Error('SMTP failure'); } }, CONTACT_EMAIL)({ ...valid, topic: 'Outro assunto' }), /SMTP failure/);
});
