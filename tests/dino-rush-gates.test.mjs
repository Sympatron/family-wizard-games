import test from 'node:test';
import assert from 'node:assert/strict';
import {createGatePair, applyGate, gateLabel, improveGate} from '../games/dino-rush-battle/runner/gates.js';

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
    assert.equal(add.damage, 2);
    const multiply = applyGate(add, {modifier: 'damage', operation: 'multiply', level: 4});
    assert.equal(multiply.damage, 4);
    assert.equal(base.damage, 1);
    assert.equal(applyGate(base, {modifier: 'bullets', operation: 'add', level: 3}).bullets, 4);
    assert.equal(applyGate({damage: 1, fireRate: 1, bullets: 4}, {modifier: 'bullets', operation: 'multiply', level: 2}).bullets, 6);
    assert.equal(applyGate(base, {modifier: 'fireRate', operation: 'multiply', level: -2}).fireRate, 0.5);
    assert.equal(applyGate(base, {modifier: 'damage', operation: 'multiply', level: -2}).damage, 0.5);
    assert.throws(() => applyGate(base, {modifier: 'unknown', operation: 'add', level: 2}));
});
