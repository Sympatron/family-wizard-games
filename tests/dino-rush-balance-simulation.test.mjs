import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIES} from '../games/dino-rush-battle/core/game.js';
import {createRunnerWave, cageHitPoints, RUNNER_SPECIES, ADVANCED_SPECIES, ELITE_SPECIES} from '../games/dino-rush-battle/runner/spawns.js';
import {volleyPattern} from '../games/dino-rush-battle/runner/shots.js';
import {simulateBattle} from '../games/dino-rush-battle/core/battle.js';
import {toBattleScreen} from '../games/dino-rush-battle/core/board-layout.js';

function randomGenerator(seed) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

test('35-second stage offers fewer than eleven rescue opportunities early on', () => {
    const rng = randomGenerator(12345);
    const stages = [1, 3, 8, 15, 25, 45];
    for (const stage of stages) {
        const waves = Array.from({length: 10}, (_, index) => createRunnerWave(index, stage, rng));
        const cages = waves.flat();
        assert.equal(waves[0].length, 1);
        assert.equal(cages.length, stage < 4 ? 10 : 12);
        assert.ok(cages.every(cage => cage.hp >= 6 && cage.x >= -4.9 && cage.x <= 4.9));
        assert.ok(cages.every(cage => cage.rarity !== 'common' || RUNNER_SPECIES.includes(cage.species)));
        assert.ok(cages.every(cage => cage.rarity !== 'reinforced' || cage.level === 2));
        assert.ok(cages.every(cage => cage.rarity !== 'rare' || SPECIES[cage.species].rank <= 3));
    }
});
test('late rare cages advance progression without rescuing an apex directly', () => {
    const early = createRunnerWave(0, 8, () => 0)[0];
    const late = createRunnerWave(0, 25, () => 0, ['carnotaurus'])[0];
    const endgame = createRunnerWave(0, 46, () => 0, ['dilophosaurus'])[0];
    assert.ok(ADVANCED_SPECIES.includes(early.species));
    assert.equal(early.level, 1);
    assert.ok(ELITE_SPECIES.includes(late.species));
    assert.equal(late.species, 'carnotaurus');
    assert.equal(late.level, 2);
    assert.equal(endgame.species, 'dilophosaurus');
    assert.equal(endgame.level, 3);
    assert.ok(cageHitPoints(46, 'rare') <= 65);
});
test('weapon upgrades improve DPS but cannot multiply per-volley damage by bullet count', () => {
    for (const count of [1, 2, 3, 4, 5]) {
        for (const total of [1, 2, 3]) {
            const volley = volleyPattern(count, total);
            assert.ok(Math.abs(volley.reduce((sum, shot) => sum + shot.damage, 0) - total) < 1e-10);
            assert.ok(volley.every(shot => shot.damage <= total));
        }
    }
    assert.ok(cageHitPoints(15, 'common') > cageHitPoints(1, 'common'));
    assert.ok(cageHitPoints(15, 'reinforced') > cageHitPoints(15, 'common'));
});
test('initial battle armies are visibly separated in both orientations', () => {
    const make = (id, cell) => ({id, species: 'raptor', level: 1, cell, hp: SPECIES.raptor.hp});
    const frame = simulateBattle([make('d1', 0)], [make('e1', 0)]).frames[0];
    const player = frame.find(unit => unit.team === 'player');
    const enemy = frame.find(unit => unit.team === 'enemy');
    assert.ok(enemy.x - player.x >= 450);
    for (const portrait of [true, false]) {
        const p = toBattleScreen(player.x, player.y, portrait);
        const e = toBattleScreen(enemy.x, enemy.y, portrait);
        assert.ok(p.y - e.y > 370, 'armies need a substantial visible distance');
        assert.ok(p.y < 620 && e.y > 0);
    }
});
