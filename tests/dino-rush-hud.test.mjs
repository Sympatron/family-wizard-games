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
        assert.equal(icon.tagName, 'svg');
        assert.equal(icon.attributes['aria-hidden'], 'true');
        assert.equal(icon.attributes.viewBox, '0 0 24 24');
        assert.ok(icon.children.length > 0);
        assert.ok(value.textContent.length > 0);
        assert.ok(item.attributes['aria-label'].includes(value.textContent));
    }
    assert.deepEqual(hud.root.children.map(item => item.children[1].textContent), ['29s', '3', '4', '×1.6', '×1.2', '3', '2.6', '35']);
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
