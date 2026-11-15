import test from 'node:test';
import assert from 'node:assert/strict';
import {COIN_ATTRACT_SECONDS, COIN_COUNTER_SECONDS, interpolateCoinFlight} from '../games/dino-rush-battle/runner/coin-flight.js';

test('coins travel smoothly from collection point to player before flying to HUD', () => {
    assert.ok(COIN_ATTRACT_SECONDS > 0 && COIN_COUNTER_SECONDS > 0);
    const collected = {x: -4.4, y: 1.55, z: 8};
    const player = {x: 2, y: 1.8, z: 8};
    const counter = {x: 250, y: 28};
    const atPlayer = interpolateCoinFlight(collected, player, COIN_ATTRACT_SECONDS, COIN_ATTRACT_SECONDS);
    assert.deepEqual(atPlayer, player);
    const towardPlayer = interpolateCoinFlight(collected, player, COIN_ATTRACT_SECONDS / 2, COIN_ATTRACT_SECONDS);
    assert.ok(towardPlayer.x > collected.x && towardPlayer.x < player.x);
    const atCounter = interpolateCoinFlight({x: 160, y: 340}, counter, COIN_COUNTER_SECONDS, COIN_COUNTER_SECONDS);
    assert.deepEqual(atCounter, {...counter, z: 0});
    const towardCounter = interpolateCoinFlight({x: 160, y: 340}, counter, COIN_COUNTER_SECONDS / 2, COIN_COUNTER_SECONDS);
    assert.ok(towardCounter.y > counter.y && towardCounter.y < 340);
});
test('coin flight endpoints are clamped and invalid elapsed time is rejected', () => {
    const from = {x: 0, y: 20, z: -8}, to = {x: 9, y: 4, z: 8};
    assert.deepEqual(interpolateCoinFlight(from, to, -2, 1), from);
    assert.deepEqual(interpolateCoinFlight(from, to, 2, 1), to);
    assert.throws(() => interpolateCoinFlight(from, to, 1, 0), /Münzanimation/);
    assert.throws(() => interpolateCoinFlight(from, to, NaN, 1), /Münzanimation/);
});
