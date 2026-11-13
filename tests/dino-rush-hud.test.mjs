import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunnerHud} from '../games/dino-rush-battle/runner/hud.js';

const createElement = tagName => ({
    tagName, children: [], attributes: {},
    setAttribute(name, value) {this.attributes[name] = String(value);},
    append(...nodes) {this.children.push(...nodes);}
});
const document = {createElement, createElementNS(_namespace, name) {return createElement(name);}};
const progress = {seconds: 29, hp: 3, collected: 4, coins: 35, temporary: {damage: 1.6, fireRate: 1.2, bullets: 3, pickupRange: 2.6}};

test('runner HUD shows eight labeled icons with numerical values rather than text captions', () => {
    const hud = createRunnerHud(document);
    hud.update(progress);
    assert.equal(hud.root.children.length, 8);
    assert.equal(hud.counter.id, 'runner-coin-counter');
    for (const item of hud.root.children) {
        const [icon, value] = item.children;
        assert.equal(icon.attributes['aria-hidden'], 'true');
        if (icon.tagName === 'img') {
            assert.equal(item.title, 'Dinos');
            assert.equal(icon.src, './assets/dinos/raptor.svg');
            assert.equal(icon.alt, '');
        } else {
            assert.equal(icon.tagName, 'svg');
            assert.equal(icon.attributes.viewBox, '0 0 24 24');
            assert.ok(icon.children.length > 0);
        }
        assert.ok(value.textContent.length > 0);
        assert.ok(item.attributes['aria-label'].includes(value.textContent));
    }
    assert.deepEqual(hud.root.children.map(item => item.children[1].textContent), ['29s', '3', '4', '1.6', '4.3/s', '3', '2.6', '35']);
    assert.equal(hud.root.children[1].attributes['aria-label'], 'Leben: 3');
    assert.equal(hud.counter.attributes['aria-label'], 'Münzen: 35');
    assert.equal(hud.counter.children[1].textContent, '35');
});
test('coin count updates while maintaining the same counter element for animation targeting', () => {
    const hud = createRunnerHud(document);
    const coin = hud.counter;
    hud.update({...progress, coins: 0});
    hud.update({...progress, coins: 10});
    assert.equal(hud.counter, coin);
    assert.equal(coin.children[1].textContent, '10');
});

test('runner shows absolute volley damage and actual attack rate, not multipliers', () => {
    const hud = createRunnerHud(document);
    hud.update({...progress, temporary: {...progress.temporary, damage: 2, fireRate: 2}});
    assert.equal(hud.root.children[3].children[1].textContent, '2.0');
    assert.equal(hud.root.children[4].children[1].textContent, '7.1/s');
    assert.equal(hud.root.children[3].attributes['aria-label'], 'Schaden pro Kugel: 2.0');
    assert.equal(hud.root.children[4].attributes['aria-label'], 'Schussserien pro Sekunde: 7.1/s');
});

test('HUD reports current absolute attack speed after additive and multiplicative upgrades', async () => {
    const {applyGate} = await import('../games/dino-rush-battle/runner/gates.js');
    const {SHOT_INTERVAL_SECONDS} = await import('../games/dino-rush-battle/runner/shots.js');
    let temporary = {...progress.temporary, fireRate: 2.2 * SHOT_INTERVAL_SECONDS};
    const hud = createRunnerHud(document);
    hud.update({...progress, temporary});
    assert.equal(hud.root.children[4].children[1].textContent, '2.2/s');
    temporary = applyGate(temporary, {modifier: 'fireRate', operation: 'multiply', level: 4});
    hud.update({...progress, temporary});
    assert.equal(hud.root.children[4].children[1].textContent, '4.4/s');
    temporary = applyGate(temporary, {modifier: 'fireRate', operation: 'add', level: 4});
    hud.update({...progress, temporary});
    assert.equal(hud.root.children[4].children[1].textContent, '8.4/s');
});
