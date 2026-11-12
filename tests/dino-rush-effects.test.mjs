import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {Phaser: {}};
const {BattleView} = await import('../games/dino-rush-battle/battle/view.js');

test('combat hit feedback emits seven particles and one hit tone', () => {
    const sparks = [];
    const tweens = [];
    const sound = [];
    const view = Object.create(BattleView.prototype);
    view.portrait = false;
    view.hitSound = {hit: kind => sound.push(kind)};
    view.scene = {
        add: {circle(x, y, radius, color) {
            const spark = {x, y, radius, color, setDepth() {return this;}, destroy() {this.destroyed = true;}};
            sparks.push(spark);
            return spark;
        }},
        tweens: {add(config) {tweens.push(config);}}
    };
    view.emitHitSparks({x: 380, y: 82});
    assert.equal(sparks.length, 7);
    assert.equal(tweens.length, 7);
    assert.deepEqual(sound, ['impact']);
    for (const tween of tweens) {
        assert.equal(tween.duration, 250);
        tween.onComplete();
        assert.equal(tween.targets.destroyed, true);
    }
});
