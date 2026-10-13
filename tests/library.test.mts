import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { AddressInfo, Server } from 'node:net';
import '../backend/node_modules/dotenv/config.js';
import express from '../backend/node_modules/express/index.js';
import cookieParser from '../backend/node_modules/cookie-parser/index.js';
import { filterLibrary, fileSize, type LibraryItem } from '../frontend/src/lib/library.ts';

const integration = process.env.LIBRARY_INTEGRATION === '1';
const storage = await mkdtemp(path.join(tmpdir(), 'hs-library-test-'));
process.env.PRIVATE_STORAGE_PATH = storage;
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';
process.env.AUTH_SECRET = 'library-test-secret-at-least-thirty-two-characters';
process.env.JWT_SECRET ||= process.env.AUTH_SECRET;
const { default: router, libraryFilePath } = await import('../backend/src/routes/library.ts');
const { prisma } = await import('../backend/src/lib/prisma.ts');
const require = createRequire(new URL('../backend/node_modules/@auth/express/index.js', import.meta.url));
const { encode } = await import(require.resolve('@auth/core/jwt'));

test('busca sem acentos, filtros de novos infoprodutos e ordenação sem modificar a coleção', () => {
  const items = [
    { id: '1', name: 'Produção musical', type: 'COURSE', shortDescription: 'Curso completo', variantName: 'Completo', format: 'MP4', licenseName: 'Uso pessoal', purchasedAt: '2026-01-01' },
    { id: '2', name: 'Guia de mixagem', type: 'EBOOK', shortDescription: 'Livro', variantName: 'PDF', format: 'PDF', purchasedAt: '2026-02-01' }
  ] as LibraryItem[];
  assert.deepEqual(filterLibrary(items, 'producao', 'ALL', 'newest').map(item => item.id), ['1']);
  assert.deepEqual(filterLibrary(items, '', 'EBOOK', 'newest').map(item => item.id), ['2']);
  assert.deepEqual(filterLibrary(items, 'pdf', 'ALL', 'newest').map(item => item.id), ['2']);
  assert.deepEqual(filterLibrary(items, '', 'ALL', 'newest').map(item => item.id), ['2', '1']);
  assert.deepEqual(items.map(item => item.id), ['1', '2']);
  assert.equal(fileSize(1024), '1 KB'); assert.equal(fileSize(1024 ** 3), '1 GB');
});
test('arquivos privados nunca escapam da pasta configurada', () => {
  assert.equal(libraryFilePath('../outside.zip'), null);
  assert.equal(libraryFilePath('/etc/passwd'), null);
  assert.equal(libraryFilePath('.'), null);
  assert.equal(libraryFilePath('valid.zip'), path.join(storage, 'valid.zip'));
});

