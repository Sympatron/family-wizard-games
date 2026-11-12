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

test('combat displays an upward fading damage number', () => {
    const labels = [];
    const tweens = [];
    const view = Object.create(BattleView.prototype);
    view.portrait = false;
    view.hitSound = {hit() {}};
    const mock = {
        setDepth() {return this;}, setOrigin() {return this;}, destroy() {this.destroyed = true;}
    };
    view.scene = {
        add: {
            circle() {return Object.assign({}, mock);},
            text(x, y, value) {
                const label = Object.assign({x, y, value}, mock);
                labels.push(label);
                return label;
            }
        },
        tweens: {add(config) {tweens.push(config);}}
    };
    view.emitHitSparks({x: 480, y: 198}, 17);
    assert.equal(labels.length, 1);
    assert.equal(labels[0].value, '−17');
    const textTween = tweens.at(-1);
    assert.ok(textTween.y < labels[0].y);
    assert.equal(textTween.alpha, 0);
    textTween.onComplete();
    assert.ok(labels[0].destroyed);
});

test('ranged projectile moves to target before destroying its sprite', () => {
    const sprites = [];
    const tweens = [];
    const view = Object.create(BattleView.prototype);
    view.portrait = false;
    view.scene = {
        add: {circle(x, y) {
            const sprite = {x, y, setDepth() {return this;}, destroy() {this.destroyed = true;}};
            sprites.push(sprite);
            return sprite;
        }},
        tweens: {add(config) {tweens.push(config);}}
    };
    view.emitRangedProjectile({team: 'player', x: 300, y: 140, tx: 650, ty: 140});
    assert.equal(sprites.length, 1);
    assert.equal(tweens.length, 1);
    assert.notEqual(tweens[0].x, sprites[0].x);
    assert.equal(tweens[0].duration, 175);
    tweens[0].onComplete();
    assert.ok(sprites[0].destroyed);
});
