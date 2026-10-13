import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
process.env.FFMPEG_PATH ||= new URL("../.tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg", import.meta.url).pathname;
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';
process.env.JWT_SECRET ||= 'kit-preview-test-secret-at-least-thirty-two-characters';
const { parseKitListing, chooseKitEntries, listKitEntries, createKitPreview } = await import('../backend/src/services/kit-preview.ts');
const { removeFile } = await import('../backend/src/services/media.ts');
const exec = promisify(execFile);

test('indexação: ignora metadados e caminhos inseguros e diferencia pastas com o mesmo nome', () => {
  const result = parseKitListing('Kit/Hats/a.wav\nKit/Hats/b.mp3\nKit/Other/Hats/a.wav\n../bad.wav\n/absolute.wav\n__MACOSX/._a.wav\nKit/.hidden.wav\nreadme.txt\nKit/Hats/a.wav\n');
  assert.equal(result.length, 3);
  assert.equal(result[0]?.group, 'Hats');
  assert.notEqual(result[0]?.folder, result[2]?.folder);
});
test('sorteio: nunca duplica um som e respeita pastas com menos de duas opções', () => {
  const entries = parseKitListing('Kit/Kicks/a.wav\nKit/Kicks/b.wav\nKit/Kicks/c.wav');
  for (let i = 0; i < 100; i++) assert.equal(new Set(chooseKitEntries(entries, 2).map(entry => entry.entry)).size, 2);
  assert.equal(chooseKitEntries(entries.slice(0, 1), 2).length, 1);
  assert.deepEqual(chooseKitEntries([], 2), []);
});
test('extração e conversão: audição curta, arquivo com caracteres de padrão e limpeza em falha', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'hs-kit-test-'));
  let generated: Awaited<ReturnType<typeof createKitPreview>> | undefined;
  try {
    // Small valid PCM wave, no external assets or real products.
    const wave = Buffer.alloc(44 + 44100 * 2);
    wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
    wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(44100, 24); wave.writeUInt32LE(88200, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
    wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
    await writeFile(path.join(directory, 'Hat [1].wav'), wave);
    await writeFile(path.join(directory, 'broken.wav'), 'not audio');
    await exec('zip', ['-q', 'kit.zip', 'Hat [1].wav', 'broken.wav'], { cwd: directory });
    const zip = path.join(directory, 'kit.zip'); const entries = await listKitEntries(zip);
    const chosen = entries.find(entry => entry.name === 'Hat [1]')!;
    generated = await createKitPreview(zip, chosen);
    assert.ok((await stat(generated.outputPath)).size > 0);
    assert.equal(generated.durationSec, 8);
    assert.ok((await readFile(zip)).length > 0);
    await assert.rejects(createKitPreview(zip, entries.find(entry => entry.name === 'broken')!));
  } finally { if (generated) await removeFile(generated.outputPath); await rm(directory, { recursive: true, force: true }); }
});