test('biblioteca e downloads com banco real: propriedade, pagamento, versões e arquivos comuns', { skip: !integration }, async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({ data: { name: 'Library integration', email: `library-${suffix}@example.invalid` } });
  let server: Server | undefined;
  const productIds: string[] = []; const orderIds: string[] = [];
  try {
    const product = await prisma.product.create({ data: { name: 'Curso teste', slug: `course-${suffix}`, type: 'COURSE', status: 'ARCHIVED', shortDescription: 'Curso de produção musical', description: 'Conteúdo de teste de integração', deliveryInstructions: 'Abra o material com seu leitor.', variants: { create: [{ name: 'PDF', sku: `pdf-${suffix}`, format: 'PDF', priceCents: 100 }, { name: 'Premium', sku: `premium-${suffix}`, priceCents: 200 }] } }, include: { variants: true } });
    productIds.push(product.id);
    const ebook = await prisma.product.create({ data: { name: 'E-book teste', slug: `ebook-${suffix}`, type: 'EBOOK', shortDescription: 'Um livro de produção', description: 'Descrição completa de teste', variants: { create: { name: 'PDF', sku: `ebook-${suffix}`, priceCents: 100 } } }, include: { variants: true } });
    productIds.push(ebook.id);
    const [basic, premium] = product.variants;
    const asset = await prisma.mediaAsset.create({ data: { productId: product.id, variantId: basic.id, kind: 'DOWNLOAD', storageKey: 'guide.pdf', fileName: 'Guia.pdf', mimeType: 'application/pdf', sizeBytes: 12 } });
    await prisma.mediaAsset.create({ data: { productId: product.id, variantId: basic.id, kind: 'DOWNLOAD', storageKey: 'bonus.txt', fileName: 'Bônus.txt', mimeType: 'text/plain', sizeBytes: 6 } });
    const shared = await prisma.mediaAsset.create({ data: { productId: product.id, kind: 'DOWNLOAD', storageKey: 'common.txt', fileName: 'Leia-me.txt', mimeType: 'text/plain', sizeBytes: 6 } });
    const restricted = await prisma.mediaAsset.create({ data: { productId: product.id, variantId: premium.id, kind: 'DOWNLOAD', storageKey: 'premium.zip', fileName: 'Premium.zip', mimeType: 'application/zip', sizeBytes: 10 } });
    const foreignAsset = await prisma.mediaAsset.create({ data: { productId: ebook.id, kind: 'DOWNLOAD', storageKey: 'ebook.pdf', fileName: 'Livro.pdf', mimeType: 'application/pdf', sizeBytes: 10 } });
    await writeFile(path.join(storage, 'guide.pdf'), 'private-guide'); await writeFile(path.join(storage, 'common.txt'), 'shared');
    async function purchase(status: 'PAID' | 'PENDING' | 'REFUNDED', productId = product.id, variantId = basic.id) {
      const order = await prisma.order.create({ data: { userId: user.id, status, currency: 'BRL', subtotalCents: 100, totalCents: 100, paidAt: status === 'PAID' ? new Date() : null, items: { create: { productId, variantId, productName: productId === product.id ? product.name : ebook.name, variantName: 'PDF', unitPriceCents: 100 } } }, include: { items: true } });
      orderIds.push(order.id); return order.items[0];
    }
    const paid = await purchase('PAID'); const duplicate = await purchase('PAID'); const pending = await purchase('PENDING'); const refunded = await purchase('REFUNDED'); await purchase('PAID', ebook.id, ebook.variants[0].id);
    const app = express(); app.use(cookieParser()); app.use('/api/account/library', router);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/account/library`;
    const token = await encode({ token: { sub: user.id }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' });
    const headers = { cookie: `authjs.session-token=${token}` };
    const download = (purchaseId: string, assetId: string) => fetch(`${base}/${purchaseId}/files/${assetId}`, { headers });
    assert.equal((await fetch(base)).status, 401);
    const response = await fetch(base, { headers }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/);
    const data = await response.json(); assert.equal(data.items.length, 2);
    const course = data.items.find((item: any) => item.type === 'COURSE'); assert.ok(course); assert.equal(course.files.length, 3); assert.ok(course.files.some((file: any) => file.id === shared.id));
    assert.equal(JSON.stringify(data).includes('storageKey'), false); assert.equal(JSON.stringify(data).includes(storage), false);
    const allowed = await download(paid.id, asset.id); assert.equal(allowed.status, 200); assert.equal(await allowed.text(), 'private-guide'); assert.match(allowed.headers.get('content-disposition')!, /^attachment/);
    assert.equal((await download(duplicate.id, shared.id)).status, 200);
    assert.equal((await download(paid.id, restricted.id)).status, 404);
    assert.equal((await download(paid.id, foreignAsset.id)).status, 404);
    assert.equal((await download(pending.id, asset.id)).status, 404);
    assert.equal((await download(refunded.id, asset.id)).status, 404);
    assert.equal((await download('not-owned', asset.id)).status, 404);
    const other = await prisma.user.create({ data: { name: 'Other buyer', email: `other-library-${suffix}@example.invalid` } });
    try {
      const otherToken = await encode({ token: { sub: other.id }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' });
      assert.equal((await fetch(`${base}/${paid.id}/files/${asset.id}`, { headers: { cookie: `authjs.session-token=${otherToken}` } })).status, 404);
    } finally { await prisma.user.delete({ where: { id: other.id } }); }
    await rm(path.join(storage, 'guide.pdf'));
    assert.equal((await download(paid.id, asset.id)).status, 404);
    await prisma.order.update({ where: { id: orderIds[0] }, data: { status: 'REFUNDED' } });
    assert.equal((await download(paid.id, shared.id)).status, 404);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
test.after(async () => { await prisma.$disconnect(); await rm(storage, { recursive: true, force: true }); });
