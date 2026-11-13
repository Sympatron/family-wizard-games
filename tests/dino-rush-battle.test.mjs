import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_GAME, SPECIES, getEnemies, mergeOptions, getMergeChoices, reduceGame} from '../games/dino-rush-battle/core/game.js';
import {simulateBattle} from '../games/dino-rush-battle/core/battle.js';
import {BOARD_SIZE, battleCellAt, battleCellCenter, toBattleScreen, clientPointToCell} from '../games/dino-rush-battle/core/board-layout.js';

const apply = (game, type, payload = {}) => reduceGame(game, {type, payload}).game;
const fresh = () => structuredClone(INITIAL_GAME);

test('runner collection, formation, branch evolution and battle reward form a stage loop', () => {
    let game = apply(fresh(), 'complete-runner', {collected: ['raptor', 'raptor', 'triceratops']});
    assert.equal(game.run.phase, 'formation');
    assert.equal(game.run.army.length, 4);
    assert.equal(game.run.inventory.length, 0);
    const id = game.run.army.find(unit => unit.id !== 'd1').id;
    game = apply(game, 'place', {id, cell: 5});
    assert.equal(game.run.army.find(unit => unit.id === id).cell, 5);
    assert.equal(game.run.inventory.length, 0);
    const pair = mergeOptions([...game.run.army, ...game.run.inventory]).find(item => item.species === 'raptor');
    assert.ok(pair);
    game = apply(game, 'merge', {ids: pair.ids, into: 'raptor'});
    assert.equal(game.run.army.filter(unit => unit.species === 'raptor' && unit.level === 2).length, 1);
    assert.ok(!game.run.army.some(unit => pair.ids.includes(unit.id)));
    game = apply(game, 'start-battle');
    assert.equal(game.run.phase, 'battle');
    game = apply(game, 'resolve-battle', {winner: 'player', survivors: game.run.army.map(unit => ({id: unit.id, hp: 25}))});
    assert.equal(game.run.phase, 'rewards');
    assert.equal(game.run.money, 35);
    assert.ok(game.run.army.every(unit => unit.hp >= 25));
    game = apply(game, 'buy-potion');
    assert.equal(game.run.money, 15);
    assert.equal(game.run.potions, 1);
    assert.throws(() => apply(game, 'buy-battle-damage'), /Nicht genug Geld/);
    game = apply(game, 'next-stage');
    assert.equal(game.run.stage, 2);
    assert.equal(game.run.battleUpgrades.damage, 0);
    assert.equal(game.run.phase, 'runner');
});
test('loss resets temporary progress and awards persistent meta currency', () => {
    let game = apply(fresh(), 'complete-runner', {collected: ['pteranodon']});
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'enemy', survivors: []});
    assert.equal(game.run.phase, 'gameover');
    assert.equal(game.run.money, 0);
    assert.equal(game.meta.currency, 5);
    game = apply(game, 'upgrade', {kind: 'starterHp'});
    assert.equal(game.meta.currency, 0);
    game = apply(game, 'new-run');
    assert.equal(game.run.phase, 'runner');
    assert.equal(game.run.stage, 1);
    assert.equal(game.meta.upgrades.starterHp, 1);
    assert.ok(game.run.army[0].hp > SPECIES.raptor.hp);
});
test('auto placement prioritizes tanks and supports returning dinos to reserve', () => {
    let game = apply(fresh(), 'complete-runner', {collected: ['pteranodon', 'triceratops', 'raptor']});
    game = apply(game, 'auto-place');
    assert.equal(game.run.army.length, 4);
    assert.equal(game.run.inventory.length, 0);
    assert.equal(game.run.army[0].species, 'triceratops');
    assert.equal(game.run.army.at(-1).species, 'pteranodon');
    assert.deepEqual(game.run.army.map(unit => unit.cell), [0, 1, 2, 3]);
    const id = game.run.army[0].id;
    game = apply(game, 'reserve', {id});
    assert.equal(game.run.army.length, 3);
    assert.equal(game.run.inventory.find(unit => unit.id === id).cell, null);
    assert.throws(() => apply(game, 'reserve', {id}));
});
test('invalid placements, merges and out-of-order phases are rejected', () => {
    const game = fresh();
    assert.throws(() => apply(game, 'start-battle'));
    assert.throws(() => apply(game, 'place', {id: 'd1', cell: -1}));
    const ready = apply(game, 'complete-runner', {collected: ['pteranodon']});
    assert.throws(() => apply(ready, 'merge', {ids: ['d1', 'd2'], into: 'troodon'}));
    assert.throws(() => apply(ready, 'place', {id: 'd2', cell: 16}));
});
test('combat simulation is repeatable and survivors remain within health bounds', () => {
    const game = fresh();
    const army = [{...game.run.army[0], species: 'ankylosaurus', hp: SPECIES.ankylosaurus.hp}];
    const enemies = [{id: 'e1', species: 'raptor', level: 1, cell: 0, hp: 1}];
    const result = simulateBattle(army, enemies);
    const again = simulateBattle(army, enemies);
    assert.equal(result.winner, 'player');
    assert.deepEqual(result.survivors, again.survivors);
    assert.ok(result.frames.length > 1);
    assert.ok(result.survivors.every(unit => unit.hp > 0 && unit.hp <= SPECIES.ankylosaurus.hp));
    assert.equal(getEnemies(1).length, 4);
});

