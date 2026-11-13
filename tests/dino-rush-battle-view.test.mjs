import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {Phaser: {}};
const {BattleView, MASTERY_APPEARANCE} = await import('../games/dino-rush-battle/battle/view.js');

const makeElement = () => {
    const object = {x: 0, y: 0, depth: 1};
    for (const method of ['setDepth', 'setDisplaySize', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'setOrigin', 'setVisible', 'setText', 'clear']) {
        object[method] = () => object;
    }
    object.setPosition = (x, y) => { object.x = x; object.y = y; return object; };
    return object;
};
const createView = (portrait = false, {army = [], inventory = []} = {}) => {
    const listeners = new Map();
    const captures = new Set();
    const rect = {left: 50, top: 75, width: portrait ? 270 : 480, height: 310};
    rect.right = rect.left + rect.width;
    rect.bottom = rect.top + rect.height;
    const canvas = {
        addEventListener(type, handler) {listeners.set(type, handler);},
        removeEventListener(type) {listeners.delete(type);},
        getBoundingClientRect() {return rect;},
        setPointerCapture(id) {captures.add(id);},
        hasPointerCapture(id) {return captures.has(id);},
        releasePointerCapture(id) {captures.delete(id);}
    };
    const scene = {
        game: {canvas},
        add: {graphics: makeElement, rectangle: makeElement, text: makeElement, image: makeElement}
    };
    const events = [];
    const view = Object.create(BattleView.prototype);
    Object.assign(view, {
        portrait, destroyed: false, mode: 'formation', reservePage: 0, army, inventory, enemies: [],
        selected: null, units: new Map(), upgrades: {}, drag: null,
        onCell(cell) {events.push({type: 'cell', cell});},
        onSelect(id) {events.push({type: 'select', id});},
        onDrop(id, target) {events.push({type: 'drop', id, target});}
    });
    view.render = () => {};
    view.initialize(scene);
    const send = (type, point, pointerId = 7, pointerType = 'mouse') => {
        const p = {pointerId, pointerType, button: 0, clientX: rect.left + point.x * rect.width / view.width,
            clientY: rect.top + point.y * rect.height / 620, preventDefault() {}};
        listeners.get(type)(p);
    };
    return {view, events, send, listeners};
};
const unit = (id, species, cell) => ({id, species, cell, hp: 70, level: 1});

test('spare dinosaurs use the same render units with paging and large navigation targets', () => {
    for (const portrait of [true, false]) {
        const view = createView(portrait, {inventory: Array.from({length: 30}, (_, index) => unit('d' + index, 'raptor', null))}).view;
        const pageSize = 9;
        assert.equal(view.reserveUnits().length, pageSize);
        assert.ok(view.reserveUnits().every(dino => dino.team === 'reserve' && dino.hp === 70));
        const firstId = view.reserveUnits()[0].id;
        const x = view.width - 54;
        view.handlePointerDown({pointerId: 1, pointerType: 'touch', clientX: 50 + x * (portrait ? 270 : 480) / view.width,
            clientY: 75 + 569 * 310 / 620, preventDefault() {}});
        assert.equal(view.reservePage, 1);
        assert.notEqual(view.reserveUnits()[0].id, firstId);
        view.changeReservePage(100);
        assert.equal(view.reservePage, Math.ceil(30 / pageSize) - 1);
        view.changeReservePage(-100);
        assert.equal(view.reservePage, 0);
    }
});

test('mouse dragging follows initial pointer offset and merges on actual release cell', () => {
    const dino = unit('d1', 'raptor', 0);
    const {view, events, send} = createView(false, {army: [dino, unit('d2', 'raptor', 6)]});
    const from = view.cellCenter('player', 0), to = view.cellCenter('player', 6);
    const container = makeElement().setPosition(from.x, from.y);
    view.units.set('player:d1', {container, targetX: from.x, targetY: from.y});
    send('pointerdown', {x: from.x + 12, y: from.y - 8});
    send('pointermove', {x: to.x + 12, y: to.y - 8});
    assert.ok(Math.abs(container.x - to.x) < 0.001);
    assert.ok(Math.abs(container.y - to.y) < 0.001);
    send('pointerup', {x: to.x + 12, y: to.y - 8});
    assert.deepEqual(events, [{type: 'drop', id: 'd1', target: {unitId: 'd2', cell: 6}}]);
    assert.equal(container.x, from.x);
    assert.equal(container.y, from.y);
});

test('touch dropping a spare onto another spare reports the merge target', () => {
    const {view, events, send} = createView(true, {inventory: [unit('d3', 'raptor', null), unit('d4', 'raptor', null)]});
    const [first, second] = view.reserveUnits();
    view.units.set('reserve:d3', {container: makeElement().setPosition(first.x, first.y), targetX: first.x, targetY: first.y});
    send('pointerdown', first, 9, 'touch');
    send('pointermove', second, 9, 'touch');
    send('pointerup', second, 9, 'touch');
    assert.deepEqual(events, [{type: 'drop', id: 'd3', target: {unitId: 'd4', reserve: true}}]);
});

