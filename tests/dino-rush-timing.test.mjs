import test from 'node:test';
import assert from 'node:assert/strict';
import {frameDeltaSeconds} from '../games/dino-rush-battle/runner/timing.js';
import {createRunnerNotice} from '../games/dino-rush-battle/runner/notices.js';

test('first frame and stale RAF timestamps never produce negative elapsed time', () => {
    assert.equal(frameDeltaSeconds(null, 0), 0);
    assert.equal(frameDeltaSeconds(1500, 0), 0);
    assert.equal(frameDeltaSeconds(1500, 1499), 0);
    assert.equal(frameDeltaSeconds(1500, 1510), 0.01);
    assert.equal(frameDeltaSeconds(1500, 2000), 0.05);
    assert.equal(frameDeltaSeconds(NaN, 2000), 0);
    assert.equal(frameDeltaSeconds(1500, Infinity), 0);
    const notice = createRunnerNotice();
    assert.doesNotThrow(() => notice.tick(frameDeltaSeconds(1500, 0)));
});
