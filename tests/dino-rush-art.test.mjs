import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SPECIES} from '../games/dino-rush-battle/core/game.js';
import {drawBattlefield} from '../games/dino-rush-battle/battle/terrain.js';

globalThis.window = {Phaser: {}};
const {BattleView} = await import('../games/dino-rush-battle/battle/view.js');

test('every combat dinosaur has unique illustrated SVG artwork', async () => {
    const illustrations = [];
    for (const species of Object.keys(SPECIES)) {
        const file = new URL('../games/dino-rush-battle/assets/dinos/' + species + '.svg', import.meta.url);
        const svg = await readFile(file, 'utf8');
        assert.match(svg, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        assert.match(svg, /viewBox="0 0 160 128"/);
        assert.match(svg, /<path /);
        assert.match(svg, /<\/svg>\s*$/);
        illustrations.push(svg);
    }
    assert.equal(new Set(illustrations).size, Object.keys(SPECIES).length);
});

test('Phaser preloads matching dinosaur SVG textures', () => {
    const loaded = [];
    const view = Object.create(BattleView.prototype);
    view.preload({load: {svg: (key, url, config) => loaded.push({key, url, config})}});
    assert.equal(loaded.length, Object.keys(SPECIES).length);
    for (const species of Object.keys(SPECIES)) {
        assert.deepEqual(loaded.find(item => item.key === 'dino-' + species), {
            key: 'dino-' + species, url: './assets/dinos/' + species + '.svg', config: {width: 160, height: 128}
        });
    }
});

test('battlefield is a deterministic textured top-down ground texture, not a horizon illustration', () => {
    function makeContext() {
        const context = {
            image: null,
            createImageData(width, height) {return {data: new Uint8ClampedArray(width * height * 4)};},
            putImageData(image) {this.image = image;},
            save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, ellipse() {}, fill() {},
            moveTo() {}, lineTo() {}, closePath() {}, arc() {}, stroke() {}, quadraticCurveTo() {}
        };
        return context;
    }
    const first = makeContext(), second = makeContext();
    drawBattlefield(first, 96, 64);
    drawBattlefield(second, 96, 64);
    assert.deepEqual(first.image.data, second.image.data);
    const pixels = first.image.data;
    assert.equal(pixels.length, 96 * 64 * 4);
    assert.ok(Array.from({length: 96 * 64}, (_, i) => pixels[i * 4 + 3]).every(alpha => alpha === 255));
    const colors = new Set(Array.from({length: 96 * 64}, (_, i) => [pixels[4 * i], pixels[4 * i + 1], pixels[4 * i + 2]].join(',')));
    assert.ok(colors.size > 1000, 'natural terrain should have rich variation rather than flat vector fills');
});
