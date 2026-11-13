import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SPECIES} from '../games/dino-rush-battle/core/game.js';

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
    const backgrounds = [];
    view.preload({load: {svg: (key, url, config) => loaded.push({key, url, config}), image: (key, url) => backgrounds.push({key, url})}});
    assert.deepEqual(backgrounds, [{key: 'dino-battlefield', url: './assets/battlefield.avif'}]);
    assert.equal(loaded.length, Object.keys(SPECIES).length);
    for (const species of Object.keys(SPECIES)) {
        assert.deepEqual(loaded.find(item => item.key === 'dino-' + species), {
            key: 'dino-' + species, url: './assets/dinos/' + species + '.svg', config: {width: 160, height: 128}
        });
    }
});

test('battlefield background is a committed raster AVIF image', async () => {
    const image = await readFile(new URL('../games/dino-rush-battle/assets/battlefield.avif', import.meta.url));
    assert.ok(image.length > 5000);
    assert.equal(image.toString('ascii', 4, 12), 'ftypavif');
});
