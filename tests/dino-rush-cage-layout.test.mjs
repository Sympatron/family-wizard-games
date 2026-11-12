import test from 'node:test';
import assert from 'node:assert/strict';
import {cageBarLayout} from '../games/dino-rush-battle/runner/cage-layout.js';

test('barred cages use three instanced batches with the original bars', () => {
    const {frame, iron, latch} = cageBarLayout();
    assert.equal(frame.length, 6);
    assert.equal(iron.length, 27);
    assert.equal(latch.length, 1);
    assert.ok([...frame, ...iron, ...latch].every(bar =>
        bar.size.length === 3 && bar.position.length === 3 && bar.size.every(value => value > 0 && Number.isFinite(value)) &&
        bar.position.every(Number.isFinite)));
    assert.equal(frame.filter(bar => bar.size[1] > 3).length, 4);
    assert.equal(iron.filter(bar => bar.size[1] > 2).length, 22);
});
test('layout preserves a locked front and roof bars', () => {
    const bars = cageBarLayout();
    assert.ok(bars.iron.some(bar => bar.position[2] > 1.3 && bar.position[1] === 1.59));
    assert.ok(bars.iron.some(bar => bar.position[1] === 3.2));
    assert.deepEqual(bars.latch[0].position, [0.36, 1.53, 1.51]);
});
