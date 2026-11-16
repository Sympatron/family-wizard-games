import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_GAME, SPECIES, maxHp, migrateGame, reduceGame} from '../games/dino-rush-battle/core/game.js';
import {DNA_TYPES, RUNNER_SKILLS, ARENA_SKILLS, dnaValue, getSkillLevel, isSkillVisible, skillCost, getUnlockedRunnerRank} from '../games/dino-rush-battle/core/skills.js';
import {resolveFormationDrop} from '../games/dino-rush-battle/core/drops.js';
import {createRunnerWave, RUNNER_SPECIES, ADVANCED_SPECIES, ELITE_SPECIES, APEX_SPECIES} from '../games/dino-rush-battle/runner/spawns.js';
import {initialRunnerWeaponStats} from '../games/dino-rush-battle/runner/shots.js';

const fresh = () => structuredClone(INITIAL_GAME);
const apply = (game, type, payload = {}) => reduceGame(game, {type, payload}).game;
const ready = () => apply(fresh(), 'complete-runner', {collected: []});
const spendMax = (game, group, skill) => {
    for (let i = 0; i < (group === 'runner' ? RUNNER_SKILLS : ARENA_SKILLS)[skill].maxLevel; i++) game = apply(game, 'buy-skill', {group, skill});
    return game;
};

test('DNA conversion follows all twelve rank and tier values exactly', () => {
    for (let rank = 1; rank <= 4; rank++) {
        const species = Object.keys(SPECIES).find(id => SPECIES[id].rank === rank);
        for (let tier = 1; tier <= 3; tier++) {
            assert.equal(dnaValue({species, level: tier}), 2 ** ((rank - 1) * 3 + tier - 1));
        }
    }
    assert.equal(dnaValue({species: 'tyrannosaurus', level: 3}), 2048);
    assert.throws(() => dnaValue({species: 'raptor', level: 4}));
    assert.equal(DNA_TYPES.tank.label, 'Tank-DNA');
    assert.equal(DNA_TYPES.damageDealer.label, 'Damage-Dealer-DNA');
    assert.equal(DNA_TYPES.sniper.label, 'Sniper-DNA');
});

test('dragging onto the trashcan removes a dinosaur and credits only its own DNA class', () => {
    const game = apply(fresh(), 'complete-runner', {collected: ['triceratops', 'raptor', 'pteranodon']});
    assert.deepEqual(resolveFormationDrop(game.run, 'd2', {trash: true}), {type: 'recycle-dino', payload: {id: 'd2'}});
    let updated = apply(game, 'recycle-dino', {id: 'd2'});
    updated = apply(updated, 'recycle-dino', {id: 'd3'});
    updated = apply(updated, 'recycle-dino', {id: 'd4'});
    assert.deepEqual(updated.meta.dna, {tank: 1, damageDealer: 1, sniper: 1});
    assert.deepEqual(updated.run.army.map(unit => unit.id), ['d1']);
    assert.throws(() => apply(updated, 'recycle-dino', {id: 'd1'}), /letzte Dino/);
    assert.throws(() => apply(updated, 'recycle-dino', {id: 'unknown'}), /nicht gefunden/);
    updated = apply(updated, 'start-battle');
    assert.throws(() => apply(updated, 'recycle-dino', {id: 'd1'}));
    updated = apply(updated, 'resolve-battle', {winner: 'enemy', survivors: []});
    updated = apply(updated, 'new-run');
    assert.deepEqual(updated.meta.dna, {tank: 1, damageDealer: 1, sniper: 1});
});

test('new branches appear only after prerequisites are fully upgraded', () => {
    let game = ready();
    game.meta.currency = 100000;
    assert.equal(isSkillVisible(game.meta, 'runner', 'damage'), true);
    assert.equal(isSkillVisible(game.meta, 'runner', 'spawn1'), false);
    assert.throws(() => apply(game, 'buy-skill', {group: 'runner', skill: 'spawn1'}), /vorherige Skill/);
    game = spendMax(game, 'runner', 'damage');
    assert.equal(isSkillVisible(game.meta, 'runner', 'spawn1'), true);
    assert.equal(isSkillVisible(game.meta, 'runner', 'spawn2'), false);
    game = spendMax(game, 'runner', 'spawn1');
    assert.equal(isSkillVisible(game.meta, 'runner', 'spawn2'), true);
    game = apply(game, 'buy-skill', {group: 'runner', skill: 'spawn2'});
    assert.equal(getUnlockedRunnerRank(game.meta.skills.runner), 2);
    assert.equal(isSkillVisible(game.meta, 'runner', 'spawn3'), false);
    assert.equal(getSkillLevel(game.meta, 'runner', 'spawn2'), 1);
    assert.throws(() => apply(game, 'buy-skill', {group: 'runner', skill: 'damage'}), /maximiert/);
    assert.equal(skillCost('runner', 'spawn2', 1), RUNNER_SKILLS.spawn2.baseCost + RUNNER_SKILLS.spawn2.costStep);
});

