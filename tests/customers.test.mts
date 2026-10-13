import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { AddressInfo, Server } from 'node:net';
import '../backend/node_modules/dotenv/config.js';
import express from '../backend/node_modules/express/index.js';
import cookieParser from '../backend/node_modules/cookie-parser/index.js';
import { currentMonthStart, customerLibrary, summarizeOrders } from '../backend/src/services/customers.ts';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';
process.env.AUTH_SECRET = 'customers-test-secret-at-least-thirty-two-characters';
process.env.JWT_SECRET ||= process.env.AUTH_SECRET;
const { prisma } = await import('../backend/src/lib/prisma.ts');
const { default: router } = await import('../backend/src/routes/customers.ts');
const require = createRequire(new URL('../backend/node_modules/@auth/express/index.js', import.meta.url));
const { encode } = await import(require.resolve('@auth/core/jwt'));

test('totais pagos separados por moeda e início do mês no fuso do cliente', () => {
  const base = { id: 'order', createdAt: new Date('2026-09-01'), paidAt: null };
  const summary = summarizeOrders([{ ...base, status: 'PAID', totalCents: 100, currency: 'BRL' }, { ...base, status: 'PAID', totalCents: 200, currency: 'USD', paidAt: new Date('2026-09-20') }, { ...base, status: 'REFUNDED', totalCents: 9999, currency: 'BRL' }, { ...base, status: 'PENDING', totalCents: 9999, currency: 'BRL' }]);
  assert.equal(summary.paidOrders, 2); assert.equal(summary.totalOrders, 4); assert.deepEqual(summary.totals, [{ currency: 'BRL', totalCents: 100 }, { currency: 'USD', totalCents: 200 }]); assert.equal(summary.lastPurchaseAt?.toISOString(), '2026-09-20T00:00:00.000Z');
  assert.equal(currentMonthStart(new Date('2026-10-01T02:59:00Z')).toISOString(), '2026-09-01T03:00:00.000Z');
  assert.equal(currentMonthStart(new Date('2026-10-01T03:00:00Z')).toISOString(), '2026-10-01T03:00:00.000Z');
});
test('uma compra paga preserva acesso apesar de reembolso posterior e respeita a versão', () => {
  const base = { productId: 'course', variantId: 'pdf', productName: 'Curso', variantName: 'PDF', product: { type: 'COURSE', assets: [{ variantId: null }, { variantId: 'pdf' }, { variantId: 'premium' }] }, variant: { format: 'PDF', licenseName: 'Pessoal' } };
  const entries = customerLibrary([{ ...base, order: { id: 'paid', status: 'PAID', createdAt: new Date('2026-01-01'), paidAt: null } }, { ...base, order: { id: 'refunded', status: 'REFUNDED', createdAt: new Date('2026-02-01'), paidAt: null } }, { ...base, variantId: 'premium', order: { id: 'pending', status: 'PENDING', createdAt: new Date('2026-03-01'), paidAt: null } }]);
  assert.equal(entries.length, 2); assert.equal(entries[0].access, 'AVAILABLE'); assert.equal(entries[0].orderId, 'paid'); assert.equal(entries[0].filesCount, 2); assert.equal(entries[1].access, 'BLOCKED'); assert.match(entries[1].reason, /Aguardando/);
});
test('admin: autorização, filtros, paginação, moedas, detalhes e acesso com banco real', { skip: process.env.CUSTOMERS_INTEGRATION !== '1' }, async () => {
  const suffix = randomUUID(); const users: string[] = []; let productId: string | undefined; let server: Server | undefined;
  try {
    const admin = await prisma.user.create({ data: { name: `Admin ${suffix}`, email: `admin-${suffix}@example.invalid`, role: 'ADMIN' } }); users.push(admin.id);
    const buyer = await prisma.user.create({ data: { name: `Cliente% ${suffix}`, email: `buyer-${suffix}@example.invalid`, phone: '(82) 99999-1234', company: 'Empresa teste' } }); users.push(buyer.id);
    const pending = await prisma.user.create({ data: { name: `Pendente ${suffix}`, email: `pending-${suffix}@example.invalid` } }); users.push(pending.id);
    const product = await prisma.product.create({ data: { name: 'Curso de teste', slug: `customer-test-${suffix}`, type: 'COURSE', shortDescription: 'Curso de teste privado', description: 'Teste de acesso a conteúdo digital', variants: { create: [{ name: 'PDF', sku: `basic-${suffix}`, priceCents: 100 }, { name: 'VIP', sku: `vip-${suffix}`, priceCents: 200 }] } }, include: { variants: true } }); productId = product.id;
    async function order(userId: string, status: 'PAID' | 'REFUNDED' | 'PENDING', totalCents: number, currency = 'BRL', variantId = product.variants[0].id) {
      return prisma.order.create({ data: { userId, status, currency, subtotalCents: totalCents, totalCents, paidAt: status === 'PAID' ? new Date() : null, items: { create: { productId: product.id, variantId, productName: product.name, variantName: variantId === product.variants[0].id ? 'PDF' : 'VIP', unitPriceCents: totalCents } } } });
    }
    await order(buyer.id, 'PAID', 100); await order(buyer.id, 'PAID', 200); await order(buyer.id, 'PAID', 300, 'USD'); await order(buyer.id, 'REFUNDED', 9999); await order(buyer.id, 'PENDING', 200, 'BRL', product.variants[1].id); await order(pending.id, 'PENDING', 100);
    const app = express(); app.use(cookieParser()); app.use('/api/admin/customers', router); server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/customers`;
    async function headers(id: string) { const token = await encode({ token: { sub: id }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' }); return { cookie: `authjs.session-token=${token}` }; }
    const adminHeaders = await headers(admin.id); const buyerHeaders = await headers(buyer.id);
    assert.equal((await fetch(base)).status, 401); assert.equal((await fetch(base, { headers: buyerHeaders })).status, 403); assert.equal((await fetch(`${base}/${pending.id}`, { headers: buyerHeaders })).status, 403);
    async function list(params: Record<string, string>) { const response = await fetch(`${base}?${new URLSearchParams(params)}`, { headers: adminHeaders }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/); return response.json(); }
    const all = await list({ q: suffix, sort: 'spent' }); assert.equal(all.pagination.total, 2); assert.equal(all.customers.length, 2); assert.equal(all.customers[0].id, buyer.id); assert.equal(all.customers[0].paidOrders, 3); assert.deepEqual(all.customers[0].totals, [{ currency: 'BRL', totalCents: 300 }, { currency: 'USD', totalCents: 300 }]);
    assert.equal((await list({ q: suffix, filter: 'buyers' })).pagination.total, 1);
    assert.equal((await list({ q: suffix, filter: 'no_purchases' })).customers[0].id, pending.id);
    assert.equal((await list({ q: `% ${suffix}` })).pagination.total, 1);
    assert.equal((await list({ q: "' OR 1=1 --" })).pagination.total, 0);
    assert.equal((await list({ q: suffix, page: '2' })).customers.length, 0);
    assert.equal((await fetch(`${base}?page=-1`, { headers: adminHeaders })).status, 400);
    const detail = await (await fetch(`${base}/${buyer.id}`, { headers: adminHeaders })).json(); assert.equal(detail.customer.company, 'Empresa teste'); assert.equal(detail.summary.paidOrders, 3); assert.equal(detail.summary.libraryCount, 1); assert.equal(detail.orders.length, 5); assert.equal(detail.library.length, 2); assert.equal(detail.library[0].access, 'AVAILABLE'); assert.equal(detail.library[1].access, 'BLOCKED');
    for (const secret of ['passwordHash', 'googleId', 'emailChangeHash', 'storageKey']) assert.equal(JSON.stringify(detail).includes(secret), false);
    assert.equal((await fetch(`${base}/${admin.id}`, { headers: adminHeaders })).status, 404); assert.equal((await fetch(`${base}/missing`, { headers: adminHeaders })).status, 404);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await prisma.order.deleteMany({ where: { userId: { in: users } } });
    if (productId) await prisma.product.delete({ where: { id: productId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
});
test.after(async () => prisma.$disconnect());