test('dropping a deployed dinosaur into empty reserve space works with mouse and touch', () => {
    for (const pointerType of ['mouse', 'touch']) {
        const dino = unit('d1', 'raptor', 0);
        const {view, events, send} = createView(false, {army: [dino]});
        const from = view.cellCenter('player', 0);
        send('pointerdown', from, 12, pointerType);
        send('pointermove', {x: 900, y: 360}, 12, pointerType);
        send('pointerup', {x: 900, y: 360}, 12, pointerType);
        assert.deepEqual(events, [{type: 'drop', id: 'd1', target: {reserve: true}}]);
    }
});

test('mouse clicks and short touch taps can inspect units but never move or merge them', () => {
    for (const pointerType of ['mouse', 'touch']) {
        const {view, events, send} = createView(false, {army: [unit('d1', 'raptor', 0), unit('d2', 'raptor', 3)]});
        send('pointerdown', view.cellCenter('player', 0), 7, pointerType);
        send('pointerup', view.cellCenter('player', 0), 7, pointerType);
        send('pointerdown', view.cellCenter('player', 3), 7, pointerType);
        send('pointerup', view.cellCenter('player', 3), 7, pointerType);
        send('pointerdown', view.cellCenter('player', 6), 7, pointerType);
        send('pointerup', view.cellCenter('player', 6), 7, pointerType);
        assert.deepEqual(events, [{type: 'select', id: 'd1'}, {type: 'select', id: 'd2'}]);
    }
});

test('mastery tiers have distinct sizes, fill colors and outlines', () => {
    assert.equal(MASTERY_APPEARANCE.length, 3);
    assert.ok(MASTERY_APPEARANCE[0].width < MASTERY_APPEARANCE[1].width);
    assert.ok(MASTERY_APPEARANCE[1].width < MASTERY_APPEARANCE[2].width);
    assert.ok(MASTERY_APPEARANCE[0].height < MASTERY_APPEARANCE[1].height);
    assert.ok(MASTERY_APPEARANCE[1].height < MASTERY_APPEARANCE[2].height);
    assert.equal(new Set(MASTERY_APPEARANCE.map(tier => tier.halo)).size, 3);
    assert.equal(new Set(MASTERY_APPEARANCE.map(tier => tier.border)).size, 3);
    assert.equal(new Set(MASTERY_APPEARANCE.map(tier => tier.label)).size, 3);
});

test('tier captions render above other dinosaur sprites and follow moving units', () => {
    const makeNode = (x = 0, y = 0) => ({
        x, y, depth: 0, children: [],
        setDepth(depth) {this.depth = depth; return this;},
        setOrigin() {return this;}, setStrokeStyle() {return this;}, setDisplaySize() {return this;},
        add(children) {this.children.push(...children); return this;},
        setPosition(nextX, nextY) {this.x = nextX; this.y = nextY; return this;}
    });
    const scene = {add: {
        container: (x, y) => makeNode(x, y), ellipse: makeNode, image: makeNode,
        text: makeNode, rectangle: makeNode
    }};
    const view = Object.create(BattleView.prototype);
    Object.assign(view, {scene, units: new Map(), mode: 'formation', destroyed: false, playback: null});
    const entry = view.createUnit({id: 'd1', team: 'player', species: 'raptor', level: 3, x: 220, y: 410});
    assert.ok(entry.mastery.depth > entry.container.depth);
    assert.ok(!entry.container.children.includes(entry.mastery), 'label must not be covered by overlapping sprite containers');
    entry.container.setPosition(280, 370);
    view.update(16);
    assert.equal(entry.mastery.x, 280);
    assert.equal(entry.mastery.y, 327);
});

test('reserve fills right-hand sidebar vertically in both orientations', () => {
    for (const portrait of [true, false]) {
        const inventory = Array.from({length: 18}, (_, index) => unit('d' + index, 'raptor', null));
        const {view, send, events} = createView(portrait, {inventory});
        const units = view.reserveUnits();
        assert.equal(units.length, 9);
        assert.ok(units.every(dino => dino.x > view.width * 0.75));
        assert.ok(units.every((dino, i) => i === 0 || dino.y > units[i - 1].y));
        assert.ok(units.at(-1).y - units[0].y >= 400);
        assert.deepEqual(view.targetAtPoint(units[0].x, units[0].y), {unitId: units[0].id, reserve: true});
        assert.equal(view.targetAtPoint(view.width - 3, 300).reserve, true);
        assert.equal(view.targetAtPoint(view.width / 2, 300), null);
        send('pointerdown', units[0], 7, 'touch');
        send('pointerup', units[0], 7, 'touch');
        assert.deepEqual(events, [{type: 'select', id: units[0].id}]);
    }
});