test('combat board uses horizontally rotated grids with opponents above the player', () => {
    for (const portrait of [false, true]) {
        const size = portrait ? BOARD_SIZE.portrait : BOARD_SIZE.landscape;
        for (let cell = 0; cell < 15; cell++) {
            const friendly = battleCellCenter('player', cell, portrait);
            const enemy = battleCellCenter('enemy', cell, portrait);
            assert.equal(battleCellAt(friendly.x, friendly.y, portrait), cell);
            assert.ok(friendly.y > enemy.y);
            assert.ok(friendly.x > 0 && friendly.x < size.width);
            assert.ok(enemy.y > 0 && enemy.y < size.height);
        }
        const first = battleCellCenter('player', 0, portrait);
        const nextLane = battleCellCenter('player', 1, portrait);
        const nextDepth = battleCellCenter('player', 5, portrait);
        assert.ok(nextLane.x > first.x, 'Five lanes should run from left to right');
        assert.ok(nextDepth.y > first.y, 'Rear rows should be further down');
        assert.equal(battleCellAt(-1, -1, portrait), null);
        const origin = toBattleScreen(480, 198, portrait);
        assert.ok(origin.x > 0 && origin.y > 0);
    }
});

test('combat grids remain separated near the top and bottom of compact boards', () => {
    for (const portrait of [false, true]) {
        const {width, height} = portrait ? BOARD_SIZE.portrait : BOARD_SIZE.landscape;
        const top = Array.from({length: 15}, (_, i) => battleCellCenter('enemy', i, portrait));
        const bottom = Array.from({length: 15}, (_, i) => battleCellCenter('player', i, portrait));
        assert.ok(Math.min(...top.map(p => p.y)) < height * 0.2);
        assert.ok(Math.max(...top.map(p => p.y)) < height / 2);
        assert.ok(Math.min(...bottom.map(p => p.y)) > height / 2);
        assert.ok(Math.max(...top.map(p => p.y)) + 30 < Math.min(...bottom.map(p => p.y)) - 30);
        assert.ok([...top, ...bottom].every(p => p.x > 20 && p.x < width - 20 && p.y > 40 && p.y < height - 40));
    }
});

