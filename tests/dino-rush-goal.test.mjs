import test from 'node:test';
import assert from 'node:assert/strict';
import {finishLinePosition} from '../games/dino-rush-battle/runner/goal.js';

test('finish arch reaches the player exactly when the runner timer reaches zero', () => {
    assert.equal(finishLinePosition(8, 17.6, 35), 8 - 17.6 * 35);
    assert.equal(finishLinePosition(8, 17.6, 10), 8 - 176);
    assert.equal(finishLinePosition(8, 17.6, 0), 8);
    assert.equal(finishLinePosition(8, 17.6, -1), 8);
    assert.ok(finishLinePosition(8, 17.6, 2) < finishLinePosition(8, 17.6, 1));
    assert.throws(() => finishLinePosition(8, 0, 5));
});
