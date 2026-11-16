import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_GAME, reduceGame, migrateGame} from '../games/dino-rush-battle/core/game.js';
import {simulateBattle, BATTLE_FRAME_SECONDS} from '../games/dino-rush-battle/core/battle.js';
import {ARENA_SKILLS, RUNNER_SKILLS, isSkillVisible, lightningCooldown, lightningDamage} from '../games/dino-rush-battle/core/skills.js';

const fresh = () => structuredClone(INITIAL_GAME);
const apply = (game, type, payload = {}) => reduceGame(game, {type, payload}).game;
const ready = () => apply(fresh(), 'complete-runner', {collected: []});
function maxSkill(game, group, skill) {
    const definition = (group === 'runner' ? RUNNER_SKILLS : ARENA_SKILLS)[skill];
    for (let i = 0; i < definition.maxLevel; i++) game = apply(game, 'buy-skill', {group, skill});
    return game;
}

test('every cleared stage awards stage-number crystals exactly once', () => {
    let game = ready();
    const win = () => game.run.army.map(unit => ({id: unit.id, hp: unit.hp}));
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'player', survivors: win()});
    assert.equal(game.meta.currency, 1);
    assert.equal(game.run.lastResult.crystals, 1);
    assert.throws(() => apply(game, 'resolve-battle', {winner: 'player', survivors: win()}), /Kein Kampf aktiv/);
    game = apply(game, 'next-stage');
    game = apply(game, 'complete-runner', {collected: []});
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'player', survivors: win()});
    assert.equal(game.meta.currency, 3);
    assert.equal(game.run.lastResult.crystals, 2);
    assert.equal(game.meta.highestStage, 2);
});

test('damage, health and speed are three independently purchasable starter DNA upgrades', () => {
    let game = ready();
    game.meta.dna.tank = 1000;
    for (const skill of ['health', 'speed', 'damage']) {
        assert.equal(isSkillVisible(game.meta, 'tank', skill), true);
        game = apply(game, 'buy-skill', {group: 'tank', skill});
        assert.equal(game.meta.skills.tank[skill], 1);
    }
    assert.equal(isSkillVisible(game.meta, 'tank', 'regeneration'), false);
    assert.equal(isSkillVisible(game.meta, 'tank', 'range'), false);
    assert.equal(isSkillVisible(game.meta, 'tank', 'passive'), false);
});

test('later class skills stay sealed until both branches are maximized', () => {
    let game = ready();
    game.meta.dna.sniper = 20000;
    assert.equal(isSkillVisible(game.meta, 'sniper', 'passive'), false);
    game = maxSkill(game, 'sniper', 'health');
    game = maxSkill(game, 'sniper', 'speed');
    game = maxSkill(game, 'sniper', 'regeneration');
    assert.equal(isSkillVisible(game.meta, 'sniper', 'passive'), false);
    game = maxSkill(game, 'sniper', 'range');
    assert.equal(isSkillVisible(game.meta, 'sniper', 'passive'), true);
    game = apply(game, 'buy-skill', {group: 'sniper', skill: 'passive'});
    assert.equal(game.meta.skills.sniper.passive, 1);
});

test('player lightning hits enemies in an area without affecting allies and obeys its cooldown', () => {
    const allies = [{id: 'd1', species: 'raptor', level: 1, hp: 70, cell: 0}];
    const opponents = [
        {id: 'e1', species: 'borealopelta', level: 1, hp: 800, cell: 0},
        {id: 'e2', species: 'borealopelta', level: 1, hp: 800, cell: 1}
    ];
    const skills = {runner: {lightning: 2}};
    const plain = simulateBattle(allies, opponents, {}, {}, skills);
    const cast = {frame: 1, ability: 'lightning'};
    const electrified = simulateBattle(allies, opponents, {}, {}, skills, [cast]);
    const total = frame => frame.filter(unit => unit.team === 'enemy').reduce((sum, unit) => sum + unit.hp, 0);
    assert.ok(total(electrified.frames[1]) < total(plain.frames[1]));
    assert.equal(electrified.frames[1].find(unit => unit.id === 'd1').hp, plain.frames[1].find(unit => unit.id === 'd1').hp);
    assert.ok(electrified.frames[1].effects.some(effect => effect.type === 'lightning'));
    const repeated = simulateBattle(allies, opponents, {}, {}, skills, [cast, {frame: 2, ability: 'lightning'}]);
    assert.deepEqual(repeated.frames[2], electrified.frames[2], 'casts within the cooldown must have no effect');
    assert.ok(lightningCooldown(3) < lightningCooldown(1));
    assert.ok(lightningDamage(3) > lightningDamage(1));
    assert.equal(BATTLE_FRAME_SECONDS, 0.2);
});

test('Dino passives are autonomous effects with cooldowns in all three classes', () => {
    const cases = [
        {kind: 'tank', species: 'triceratops', enemy: 'raptor', expected: 'shield'},
        {kind: 'damageDealer', species: 'raptor', enemy: 'triceratops', expected: 'rage'},
        {kind: 'sniper', species: 'pteranodon', enemy: 'triceratops', expected: 'precision'}
    ];
    for (const {kind, species, enemy, expected} of cases) {
        const player = [{id: 'd1', species, level: 2, hp: 300, cell: 0}];
        const opponent = [{id: 'e1', species: enemy, level: 2, hp: 1800, cell: 0}];
        const result = simulateBattle(player, opponent, {}, {}, {[kind]: {passive: 2}});
        const events = result.frames.flatMap(frame => frame.effects ?? []).filter(effect => effect.type === expected);
        assert.ok(events.length > 0, expected + ' never activated');
        assert.ok(events.length < result.frames.length / 3, expected + ' triggered without a cooldown');
    }
});

test('skill-progress migration preserves existing balances and adds new passive skills', () => {
    const game = fresh();
    game.version = 4;
    game.meta.currency = 34;
    game.meta.dna.sniper = 128;
    delete game.meta.skills.sniper.passive;
    delete game.meta.skills.runner.lightning;
    const upgraded = migrateGame(game);
    assert.equal(upgraded.version, 5);
    assert.equal(upgraded.meta.currency, 34);
    assert.equal(upgraded.meta.dna.sniper, 128);
    assert.equal(upgraded.meta.skills.sniper.passive, 0);
    assert.equal(upgraded.meta.skills.runner.lightning, 0);
});
