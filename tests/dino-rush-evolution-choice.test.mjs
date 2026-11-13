import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIES, maxHp, unitPower} from '../games/dino-rush-battle/core/game.js';
import {createEvolutionChoiceButton} from '../games/dino-rush-battle/battle/evolution-choice.js';

const document = {
    createElement(tagName) {
        return {
            tagName, children: [],
            style: {properties: {}, setProperty(name, value) {this.properties[name] = value;}},
            append(...elements) {this.children.push(...elements);}
        };
    }
};

test('evolution choices show species illustration, class and effective combat stats', () => {
    for (const species of ['allosaurus', 'troodon', 'ankylosaurus', 'utahraptor']) {
        const definition = SPECIES[species];
        const card = createEvolutionChoiceButton(document, species, 1, {starterHp: 2}, {damage: 1});
        assert.equal(card.tagName, 'button');
        assert.equal(card.type, 'button');
        assert.equal(card.className, 'dino-merge-choice');
        assert.equal(card.style.properties['--dino-color'], '#' + definition.color.toString(16).padStart(6, '0'));
        const [image, details] = card.children;
        assert.equal(image.tagName, 'img');
        assert.equal(image.src, './assets/dinos/' + species + '.svg');
        assert.equal(image.alt, definition.name);
        const [name, role, stats] = details.children;
        assert.equal(name.textContent, definition.name);
        assert.match(role.textContent, new RegExp('Rang ' + definition.rank + ' · Tier 1 · Klasse: ' + definition.role));
        assert.equal(stats.textContent, 'Leben ' + maxHp({species, level: 1}, {starterHp: 2}) + ' · Schaden ' +
            Math.round(definition.damage * unitPower({species, level: 1}) * 1.15));
    }
});

test('tier preview advances when merging a species into its next mastery tier', () => {
    const card = createEvolutionChoiceButton(document, 'raptor', 2);
    assert.match(card.children[1].children[1].textContent, /Tier 2/);
    assert.match(card.children[1].children[2].textContent, /Leben 126/);
});
