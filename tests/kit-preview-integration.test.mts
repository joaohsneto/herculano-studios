import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Server, AddressInfo } from 'node:net';
import '../backend/node_modules/dotenv/config.js';
import express from '../backend/node_modules/express/index.js';
import multer from '../backend/node_modules/multer/index.js';
const storage = await mkdtemp(path.join(tmpdir(), 'hs-kit-integration-'));
process.env.PRIVATE_STORAGE_PATH = storage;
process.env.PREVIEW_STORAGE_PATH = storage;
process.env.FFMPEG_PATH = new URL('../.tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg', import.meta.url).pathname;
const { prisma } = await import('../backend/src/lib/prisma.ts');
const { kitPreviewRouter } = await import('../backend/src/routes/kit-previews.ts');
const { default: mediaRouter } = await import('../backend/src/routes/media.ts');
const exec = promisify(execFile);

test('kit: seleção persistente, troca individual, duplicados, falhas e privacidade da audição', { skip: process.env.KIT_PREVIEW_INTEGRATION !== '1' }, async () => {
  let productId: string | undefined; let server: Server | undefined;
  try {
    const suffix = randomUUID();
    const product = await prisma.product.create({ data: { name: 'Kit de teste', slug: `kit-test-${suffix}`, type: 'DRUM_KIT', shortDescription: 'Kit de teste privado', description: 'Produto temporário para validação das prévias.' } });
    productId = product.id;
    const app = express(); app.use(express.json());
    // The test-only mount exercises the handler without changing real user sessions.
    app.use('/test/:productId/drum-kit-previews', kitPreviewRouter(multer({ dest: storage })));
    app.use('/api/media', mediaRouter);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const base = `${origin}/test/${productId}/drum-kit-previews`;
    const wave = Buffer.alloc(44 + 44100 * 2);
    wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8); wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22); wave.writeUInt32LE(44100, 24); wave.writeUInt32LE(88200, 28);
    wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
    for (const name of ['a.wav', 'b.wav', 'c.wav']) await writeFile(path.join(storage, name), wave);
    await exec('zip', ['-q', 'kit.zip', 'a.wav', 'b.wav', 'c.wav'], { cwd: storage });
    const form = new FormData(); form.append('file', new Blob([await readFile(path.join(storage, 'kit.zip'))]), 'kit.zip');
    const uploaded = await fetch(base, { method: 'POST', body: form }); assert.equal(uploaded.status, 201, await uploaded.text());
    const initial = await (await fetch(base)).json(); assert.equal(initial.sourceAvailable, true);
    assert.equal(initial.groups.length, 1); const group = initial.groups[0]; assert.equal(group.items.length, 2); assert.equal(group.candidates.length, 3);
    const original = group.items[0]; const untouched = group.items[1]; const candidate = group.candidates.find((item: any) => !item.selected);
    const audition = await fetch(`${base}/audition?entry=${encodeURIComponent(candidate.entry)}`); assert.equal(audition.status, 200);
    assert.match(audition.headers.get('cache-control')!, /no-store/); assert.ok((await audition.arrayBuffer()).byteLength > 0);
    assert.equal((await fetch(`${origin}/api/media/admin/products/${productId}/drum-kit-previews`)).status, 401);
    assert.equal((await fetch(`${origin}/api/media/admin/products/${productId}/drum-kit-previews/audition?entry=a.wav`)).status, 401);
    const replace = (body: object) => fetch(`${base}/${original.id}/replacement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await replace({ entry: untouched.sourceEntry, expectedKey: original.storageKey })).status, 400);
    assert.equal((await replace({ entry: '../a.wav', expectedKey: original.storageKey })).status, 400);
    assert.equal((await replace({ entry: candidate.entry, expectedKey: original.storageKey })).status, 200);
    const updated = await (await fetch(base)).json(); const newItem = updated.groups[0].items.find((item: any) => item.id === original.id);
    assert.equal(newItem.sourceEntry, candidate.entry); assert.notEqual(newItem.storageKey, original.storageKey);
    assert.deepEqual(updated.groups[0].items.find((item: any) => item.id === untouched.id), untouched);
    assert.equal((await replace({ random: true, expectedKey: original.storageKey })).status, 409);
    const source = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: `kit-source-${productId}` } });
    await writeFile(path.join(storage, 'broken.wav'), 'bad audio'); await exec('zip', ['-q', source.storageKey, 'broken.wav'], { cwd: storage });
    assert.equal((await replace({ entry: 'broken.wav', expectedKey: newItem.storageKey })).status, 422);
    assert.equal((await prisma.previewAudio.findUniqueOrThrow({ where: { id: original.id } })).storageKey, newItem.storageKey);
    assert.equal((await fetch(`${base}/audition?entry=../a.wav`)).status, 404);
    const random = await replace({ random: true, expectedKey: newItem.storageKey });
    // The deliberately broken candidate may be drawn; either result preserves a valid preview.
    assert.ok([200, 422].includes(random.status));
    const publicProduct = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { previewGroups: { include: { items: true } } } });
    assert.equal(publicProduct.previewGroups[0]!.items.length, 2);
    // Older kits reuse an existing download ZIP; attaching the source keeps their picks.
    await prisma.mediaAsset.update({ where: { id: source.id }, data: { id: `legacy-${suffix}`, kind: 'DOWNLOAD', fileName: 'kit.zip' } });
    await prisma.previewAudio.updateMany({ where: { group: { productId } }, data: { sourceEntry: null } });
    const legacy = await (await fetch(base)).json(); assert.equal(legacy.sourceAvailable, true);
    assert.equal(legacy.groups[0].candidates.filter((item: any) => item.selected).length, 2);
    const preserved = legacy.groups[0].items.map((item: any) => ({ id: item.id, storageKey: item.storageKey, name: item.name }));
    const attach = new FormData(); attach.append('file', new Blob([await readFile(path.join(storage, 'kit.zip'))]), 'kit.zip');
    assert.equal((await fetch(base, { method: 'POST', body: attach })).status, 201);
    const attached = await (await fetch(base)).json();
    assert.deepEqual(attached.groups[0].items.map((item: any) => ({ id: item.id, storageKey: item.storageKey, name: item.name })), preserved);
    assert.ok(attached.groups[0].items.every((item: any) => item.sourceEntry));
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    if (productId) await prisma.product.delete({ where: { id: productId } });
  }
});
test.after(async () => { await prisma.$disconnect(); await rm(storage, { recursive: true, force: true }); });