test('collected dinosaurs automatically fill free front and rear cells', () => {
    let game = apply(fresh(), 'complete-runner', {collected: ['raptor', 'pteranodon', 'triceratops']});
    assert.equal(game.run.army.length, 4);
    assert.deepEqual(game.run.army.map(unit => unit.cell), [0, 1, 14, 2]);
    assert.equal(game.run.inventory.length, 0);
    const reserved = apply(game, 'reserve', {id: 'd2'});
    assert.ok(reserved.run.inventory.some(unit => unit.id === 'd2'));
    assert.deepEqual(reserved.run.army.map(unit => unit.cell), [0, 14, 2]);
});

test('moving a deployed dinosaur onto an occupied cell swaps rather than reserves', () => {
    let game = apply(fresh(), 'complete-runner', {collected: ['raptor', 'triceratops']});
    const first = game.run.army.find(unit => unit.id === 'd2');
    const second = game.run.army.find(unit => unit.id === 'd3');
    const originalFirst = first.cell;
    const originalSecond = second.cell;
    game = apply(game, 'place', {id: first.id, cell: originalSecond});
    assert.equal(game.run.army.find(unit => unit.id === first.id).cell, originalSecond);
    assert.equal(game.run.army.find(unit => unit.id === second.id).cell, originalFirst);
    assert.equal(game.run.inventory.length, 0);
    game = apply(game, 'reserve', {id: second.id});
    game = apply(game, 'place', {id: second.id, cell: originalSecond});
    assert.equal(game.run.inventory.length, 1);
    assert.ok(game.run.inventory.some(unit => unit.id === first.id));
    assert.equal(game.run.army.find(unit => unit.id === second.id).cell, originalSecond);
});
test('an early battle can be won by rescuing and deploying one dinosaur', () => {
    const game = apply(fresh(), 'complete-runner', {collected: ['raptor']});
    const result = simulateBattle(game.run.army, getEnemies(1));
    assert.equal(result.winner, 'player');
});

test('rescued units beyond the grid capacity are kept in the reserve', () => {
    const game = apply(fresh(), 'complete-runner', {collected: Array(20).fill('raptor')});
    assert.equal(game.run.army.length, 15);
    assert.equal(game.run.inventory.length, 6);
    assert.equal(new Set(game.run.army.map(unit => unit.cell)).size, 15);
    assert.ok(game.run.inventory.every(unit => unit.cell === null));
    assert.equal(new Set([...game.run.army, ...game.run.inventory].map(unit => unit.id)).size, 21);
});
test('new stage collections preserve the positions of surviving dinosaurs', () => {
    let game = apply(fresh(), 'complete-runner', {collected: ['pteranodon']});
    const previous = game.run.army.map(unit => ({id: unit.id, cell: unit.cell}));
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'player', survivors: game.run.army.map(unit => ({id: unit.id, hp: unit.hp}))});
    game = apply(game, 'next-stage');
    game = apply(game, 'complete-runner', {collected: ['raptor']});
    for (const unit of previous) assert.equal(game.run.army.find(dino => dino.id === unit.id).cell, unit.cell);
    assert.equal(game.run.army.length, 3);
    assert.equal(game.run.inventory.length, 0);
});

test('touch and mouse positions map to correct formation cell in scaled canvases', () => {
    for (const portrait of [true, false]) {
        const size = portrait ? BOARD_SIZE.portrait : BOARD_SIZE.landscape;
        for (const scale of [0.3, 0.55, 1, 1.2]) {
            const rect = {left: 40, top: 75, width: size.width * scale, height: size.height * scale};
            rect.right = rect.left + rect.width;
            rect.bottom = rect.top + rect.height;
            for (let i = 0; i < 15; i++) {
                const center = battleCellCenter('player', i, portrait);
                const x = rect.left + center.x * scale;
                const y = rect.top + center.y * scale;
                assert.equal(clientPointToCell(x, y, rect, portrait), i);
            }
            assert.equal(clientPointToCell(rect.left - 5, rect.top, rect, portrait), null);
            assert.equal(clientPointToCell(rect.right + 5, rect.bottom, rect, portrait), null);
        }
    }
});
test('runner upgrades are bounded to prevent runaway cage damage', () => {
    const game = apply(fresh(), 'complete-runner', {collected: [], temporary: {damage: 6, fireRate: 6, bullets: 7}});
    assert.deepEqual(game.run.temporary, {damage: 6, fireRate: 6, bullets: 5, pickupRange: 1.8});
});

