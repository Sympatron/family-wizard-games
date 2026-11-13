import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunnerWave, TRACK_HALF_WIDTH, RUNNER_SPECIES, blockedByGate} from '../games/dino-rush-battle/runner/spawns.js';

test('runner spawns only caged dinosaurs at arbitrary horizontal positions', () => {
    let seed = 439;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
    const waves = Array.from({length: 40}, (_, index) => createRunnerWave(index, 1, random));
    const objects = waves.flat();
    assert.ok(objects.every(item => item.kind === 'cage'));
    assert.ok(objects.every(item => RUNNER_SPECIES.includes(item.species)));
    assert.ok(objects.every(item => item.x >= -TRACK_HALF_WIDTH + 1.4 && item.x <= TRACK_HALF_WIDTH - 1.4));
    assert.ok(objects.some(item => Math.abs(item.x) < 1));
    assert.ok(objects.some(item => Math.abs(item.x - 3.2) > 1 && Math.abs(item.x + 3.2) > 1));
    for (const species of RUNNER_SPECIES) {
        const dinos = objects.filter(item => item.kind === 'cage' && item.species === species);
        assert.ok(dinos.some(item => item.x < 0), species + ' should appear on the left');
        assert.ok(dinos.some(item => item.x > 0), species + ' should appear on the right');
    }
    assert.ok(objects.every(item => item.z < -57));
    assert.ok(waves[0][0].kind === 'cage');
});
test('runner spawn distributions are not determined by stage and wave alone', () => {
    const one = createRunnerWave(1, 3, () => 0.1);
    const two = createRunnerWave(1, 3, () => 0.9);
    assert.notDeepEqual(one, two);
    assert.throws(() => createRunnerWave(-1, 1));
});

test('no objects spawn directly behind an active gate, including coins and cages', () => {
    const gates = [{kind: 'gate', z: -50, x: -3.2}, {kind: 'gate', z: -50, x: 3.2}];
    for (const z of [-51, -60, -79.9]) assert.equal(blockedByGate(z, gates), true);
    assert.equal(blockedByGate(-80, gates), false);
    assert.equal(blockedByGate(-40, gates), false);
    assert.equal(blockedByGate(-50, gates), false);
    assert.equal(blockedByGate(-70, [{kind: 'coin', z: -50}]), false);
    assert.equal(blockedByGate(-70, []), false);
});
