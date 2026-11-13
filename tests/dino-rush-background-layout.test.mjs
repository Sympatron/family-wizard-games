import test from 'node:test';
import assert from 'node:assert/strict';
import {battlefieldCover} from '../games/dino-rush-battle/battle/background-layout.js';

test('battlefield cover keeps the original image aspect ratio in planning and battle', () => {
    const sourceWidth = 1561, sourceHeight = 1008, height = 620;
    for (const width of [416, 768, 540, 960]) {
        const result = battlefieldCover(sourceWidth, sourceHeight, width, height);
        assert.ok(result.width >= width);
        assert.ok(result.height >= height);
        assert.ok(Math.abs(result.width / result.height - sourceWidth / sourceHeight) < 1e-12);
        assert.ok(Math.abs(Math.min(result.width / width, result.height / height) - 1) < 1e-12);
    }
});
test('battlefield cover rejects invalid source and viewport dimensions', () => {
    for (const invalid of [[0, 1008, 768, 620], [1561, 0, 768, 620], [1561, 1008, -1, 620], [1561, 1008, 768, NaN]]) {
        assert.throws(() => battlefieldCover(...invalid), /Spielfeldabmessungen/);
    }
});