test('rank four cannot be bought before level 150, even after unlocking earlier ranks', () => {
    let game = ready();
    game.meta.currency = 100000;
    game.meta.highestStage = 149;
    for (const skill of ['damage', 'spawn1', 'spawn2', 'spawn3']) game = spendMax(game, 'runner', skill);
    assert.equal(isSkillVisible(game.meta, 'runner', 'spawn4'), true);
    assert.throws(() => apply(game, 'buy-skill', {group: 'runner', skill: 'spawn4'}), /Stufe 150/);
    game.meta.highestStage = 150;
    game = apply(game, 'buy-skill', {group: 'runner', skill: 'spawn4'});
    assert.equal(getUnlockedRunnerRank(game.meta.skills.runner), 4);
    assert.throws(() => apply(game, 'recycle-dino', {id: 'd1'}));
});

test('the runner rejects collecting dinosaur ranks not unlocked by the skill tree', () => {
    const game = fresh();
    assert.throws(() => apply(game, 'complete-runner', {collected: [{species: 'allosaurus', level: 1}]}), /Ungültige Dinosaurier/);
    const unlocked = fresh();
    unlocked.meta.skills.runner.spawn2 = 1;
    const next = apply(unlocked, 'complete-runner', {collected: [{species: 'allosaurus', level: 1}]});
    assert.ok(next.run.army.some(unit => unit.species === 'allosaurus'));
    assert.throws(() => apply(unlocked, 'complete-runner', {collected: [{species: 'tyrannosaurus', level: 1}]}));
});

test('rank-based spawns preserve mastery tier behavior and follow unlocked rank branches', () => {
    assert.ok(RUNNER_SPECIES.includes(createRunnerWave(0, 160, () => 0)[0].species));
    assert.ok(ADVANCED_SPECIES.includes(createRunnerWave(0, 160, () => 0, [], {spawn2: 1})[0].species));
    assert.ok(ELITE_SPECIES.includes(createRunnerWave(0, 160, () => 0, [], {spawn3: 1})[0].species));
    assert.ok(APEX_SPECIES.includes(createRunnerWave(0, 160, () => 0, [], {spawn4: 1})[0].species));
    assert.equal(createRunnerWave(0, 160, () => 0, [], {spawn4: 1})[0].level, 3);
});

test('class skills and runner skills affect stats while DNA and skill progress persist', () => {
    let game = ready();
    game.meta.dna.tank = 1000;
    assert.throws(() => apply(game, 'buy-skill', {group: 'tank', skill: 'regeneration'}), /vorherige Skill/);
    const startingHp = maxHp({species: 'triceratops', level: 1}, game.meta.upgrades, game.meta.skills);
    game = spendMax(game, 'tank', 'damage');
    game = apply(game, 'buy-skill', {group: 'tank', skill: 'health'});
    assert.ok(maxHp({species: 'triceratops', level: 1}, game.meta.upgrades, game.meta.skills) > startingHp);
    assert.throws(() => apply(game, 'buy-skill', {group: 'sniper', skill: 'damage'}), /Nicht genug Sniper-DNA/);
    game.meta.currency = 1000;
    game = spendMax(game, 'runner', 'damage');
    game = apply(game, 'buy-skill', {group: 'runner', skill: 'magnet'});
    game = apply(game, 'buy-skill', {group: 'runner', skill: 'fireRate'});
    const weapon = initialRunnerWeaponStats(game.meta.upgrades, game.run.gunUpgrades, game.meta.skills.runner);
    assert.equal(weapon.pickupRange, 2.3);
    assert.ok(weapon.fireRate > 1);
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'enemy', survivors: []});
    game = apply(game, 'new-run');
    assert.equal(game.meta.skills.tank.health, 1);
    assert.equal(game.meta.skills.runner.magnet, 1);
});

test('regeneration DNA adds percentage points to post-battle recovery for its class', () => {
    let game = ready();
    game.meta.dna.damageDealer = 10000;
    game = spendMax(game, 'damageDealer', 'damage');
    game = spendMax(game, 'damageDealer', 'health');
    game = apply(game, 'buy-skill', {group: 'damageDealer', skill: 'regeneration'});
    const unit = game.run.army[0];
    const maximum = maxHp(unit, game.meta.upgrades, game.meta.skills);
    game = apply(game, 'start-battle');
    game = apply(game, 'resolve-battle', {winner: 'player', survivors: [{id: unit.id, hp: 10}]});
    assert.equal(game.run.army[0].hp, 10 + Math.round(maximum * 0.30));
    assert.equal(game.meta.skills.damageDealer.regeneration, 1);
});

test('saved games from version three receive DNA and skill defaults without resetting progress', () => {
    const old = fresh();
    old.version = 3;
    old.meta.currency = 123;
    delete old.meta.skills;
    delete old.meta.dna;
    delete old.meta.highestStage;
    old.run.stage = 17;
    const game = migrateGame(old);
    assert.equal(game.version, 4);
    assert.equal(game.meta.currency, 123);
    assert.equal(game.meta.highestStage, 17);
    assert.deepEqual(game.meta.dna, {tank: 0, damageDealer: 0, sniper: 0});
    assert.equal(game.meta.skills.runner.spawn4, 0);
    assert.equal(migrateGame(game), game);
});
