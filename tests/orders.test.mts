import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { AddressInfo, Server } from 'node:net';
import '../backend/node_modules/dotenv/config.js';
import express from '../backend/node_modules/express/index.js';
import cookieParser from '../backend/node_modules/cookie-parser/index.js';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';
process.env.AUTH_SECRET = 'orders-test-secret-at-least-thirty-two-characters';
process.env.JWT_SECRET ||= process.env.AUTH_SECRET;
const { prisma } = await import('../backend/src/lib/prisma.ts');
const { default: router } = await import('../backend/src/routes/orders.ts');
const { default: libraryRouter } = await import('../backend/src/routes/library.ts');
const require = createRequire(new URL('../backend/node_modules/@auth/express/index.js', import.meta.url));
const { encode } = await import(require.resolve('@auth/core/jwt'));

test('pedidos do cliente: isolamento, todas as situações, paginação, detalhes e vínculo com a biblioteca', { skip: process.env.ORDERS_INTEGRATION !== '1' }, async () => {
  const suffix = randomUUID(); const userIds: string[] = []; let productId: string | undefined; let server: Server | undefined;
  try {
    const buyer = await prisma.user.create({ data: { name: 'Order test buyer', email: `order-buyer-${suffix}@example.invalid` } }); userIds.push(buyer.id);
    const other = await prisma.user.create({ data: { name: 'Other buyer', email: `order-other-${suffix}@example.invalid` } }); userIds.push(other.id);
    const product = await prisma.product.create({ data: { name: 'E-book de teste', slug: `order-product-${suffix}`, type: 'EBOOK', shortDescription: 'Livro digital de teste', description: 'Livro para testar os pedidos', variants: { create: { name: 'PDF', format: 'PDF', licenseName: 'Uso pessoal', sku: `order-sku-${suffix}`, priceCents: 100 } } }, include: { variants: true } }); productId = product.id;
    async function createOrder(userId: string, status: 'PAID' | 'PENDING' | 'CANCELED' | 'REFUNDED', createdAt = new Date()) {
      return prisma.order.create({ data: { userId, status, currency: 'BRL', subtotalCents: 100, totalCents: 90, provider: 'MANUAL', providerRef: `private-${randomUUID()}`, createdAt, paidAt: status === 'PAID' ? new Date() : null, items: { create: { productId: product.id, variantId: product.variants[0].id, productName: 'Nome na compra', variantName: 'PDF adquirido', unitPriceCents: 100 } } } });
    }
    for (let i = 0; i < 11; i++) await createOrder(buyer.id, 'PAID', new Date(Date.now() - i * 1000));
    for (const status of ['PENDING', 'CANCELED', 'REFUNDED'] as const) await createOrder(buyer.id, status);
    const foreignOrder = await createOrder(other.id, 'PAID');
    const app = express(); app.use(cookieParser()); app.use('/api/account/orders', router); app.use('/api/account/library', libraryRouter);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; const base = `${origin}/api/account/orders`;
    const token = await encode({ token: { sub: buyer.id }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' }); const headers = { cookie: `authjs.session-token=${token}` };
    assert.equal((await fetch(base)).status, 401);
    async function list(params: Record<string, string> = {}) { const response = await fetch(`${base}?${new URLSearchParams(params)}`, { headers }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/); return response.json(); }
    const all = await list(); assert.deepEqual(all.counts, { ALL: 14, PAID: 11, PENDING: 1, CANCELED: 1, REFUNDED: 1 }); assert.equal(all.orders.length, 10); assert.equal(all.pagination.pages, 2); assert.equal(all.pagination.total, 14);
    const second = await list({ page: '2' }); assert.equal(second.orders.length, 4); assert.ok(!second.orders.some((order: any) => all.orders.some((first: any) => first.id === order.id)));
    assert.equal([...all.orders, ...second.orders].some((order: any) => order.id === foreignOrder.id), false);
    for (const status of ['PENDING', 'CANCELED', 'REFUNDED']) { const filtered = await list({ status }); assert.equal(filtered.orders.length, 1); assert.equal(filtered.orders[0].status, status); assert.equal(filtered.counts.ALL, 14); }
    const paid = await list({ status: 'PAID' }); assert.equal(paid.pagination.total, 11); assert.equal(paid.orders[0].subtotalCents, 100); assert.equal(paid.orders[0].totalCents, 90); assert.equal(paid.orders[0].items[0].productName, 'Nome na compra'); assert.equal(paid.orders[0].items[0].variantName, 'PDF adquirido'); assert.equal(paid.orders[0].items[0].variant.licenseName, 'Uso pessoal'); assert.ok(paid.orders[0].paidAt);
    for (const privateField of ['providerRef', 'passwordHash', 'userId', 'storageKey', 'emailChangeHash']) assert.equal(JSON.stringify(all).includes(privateField), false);
    assert.equal((await list({ page: '999' })).pagination.page, 2);
    for (const params of [{ page: '0' }, { status: 'INVALID' }, { page: '1.5' }]) assert.equal((await fetch(`${base}?${new URLSearchParams(params)}`, { headers })).status, 400);
    const library = await (await fetch(`${origin}/api/account/library`, { headers })).json(); assert.equal(library.items.length, 1);
    await prisma.order.updateMany({ where: { userId: buyer.id, status: 'PAID' }, data: { status: 'REFUNDED' } });
    const after = await list(); assert.equal(after.counts.PAID, 0); assert.equal(after.counts.REFUNDED, 12); assert.equal((await (await fetch(`${origin}/api/account/library`, { headers })).json()).items.length, 0);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    if (productId) await prisma.product.delete({ where: { id: productId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
test.after(async () => prisma.$disconnect());
