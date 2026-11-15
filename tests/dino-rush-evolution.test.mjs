import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIES, INITIAL_GAME, getMergeChoices, migrateGame, reduceGame, maxHp} from '../games/dino-rush-battle/core/game.js';

const apply = (game, type, payload = {}) => reduceGame(game, {type, payload}).game;
const ready = () => apply(structuredClone(INITIAL_GAME), 'complete-runner', {collected: []});
const unit = (id, species, level, cell) => ({id, species, level, cell, hp: maxHp({species, level})});

test('expanded tree has 27 species with correct rank widths and connected branches', () => {
    assert.equal(Object.keys(SPECIES).length, 27);
    for (const [rank, count] of [[1, 3], [2, 6], [3, 12], [4, 6]]) {
        const species = Object.values(SPECIES).filter(info => info.rank === rank);
        assert.equal(species.length, count);
        for (const info of species) {
            assert.equal(info.evolutions.length, rank < 3 ? 2 : rank === 3 ? 1 : 0);
            assert.ok(info.hp > 0 && info.damage > 0 && info.cooldown > 0);
            for (const child of info.evolutions) assert.equal(SPECIES[child].rank, rank + 1);
        }
    }
});
test('two matching dinosaurs merge Tier I → II → III without spending money', () => {
    let game = ready();
    game.run.army = [unit('d1', 'raptor', 1, 0), unit('d2', 'raptor', 1, 1)];
    game.run.inventory = [];
    game.run.nextId = 3;
    const money = game.run.money;
    assert.deepEqual(getMergeChoices(game.run.army[0], game.run.army[1]), ['raptor']);
    game = apply(game, 'merge', {ids: ['d1', 'd2'], into: 'raptor'});
    const veteran = game.run.army[0];
    assert.equal(veteran.level, 2);
    assert.equal(veteran.species, 'raptor');
    game.run.inventory.push(unit('d4', 'raptor', 2, null));
    game.run.nextId = 5;
    game = apply(game, 'merge', {ids: [veteran.id, 'd4'], into: 'raptor'});
    assert.equal(game.run.army[0].level, 3);
    assert.deepEqual(SPECIES[game.run.army[0].species].evolutions, ['allosaurus', 'troodon']);
    assert.equal(game.run.money, money);
    assert.equal(game.run.army[0].cell, 0);
});
test('Tier III species merge into a chosen new species at Tier I', () => {
    let game = ready();
    game.run.army = [unit('d1', 'raptor', 3, 0), unit('d2', 'raptor', 3, 1)];
    game.run.nextId = 3;
    assert.deepEqual(getMergeChoices(...game.run.army), ['allosaurus', 'troodon']);
    game = apply(game, 'merge', {ids: ['d1', 'd2'], into: 'troodon'});
    assert.deepEqual([game.run.army[0].species, game.run.army[0].level], ['troodon', 1]);
    assert.throws(() => apply(game, 'merge', {ids: ['d3', 'd3'], into: 'troodon'}));
});
test('apex inherits its Rank III predecessor trait and cannot evolve beyond Tier III', () => {
    let game = ready();
    game.run.army = [unit('d1', 'giganotosaurus', 3, 0), unit('d2', 'giganotosaurus', 3, 1)];
    game.run.nextId = 3;
    game = apply(game, 'merge', {ids: ['d1', 'd2'], into: 'tyrannosaurus'});
    const apex = game.run.army[0];
    assert.deepEqual([apex.species, apex.level, apex.trait], ['tyrannosaurus', 1, 'cleave']);
    assert.deepEqual(getMergeChoices({...apex, level: 3}, {...apex, id: 'd9', level: 3}), []);
});
test('saved Rank II dinosaurs migrate from legacy level two without losing the game', () => {
    const old = structuredClone(INITIAL_GAME);
    old.version = 1;
    old.run.phase = 'formation';
    old.run.army = [unit('d1', 'allosaurus', 2, 0)];
    const converted = migrateGame(old);
    assert.equal(converted.version, 3);
    assert.equal(converted.run.army[0].level, 1);
    assert.equal(old.run.army[0].level, 2);
    assert.equal(migrateGame(converted), converted);
    const next = apply(old, 'reserve', {id: 'd1'});
    assert.equal(next.version, 3);
    assert.equal(next.run.inventory[0].level, 1);
});

test('legacy saved health percentages survive conversion to the new rank curve', () => {
    const old = structuredClone(INITIAL_GAME);
    old.version = 1;
    old.run.phase = 'formation';
    const previousMaximum = Math.round(SPECIES.allosaurus.hp * 1.2);
    old.run.army = [{id: 'd1', species: 'allosaurus', level: 2, hp: Math.floor(previousMaximum / 2), cell: 0}];
    const migrated = migrateGame(old);
    const dinosaur = migrated.run.army[0];
    assert.equal(dinosaur.level, 1);
    assert.ok(Math.abs(dinosaur.hp / maxHp(dinosaur) - 0.5) < 0.02);
});
test('an apex keeps the chosen branch trait while merging further mastery tiers', () => {
    let game = ready();
    game.run.army = [
        {...unit('d1', 'tyrannosaurus', 1, 0), trait: 'cleave'},
        {...unit('d2', 'tyrannosaurus', 1, 1), trait: 'cleave'}
    ];
    game.run.nextId = 3;
    game = apply(game, 'merge', {ids: ['d1', 'd2'], into: 'tyrannosaurus'});
    assert.equal(game.run.army[0].level, 2);
    assert.equal(game.run.army[0].trait, 'cleave');
});
