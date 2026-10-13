import assert from "node:assert/strict";
import test from "node:test";
import { movePreviewRange } from "../frontend/src/lib/preview-range.ts";

test("a seleção pode durar menos de 30 segundos", () => {
  assert.deepEqual(movePreviewRange({ start: 10, end: 22 }, "end", -7, 180), { start: 10, end: 15 });
});
test("as duas pontas respeitam o máximo de 30 segundos", () => {
  assert.deepEqual(movePreviewRange({ start: 10, end: 22 }, "end", 100, 180), { start: 10, end: 40 });
  assert.deepEqual(movePreviewRange({ start: 90, end: 102 }, "start", -100, 180), { start: 72, end: 102 });
});
test("arrastar preserva a duração e alcança as duas extremidades da música", () => {
  assert.deepEqual(movePreviewRange({ start: 30, end: 42 }, "window", 500, 180), { start: 168, end: 180 });
  assert.deepEqual(movePreviewRange({ start: 30, end: 42 }, "window", -500, 180), { start: 0, end: 12 });
});
test("não permite inverter as pontas nem selecionar além de um áudio curto", () => {
  assert.deepEqual(movePreviewRange({ start: 0, end: 2 }, "start", 10, 2), { start: 1.9, end: 2 });
  assert.deepEqual(movePreviewRange({ start: 0, end: 2 }, "end", 10, 2), { start: 0, end: 2 });
});
test("mover uma seleção de 30 segundos mantém a precisão decimal", () => {
  const next = movePreviewRange({ start: 2.1, end: 32.1 }, "window", 0.1, 180);
  assert.deepEqual(next, { start: 2.2, end: 32.2 });
});
