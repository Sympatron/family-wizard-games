import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunnerClock} from '../games/dino-rush-battle/runner/clock.js';

test('runner clock suspends time while paused and discards large resume gaps', () => {
    const clock = createRunnerClock();
    assert.equal(clock.tick(1000), 0);
    assert.equal(clock.tick(1020), 0.02);
    clock.pause();
    assert.equal(clock.paused, true);
    assert.equal(clock.tick(2000), 0);
    assert.equal(clock.tick(3000), 0);
    clock.resume();
    assert.equal(clock.paused, false);
    assert.equal(clock.tick(4000), 0);
    assert.equal(clock.tick(4016), 0.016);
});
test('clock handles repeated pause/resume without negative elapsed times', () => {
    const clock = createRunnerClock();
    clock.pause();
    clock.pause();
    assert.equal(clock.tick(100), 0);
    clock.resume();
    clock.resume();
    assert.equal(clock.tick(200), 0);
    assert.equal(clock.tick(210), 0.01);
    assert.equal(clock.tick(199), 0);
});
