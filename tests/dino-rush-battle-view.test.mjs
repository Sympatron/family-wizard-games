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
    object.setAlpha = alpha => {object.alpha = alpha; return object;};
    object.setTint = tint => {object.tint = tint; return object;};
    object.setVisible = visible => {object.visible = visible; return object;};
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
        const pageSize = 6;
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
        assert.equal(units.length, 6);
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

test('dragging greys out nonmergeable dinosaurs and enemies, while matching tiers stay clear', () => {
    const starter = unit('d1', 'raptor', 0);
    const compatible = unit('d2', 'raptor', 1);
    const otherSpecies = unit('d3', 'triceratops', 2);
    const otherTier = {...unit('d4', 'raptor', null), level: 2};
    const matchingReserve = unit('d5', 'raptor', null);
    const {view, send} = createView(false, {army: [starter, compatible, otherSpecies], inventory: [otherTier, matchingReserve]});
    view.enemies = [unit('e1', 'triceratops', 0)];
    const entries = [
        ['player:d1', starter], ['player:d2', compatible], ['player:d3', otherSpecies],
        ['reserve:d4', otherTier], ['reserve:d5', matchingReserve], ['enemy:e1', view.enemies[0]]
    ];
    for (const [key] of entries) {
        view.units.set(key, {container: makeElement(), sprite: makeElement(), mastery: makeElement()});
    }
    const origin = view.cellCenter('player', starter.cell);
    send('pointerdown', origin);
    assert.equal(view.units.get('player:d3').container.alpha, undefined, 'selection alone must not dim units');
    send('pointermove', {x: origin.x + 30, y: origin.y});
    for (const key of ['player:d1', 'player:d2', 'reserve:d5']) {
        assert.equal(view.units.get(key).container.alpha, 1, key + ' should remain clear');
    }
    for (const key of ['player:d3', 'reserve:d4', 'enemy:e1']) {
        assert.equal(view.units.get(key).container.alpha, 0.28, key + ' should be dimmed');
        assert.equal(view.units.get(key).sprite.tint, 0x777777);
        assert.equal(view.units.get(key).mastery.alpha, 0.28);
    }
    send('pointerup', {x: origin.x + 30, y: origin.y});
    for (const [key] of entries) {
        assert.equal(view.units.get(key).container.alpha, 1, key + ' should restore its opacity');
        assert.equal(view.units.get(key).sprite.tint, 0xffffff);
    }
});

test('battle rendering hides the colored tier auras and selection ellipses', () => {
    function node(x = 0, y = 0) {
        const result = makeElement().setPosition(x, y);
        result.add = children => {result.children = children; return result;};
        result.destroy = () => {};
        return result;
    }
    const view = Object.create(BattleView.prototype);
    const sprite = {id: 'd1', team: 'player', species: 'raptor', level: 3, x: 220, y: 210, hp: 70, maxHp: 70};
    Object.assign(view, {
        mode: 'battle', destroyed: false, portrait: false,
        scene: {add: {container: node, ellipse: node, image: node, text: node, rectangle: node}},
        units: new Map(), army: [], enemies: [], inventory: [], reservePage: 0, previousHp: new Map(),
        formationLayers: [], reserveBackground: node(), reserveTitle: node(), reserveButtons: [
            {backing: node(), arrow: node()}, {backing: node(), arrow: node()}
        ], playback: {frames: [[sprite]], index: 0}, lastShotFrame: 0
    });
    view.render();
    const entry = view.units.get('player:d1');
    assert.equal(entry.aura.visible, false);
    assert.equal(entry.selection.visible, false);
});
