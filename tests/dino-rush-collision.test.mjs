import test from 'node:test';
import assert from 'node:assert/strict';
import {bulletHitsCage} from '../games/dino-rush-battle/runner/collision.js';

test('projectiles hit a complete barred cage across its actual width and depth', () => {
    assert.ok(bulletHitsCage(0, -10, -16, 0, -13));
    assert.ok(bulletHitsCage(1.5, -10, -16, 0, -13));
    assert.ok(bulletHitsCage(-1.5, -10, -16, 0, -13));
    assert.ok(bulletHitsCage(4.8, -10, -16, 4.6, -13));
    assert.ok(!bulletHitsCage(1.9, -10, -16, 0, -13));
    assert.ok(!bulletHitsCage(0, -2, -4, 0, -13));
    assert.ok(!bulletHitsCage(0, -20, -22, 0, -13));
    assert.ok(bulletHitsCage(0, -16, -10, 0, -13));
});
