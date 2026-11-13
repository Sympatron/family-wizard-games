import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateBattle} from '../games/dino-rush-battle/core/battle.js';
import {SPECIES} from '../games/dino-rush-battle/core/game.js';

const dino = (id, species, cell) => ({id, species, cell, level: 1, hp: SPECIES[species].hp});

test('opposing armies begin with a larger gap before approaching', () => {
    const result = simulateBattle([dino('a', 'raptor', 0)], [dino('e', 'raptor', 0)]);
    const initial = result.frames[0];
    const player = initial.find(unit => unit.team === 'player');
    const enemy = initial.find(unit => unit.team === 'enemy');
    assert.ok(enemy.x - player.x >= 680, 'armies must start at least 680 virtual units apart');
    assert.ok(Math.abs(enemy.y - player.y) < 1);
});

test('ranged attacks produce visible projectile events with source and destination', () => {
    const result = simulateBattle([dino('a', 'pteranodon', 0)], [dino('e', 'raptor', 0)]);
    const shots = result.frames.flatMap(frame => frame.shots ?? []);
    assert.ok(shots.some(shot => shot.team === 'player' && shot.species === 'pteranodon'));
    for (const shot of shots) {
        assert.ok(Number.isFinite(shot.x) && Number.isFinite(shot.y));
        assert.ok(Number.isFinite(shot.tx) && Number.isFinite(shot.ty));
        assert.ok(Math.hypot(shot.tx - shot.x, shot.ty - shot.y) > 0);
    }
});

test('melee-only battle does not spawn ranged projectiles', () => {
    const result = simulateBattle([dino('a', 'raptor', 0)], [dino('e', 'raptor', 0)]);
    assert.equal(result.frames.flatMap(frame => frame.shots ?? []).length, 0);
});

test('the wider opening gap increases actual approach travel instead of only scaling the display', () => {
    const result = simulateBattle([dino('a', 'raptor', 0)], [dino('e', 'raptor', 0)]);
    const [start, ...later] = result.frames;
    const player = start.find(unit => unit.team === 'player');
    const enemy = start.find(unit => unit.team === 'enemy');
    assert.equal(enemy.x - player.x, 800);
    const afterTwoSeconds = later[9];
    const playerLater = afterTwoSeconds.find(unit => unit.team === 'player');
    const enemyLater = afterTwoSeconds.find(unit => unit.team === 'enemy');
    assert.ok(enemyLater.x - playerLater.x > 500, 'dinosaurs should still be approaching after nearly two seconds');
    assert.equal(playerLater.hp, player.hp);
    assert.equal(enemyLater.hp, enemy.hp);
});
