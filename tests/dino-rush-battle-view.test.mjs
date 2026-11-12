import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {Phaser: {}};
const {BattleView} = await import('../games/dino-rush-battle/battle/view.js');

function createElement() {
    const element = {};
    for (const name of ['setDepth', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'setOrigin', 'setInteractive', 'setVisible', 'setText', 'clear']) {
        element[name] = () => element;
    }
    element.on = () => element;
    return element;
}

test('reserve dinosaurs use the same species units and paginate on small and large screens', () => {
    for (const portrait of [true, false]) {
        const view = Object.create(BattleView.prototype);
        view.portrait = portrait;
        view.reservePage = 0;
        view.upgrades = {};
        view.inventory = Array.from({length: 30}, (_, i) => ({id: 'd' + i, species: 'raptor', level: 1, hp: 70}));
        view.render = () => {};
        const pageSize = portrait ? 7 : 13;
        const first = view.reserveUnits();
        assert.equal(first.length, pageSize);
        assert.ok(first.every(unit => unit.team === 'reserve' && unit.species === 'raptor' && unit.hp === 70));
        assert.ok(first.every(unit => unit.y > view.cellCenter('player', 14).y));
        view.changeReservePage(1);
        assert.equal(view.reservePage, 1);
        assert.equal(view.reserveUnits()[0].id, 'd' + pageSize);
        view.changeReservePage(100);
        assert.equal(view.reservePage, Math.ceil(30 / pageSize) - 1);
        view.changeReservePage(-100);
        assert.equal(view.reservePage, 0);
    }
});

test('Phaser mouse dragging uses pointer-down offset and drops on pointer cell', () => {
    const handlers = new Map();
    const scene = {
        add: {graphics: createElement, rectangle: createElement, text: createElement},
        input: {on(name, callback) {handlers.set(name, callback);}}
    };
    const drops = [];
    const view = Object.create(BattleView.prototype);
    Object.assign(view, {
        destroyed: false, portrait: false, mode: 'formation', reservePage: 0, army: [{id: 'd1', cell: 0}],
        inventory: [], selected: null, units: new Map(), upgrades: {}, onCell() {}, onSelect() {},
        onDrop(id, cell) {drops.push({id, cell});}
    });
    view.render = () => {};
    view.initialize(scene);
    const from = view.cellCenter('player', 0);
    const to = view.cellCenter('player', 6);
    const data = new Map([['unitId', 'd1']]);
    const object = {
        x: from.x, y: from.y, getData: key => data.get(key), setData(key, value) {data.set(key, value);},
        setDepth() {return this;}, setPosition(x, y) {this.x = x; this.y = y; return this;}
    };
    const mouseDown = {x: from.x + 12, y: from.y - 8};
    const mouseDrop = {x: to.x + 12, y: to.y - 8};
    handlers.get('gameobjectdown')(mouseDown, object);
    handlers.get('dragstart')(mouseDown, object);
    handlers.get('drag')(mouseDrop, object);
    assert.equal(object.x, to.x);
    assert.equal(object.y, to.y);
    handlers.get('dragend')(mouseDrop, object);
    assert.deepEqual(drops, [{id: 'd1', cell: 6}]);
    assert.equal(object.x, from.x);
    assert.equal(object.y, from.y);
});
