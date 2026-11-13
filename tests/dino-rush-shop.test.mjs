import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_GAME, migrateGame, maxHp, reduceGame} from '../games/dino-rush-battle/core/game.js';
import {GUN_UPGRADES, gunUpgradeCost, healingCost} from '../games/dino-rush-battle/core/shop.js';
import {initialRunnerWeaponStats, SHOT_INTERVAL_SECONDS, volleyPattern} from '../games/dino-rush-battle/runner/shots.js';

const apply = (game, type, payload = {}) => reduceGame(game, {type, payload}).game;
const shopGame = (coins = 1000) => {
    const game = structuredClone(INITIAL_GAME);
    game.run.phase = 'rewards';
    game.run.money = coins;
    return game;
};

test('post-battle gun purchases cost coins and improve the absolute next-stage weapon stats', () => {
    let game = shopGame();
    assert.deepEqual(game.run.gunUpgrades, {damage: 0, fireRate: 0, bullets: 0});
    const totalCost = gunUpgradeCost('damage', 0) + gunUpgradeCost('damage', 1) +
        gunUpgradeCost('fireRate', 0) + gunUpgradeCost('bullets', 0);
    game = apply(game, 'buy-gun-upgrade', {kind: 'damage'});
    game = apply(game, 'buy-gun-upgrade', {kind: 'damage'});
    game = apply(game, 'buy-gun-upgrade', {kind: 'fireRate'});
    game = apply(game, 'buy-gun-upgrade', {kind: 'bullets'});
    assert.equal(game.run.money, 1000 - totalCost);
    assert.deepEqual(game.run.gunUpgrades, {damage: 2, fireRate: 1, bullets: 1});
    const base = initialRunnerWeaponStats(game.meta.upgrades, game.run.gunUpgrades);
    assert.equal(base.damage, 3);
    assert.ok(Math.abs(base.fireRate / SHOT_INTERVAL_SECONDS - (1 / SHOT_INTERVAL_SECONDS + 0.5)) < 1e-12);
    assert.equal(base.bullets, 2);
    assert.deepEqual(volleyPattern(base.bullets, base.damage).map(shot => shot.damage), [3, 3]);
    game = apply(game, 'next-stage');
    assert.deepEqual(game.run.temporary, base);
    assert.deepEqual(game.run.gunUpgrades, {damage: 2, fireRate: 1, bullets: 1});
    game = apply(game, 'complete-runner', {collected: []});
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'player', survivors: [{id: 'd1', hp: 70}]});
    assert.equal(game.run.phase, 'rewards');
    assert.deepEqual(game.run.gunUpgrades, {damage: 2, fireRate: 1, bullets: 1});
    game = apply(game, 'next-stage');
    assert.deepEqual(game.run.temporary, base);
});

test('gun purchases reject invalid phases, insufficient funds, unknown types and upgrades beyond bullet cap', () => {
    assert.throws(() => apply(structuredClone(INITIAL_GAME), 'buy-gun-upgrade', {kind: 'damage'}), /zwischen Kämpfen/);
    assert.throws(() => apply(shopGame(0), 'buy-gun-upgrade', {kind: 'damage'}), /Nicht genug Geld/);
    assert.throws(() => apply(shopGame(), 'buy-gun-upgrade', {kind: 'pickupRange'}), /Unbekanntes Waffenupgrade/);
    assert.throws(() => gunUpgradeCost('bullets', 4), /Ungültiges Waffenupgrade/);
    let game = shopGame();
    for (let i = 0; i < 4; i++) game = apply(game, 'buy-gun-upgrade', {kind: 'bullets'});
    assert.equal(initialRunnerWeaponStats({}, game.run.gunUpgrades).bullets, 5);
    assert.throws(() => apply(game, 'buy-gun-upgrade', {kind: 'bullets'}), /maximal/);
    assert.ok(Object.keys(GUN_UPGRADES).includes('fireRate'));
    game.run.phase = 'gameover';
    game = apply(game, 'new-run');
    assert.deepEqual(game.run.gunUpgrades, {damage: 0, fireRate: 0, bullets: 0});
});

test('individual healing prices scale with lost HP and heal fully from the army or reserve', () => {
    assert.equal(healingCost(70, 70), 0);
    assert.equal(healingCost(69, 70), 1);
    assert.equal(healingCost(50, 70), 4);
    assert.equal(healingCost(0, 125), 25);
    const game = shopGame(15);
    game.run.army[0].hp = 20;
    game.run.inventory = [{id: 'd2', species: 'pteranodon', level: 1, cell: null, hp: 0}];
    const firstCost = healingCost(game.run.army[0].hp, maxHp(game.run.army[0], game.meta.upgrades));
    const secondCost = healingCost(game.run.inventory[0].hp, maxHp(game.run.inventory[0], game.meta.upgrades));
    assert.equal(firstCost, 10);
    assert.equal(secondCost, 11);
    assert.equal(game.run.money, 15);
    let updated = apply(game, 'heal', {id: 'd1'});
    assert.equal(updated.run.army[0].hp, 70);
    assert.equal(updated.run.money, 5);
    assert.throws(() => apply(updated, 'heal', {id: 'd2'}), /Nicht genug Geld/);
    assert.throws(() => apply(updated, 'heal', {id: 'd1'}), /keine Heilung/);
    assert.throws(() => apply(updated, 'heal', {id: 'missing'}), /nicht gefunden/);
    updated.run.money += secondCost;
    updated = apply(updated, 'heal', {id: 'd2'});
    assert.equal(updated.run.inventory[0].hp, 53);
    assert.equal(updated.run.money, 5);
    assert.equal(game.run.army[0].hp, 20);
});

test('legacy potion stock is refunded and replaced by the new run shop without losing progress', () => {
    const legacy = structuredClone(INITIAL_GAME);
    legacy.version = 2;
    legacy.run.money = 12;
    legacy.run.potions = 2;
    delete legacy.run.gunUpgrades;
    const migrated = migrateGame(legacy);
    assert.equal(migrated.version, 3);
    assert.equal(migrated.run.money, 52);
    assert.equal(migrated.run.gunUpgrades.damage, 0);
    assert.ok(!Object.hasOwn(migrated.run, 'potions'));
    assert.equal(legacy.run.money, 12);
    assert.equal(migrateGame(migrated), migrated);
});
