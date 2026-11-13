import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunnerWave, cageHitPoints, RUNNER_SPECIES, ADVANCED_SPECIES} from '../games/dino-rush-battle/runner/spawns.js';
import {volleyPattern} from '../games/dino-rush-battle/runner/shots.js';

test('shots split total damage evenly and fan outward', () => {
    for (const bullets of [1, 2, 3, 4, 5]) {
        const shots = volleyPattern(bullets, 4);
        assert.equal(shots.length, bullets);
        assert.ok(Math.abs(shots.reduce((sum, shot) => sum + shot.damage, 0) - 4) < 1e-10);
        assert.equal(shots[0].spread, -shots.at(-1).spread);
        assert.equal(shots[0].offset, -shots.at(-1).offset);
        if (bullets > 1) assert.ok(shots[0].spread < 0 && shots.at(-1).spread > 0);
    }
    assert.deepEqual(volleyPattern(4, 4).map(shot => shot.damage), [1, 1, 1, 1]);
    assert.throws(() => volleyPattern(0, 4));
    assert.throws(() => volleyPattern(6, 4));
});
test('runner averages nine common cage encounters per early stage, with rare rewards gated', () => {
    let seed = 518;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
    const early = Array.from({length: 9}, (_, wave) => createRunnerWave(wave, 1, random)).flat();
    assert.equal(early.length, 9);
    assert.ok(early.every(cage => cage.rarity === 'common' && cage.level === 1 && RUNNER_SPECIES.includes(cage.species)));
    const late = Array.from({length: 900}, (_, wave) => createRunnerWave(wave, 12, random)).flat();
    assert.ok(late.some(cage => cage.rarity === 'rare' && ADVANCED_SPECIES.includes(cage.species)));
    assert.ok(late.some(cage => cage.rarity === 'reinforced' && cage.level === 2));
    assert.ok(late.every(cage => cage.kind === 'cage' && cage.x >= -4.9 && cage.x <= 4.9));
    assert.ok(late.every(cage => cage.hp === cageHitPoints(12, cage.rarity)));
    assert.ok(cageHitPoints(1, 'common') < cageHitPoints(1, 'reinforced'));
    assert.ok(cageHitPoints(1, 'reinforced') < cageHitPoints(1, 'rare'));
});