test('equal species merge to the next mastery tier before branching', () => {
    const game = apply(fresh(), 'complete-runner', {collected: ['raptor', 'raptor']});
    const [target, source] = game.run.army.filter(unit => unit.species === 'raptor').slice(0, 2);
    assert.deepEqual(getMergeChoices(source, target), ['raptor']);
    assert.deepEqual(getMergeChoices(target, target), []);
    assert.deepEqual(getMergeChoices({...source, level: 2}, target), []);
    assert.deepEqual(getMergeChoices({...source, species: 'triceratops'}, target), []);
    const upgraded = apply(game, 'merge', {ids: [target.id, source.id], into: 'raptor'});
    assert.equal(upgraded.run.army.length, game.run.army.length - 1);
    const evolved = upgraded.run.army.find(unit => unit.species === 'raptor' && unit.level === 2);
    assert.ok(evolved);
    assert.equal(evolved.cell, target.cell);
    assert.equal(evolved.level, 2);
    assert.ok(!upgraded.run.army.some(unit => [target.id, source.id].includes(unit.id)));
    assert.throws(() => apply(game, 'merge', {ids: [target.id, source.id], into: 'ankylosaurus'}));
});

test('coins collected during runner add to in-run money and reject invalid rewards', () => {
    const result = reduceGame(fresh(), {type: 'complete-runner', payload: {collected: [], coins: 17}});
    assert.match(result.message, /\+17 Münzen eingesammelt/);
    let game = result.game;
    assert.equal(game.run.money, 17);
    game = apply(game, 'start-battle');
    assert.equal(game.run.money, 17);
    assert.throws(() => apply(fresh(), 'complete-runner', {collected: [], coins: -1}));
    assert.throws(() => apply(fresh(), 'complete-runner', {collected: [], coins: 1.25}));
    assert.throws(() => apply(fresh(), 'complete-runner', {collected: [], coins: 10000}));
});

test('rare cages rescue evolved species and reinforced cages rescue Tier II', () => {
    const game = apply(fresh(), 'complete-runner', {collected: [{species: 'allosaurus', level: 1}, {species: 'triceratops', level: 2}]});
    assert.equal(game.run.army.find(unit => unit.species === 'allosaurus').level, 1);
    assert.equal(game.run.army.find(unit => unit.species === 'triceratops').level, 2);
    assert.throws(() => apply(fresh(), 'complete-runner', {collected: [{species: 'tyrannosaurus', level: 1}]}));
    assert.throws(() => apply(fresh(), 'complete-runner', {collected: [{species: 'raptor', level: 4}]}));
});

test('temporary magnet radius is saved for the stage and resets next stage', () => {
    let game = apply(fresh(), 'complete-runner', {collected: [], temporary: {pickupRange: 6}});
    assert.equal(game.run.temporary.pickupRange, 6);
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'player', survivors: game.run.army.map(unit => ({id: unit.id, hp: unit.hp}))});
    game = apply(game, 'next-stage');
    assert.equal(game.run.temporary.pickupRange, 1.8);
});

test('runner completion preserves absolute fractional stats and compounded positive upgrades', () => {
    const game = apply(fresh(), 'complete-runner', {collected: [], temporary: {damage: 8.4, fireRate: 5.7, bullets: 3, pickupRange: 7.1}});
    assert.deepEqual(game.run.temporary, {damage: 8.4, fireRate: 5.7, bullets: 3, pickupRange: 7.1});
});
