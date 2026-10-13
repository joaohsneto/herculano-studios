import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidPreviewRange, previewDuration } from '../backend/src/services/preview-range.ts';

test('aceita o intervalo reportado 47,4–77,4 e normaliza para exatamente 30s', () => {
  assert.ok(77.4 - 47.4 > 30);
  assert.equal(isValidPreviewRange(47.4, 77.4), true);
  assert.equal(previewDuration(47.4, 77.4), 30);
});
test('aceita trechos menores e em qualquer ponto da música', () => {
  assert.equal(previewDuration(90, 95), 5);
  assert.equal(previewDuration(240, 270), 30);
});
test('rejeita durações realmente maiores que 30s e limites inválidos', () => {
  for (const [start, end] of [[47.4, 77.4001], [0, 30.1], [5, 5], [5, 4], [-1, 3], [NaN, 10], [0, Infinity]]) {
    assert.equal(isValidPreviewRange(start, end), false);
    assert.throws(() => previewDuration(start, end));
  }
});
