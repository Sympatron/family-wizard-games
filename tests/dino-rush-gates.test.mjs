import test from 'node:test';
import assert from 'node:assert/strict';
import {createGatePair, applyGate, gateLabel, improveGate, selectCrossedGate, createSingleGate, GATE_LANES, MAX_RUNNER_DAMAGE, GATE_PROPERTIES} from '../games/dino-rush-battle/runner/gates.js';
import {volleyPattern} from '../games/dino-rush-battle/runner/shots.js';

test('paired gates use different properties and offer both modifier types', () => {
    for (let stage = 1; stage <= 8; stage++) {
        for (let index = 0; index < 10; index++) {
            const pair = createGatePair(stage, index);
            assert.notEqual(pair[0].modifier, pair[1].modifier);
            assert.deepEqual(new Set(pair.map(gate => gate.operation)), new Set(['add', 'multiply']));
            assert.ok(pair.some(gate => gate.level < 0));
            assert.ok(pair.some(gate => gate.level > 0));
        }
    }
});
test('negative gates become positive after repeated shooting', () => {
    let gate = createGatePair(1, 0)[0];
    assert.equal(gate.level, -2);
    for (let i = 0; i < 4; i++) gate = improveGate(gate);
    assert.equal(gate.level, 2);
    assert.match(gateLabel(gate), /\+2/);
});
test('additive and multiplicative modifiers accumulate independently', () => {
    const base = {damage: 1, fireRate: 1, bullets: 1};
    const add = applyGate(base, {modifier: 'damage', operation: 'add', level: 2});
    assert.equal(add.damage, 3);
    const multiply = applyGate(add, {modifier: 'damage', operation: 'multiply', level: 4});
    assert.equal(multiply.damage, 6);
    assert.equal(base.damage, 1);
    assert.equal(applyGate(base, {modifier: 'bullets', operation: 'add', level: 3}).bullets, 4);
    assert.equal(applyGate({damage: 1, fireRate: 1, bullets: 4}, {modifier: 'bullets', operation: 'multiply', level: 2}).bullets, 5);
    assert.equal(applyGate(base, {modifier: 'fireRate', operation: 'multiply', level: -2}).fireRate, 0.5);
    assert.equal(applyGate(base, {modifier: 'damage', operation: 'multiply', level: -2}).damage, 0.5);
    assert.throws(() => applyGate(base, {modifier: 'unknown', operation: 'add', level: 2}));
});

test('passing either side or the center of a gate pair reliably selects exactly one gate', () => {
    const gates = [{x: -3.2, modifier: 'damage', operation: 'add', level: 2}, {x: 3.2, modifier: 'fireRate', operation: 'multiply', level: 2}];
    for (const playerX of [-5.15, -3.2, -0.05, 0, 0.05, 3.2, 5.15]) {
        const selected = selectCrossedGate(gates, playerX, 7.7, 8.25, 8);
        assert.equal(selected, playerX <= 0 ? gates[0] : gates[1]);
        const bonus = applyGate({damage: 1, fireRate: 1, bullets: 1}, selected);
        assert.ok(bonus.damage !== 1 || bonus.fireRate !== 1);
    }
    assert.equal(selectCrossedGate(gates, 0, 6, 7, 8), null);
    assert.equal(selectCrossedGate(gates, 0, 9, 10, 8), null);
});

test('magnet gates appear in rotation and increase pickup range within safe bounds', () => {
    const base = {damage: 1, fireRate: 1, bullets: 1, pickupRange: 1.8};
    assert.ok(GATE_PROPERTIES.includes('pickupRange'));
    assert.ok(Array.from({length: 8}, (_, index) => createGatePair(1, index)).flat().some(gate => gate.modifier === 'pickupRange'));
    assert.equal(gateLabel({modifier: 'pickupRange', operation: 'add', level: 2}), 'MAGNET +2');
    assert.equal(applyGate(base, {modifier: 'pickupRange', operation: 'add', level: 2}).pickupRange, 2.6);
    assert.equal(applyGate(base, {modifier: 'pickupRange', operation: 'multiply', level: 4}).pickupRange, 3.6);
    assert.equal(applyGate({...base, pickupRange: 4.4}, {modifier: 'pickupRange', operation: 'add', level: 4}).pickupRange, 4.5);
    assert.equal(applyGate(base, {modifier: 'pickupRange', operation: 'add', level: -2}).pickupRange, 1);
    assert.equal(base.pickupRange, 1.8);
});

test('single gates spawn in one lane, remain inert until shot, and activate on their first hit', () => {
    for (let stage = 1; stage <= 8; stage++) {
        for (let index = 1; index < 8; index += 2) {
            const gate = createSingleGate(stage, index);
            assert.ok(GATE_LANES.includes(gate.x));
            assert.equal(gate.level, 0);
            assert.equal(gate.single, true);
            assert.match(gateLabel(gate), /SCHIESS!/);
            assert.equal(selectCrossedGate([gate], gate.x, 7.8, 8.2, 8), null);
            const active = improveGate(gate);
            assert.equal(active.level, 1);
            assert.equal(selectCrossedGate([active], gate.x, 7.8, 8.2, 8), active);
            assert.equal(selectCrossedGate([active], gate.x + gate.width, 7.8, 8.2, 8), null);
        }
    }
});
test('damage upgrades are exact additive and multiplicative values, including after multiple bullets', () => {
    const base = {damage: 1, fireRate: 1, bullets: 4};
    const added = applyGate(base, {modifier: 'damage', operation: 'add', level: 4});
    assert.equal(added.damage, 5);
    const doubled = applyGate(added, {modifier: 'damage', operation: 'multiply', level: 4});
    assert.equal(doubled.damage, 10);
    assert.equal(applyGate({...base, damage: 2}, {modifier: 'damage', operation: 'multiply', level: 4}).damage, 4);
    assert.equal(applyGate({...base, damage: 250}, {modifier: 'damage', operation: 'multiply', level: 4}).damage, MAX_RUNNER_DAMAGE);
    assert.equal(base.damage, 1);
});

test('gate labels match actual damage delivered by every individual bullet', () => {
    let stats = {damage: 2, bullets: 3, fireRate: 1, pickupRange: 1.8};
    const additive = {modifier: 'damage', operation: 'add', level: 4};
    assert.equal(gateLabel(additive), 'SCHADEN +4');
    stats = applyGate(stats, additive);
    assert.equal(stats.damage, 6);
    assert.deepEqual(volleyPattern(stats.bullets, stats.damage).map(shot => shot.damage), [6, 6, 6]);
    const multiplier = {modifier: 'damage', operation: 'multiply', level: 4};
    assert.equal(gateLabel(multiplier), 'SCHADEN ×2');
    stats = applyGate(stats, multiplier);
    assert.equal(stats.damage, 12);
    const bullets = volleyPattern(stats.bullets, stats.damage);
    assert.deepEqual(bullets.map(shot => shot.damage), [12, 12, 12]);
    let cageHp = 36;
    for (const bullet of bullets) cageHp -= bullet.damage;
    assert.equal(cageHp, 0);
    assert.equal(stats.bullets, 3);
});
