import {SPECIES, maxHp} from '../core/game.js';

const Phaser = window.Phaser;
const BOARD_WIDTH = 960;
const BOARD_HEIGHT = 520;
const CELL_SPACING_X = 66;
const CELL_SPACING_Y = 58;
const FIRST_LANE_Y = 82;
const FRONT_X = {player: 380, enemy: 580};

export class BattleView {
    constructor(host, {onCell, onSelect, onDrop}) {
        if (!Phaser) throw new Error('Die 2D-Spielengine konnte nicht geladen werden.');
        this.host = host;
        this.onCell = onCell;
        this.onSelect = onSelect;
        this.onDrop = onDrop;
        this.army = [];
        this.enemies = [];
        this.selected = null;
        this.upgrades = {};
        this.mode = 'formation';
        this.playback = null;
        this.units = new Map();
        this.scene = null;
        this.destroyed = false;
        const owner = this;
        this.game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: host,
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            backgroundColor: '#132938',
            scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: BOARD_WIDTH, height: BOARD_HEIGHT},
            scene: {
                create() { owner.initialize(this); },
                update(_time, delta) { owner.update(delta); }
            }
        });
    }

    initialize(scene) {
        if (this.destroyed) return;
        this.scene = scene;
        const background = scene.add.graphics();
        background.fillStyle(0x213a44, 1);
        background.fillRoundedRect(16, 44, 456, 386, 15);
        background.fillStyle(0x47373f, 1);
        background.fillRoundedRect(488, 44, 456, 386, 15);
        const grid = scene.add.graphics();
        for (const team of ['player', 'enemy']) {
            for (let depth = 0; depth < 3; depth++) {
                for (let lane = 0; lane < 5; lane++) {
                    const {x, y} = this.cellCenter(team, depth * 5 + lane);
                    grid.lineStyle(1.5, team === 'player' ? 0x8cb6b0 : 0xc6a7a2, 0.75);
                    grid.fillStyle(team === 'player' ? 0x325a58 : 0x62494b, 0.75);
                    grid.fillRoundedRect(x - 30, y - 27, 60, 54, 8);
                    grid.strokeRoundedRect(x - 30, y - 27, 60, 54, 8);
                }
            }
        }
        scene.add.text(245, 16, 'DEIN TEAM', {fontFamily: 'system-ui', fontSize: '23px', color: '#b4e4c4'}).setOrigin(0.5);
        scene.add.text(715, 16, 'GEGNER', {fontFamily: 'system-ui', fontSize: '23px', color: '#ffc49b'}).setOrigin(0.5);
        this.hint = scene.add.text(480, 466, '', {fontFamily: 'system-ui', fontSize: '19px', color: '#b4d6d9'}).setOrigin(0.5);
        scene.input.on('pointerdown', (pointer, objects) => {
            if (this.mode !== 'formation' || objects.some(object => object.getData('unitId'))) return;
            const cell = this.cellAt(pointer.x, pointer.y);
            if (cell !== null) this.onCell(cell);
        });
        scene.input.on('gameobjectdown', (_pointer, object) => {
            const id = object.getData('unitId');
            if (this.mode === 'formation' && id) this.onSelect(id);
        });
        scene.input.on('dragstart', (_pointer, object) => {
            if (this.mode !== 'formation' || !object.getData('unitId')) return;
            object.setDepth(10);
        });
        scene.input.on('drag', (_pointer, object, x, y) => {
            if (this.mode !== 'formation' || !object.getData('unitId')) return;
            object.setPosition(x, y);
        });
        scene.input.on('dragend', (_pointer, object) => {
            const id = object.getData('unitId');
            if (this.mode !== 'formation' || !id) return;
            const cell = this.cellAt(object.x, object.y);
            object.setDepth(1);
            const original = this.army.find(unit => unit.id === id);
            if (original) {
                const center = this.cellCenter('player', original.cell);
                object.setPosition(center.x, center.y);
            }
            if (cell !== null && original?.cell !== cell) this.onDrop(id, cell);
        });
        this.render();
    }

    cellCenter(team, cell) {
        const depth = Math.floor(cell / 5);
        const lane = cell % 5;
        const direction = team === 'player' ? -1 : 1;
        return {x: FRONT_X[team] + depth * CELL_SPACING_X * direction, y: FIRST_LANE_Y + lane * CELL_SPACING_Y};
    }

    cellAt(x, y) {
        const depth = Math.round((FRONT_X.player - x) / CELL_SPACING_X);
        const lane = Math.round((y - FIRST_LANE_Y) / CELL_SPACING_Y);
        if (depth < 0 || depth >= 3 || lane < 0 || lane >= 5) return null;
        const center = this.cellCenter('player', depth * 5 + lane);
        return Math.abs(center.x - x) <= 30 && Math.abs(center.y - y) <= 27 ? depth * 5 + lane : null;
    }

    showFormation(army, enemies, selected = null, upgrades = {}) {
        this.army = army;
        this.enemies = enemies;
        this.selected = selected;
        this.upgrades = upgrades;
        this.mode = 'formation';
        this.playback = null;
        this.render();
    }

    play(frames, complete) {
        this.mode = 'battle';
        this.playback = {frames, index: 0, elapsed: 0, complete};
        this.render();
    }

    update(delta) {
        if (this.destroyed || !this.scene) return;
        if (this.playback && this.mode === 'battle') {
            const playback = this.playback;
            playback.elapsed += Math.min(100, delta);
            while (playback.elapsed >= 95 && playback.index < playback.frames.length - 1) {
                playback.elapsed -= 95;
                playback.index++;
                this.render();
            }
            if (playback.index >= playback.frames.length - 1) {
                this.playback = null;
                playback.complete();
            }
        }
        const blend = Math.min(1, delta / 65);
        for (const entry of this.units.values()) {
            if (this.mode === 'battle') {
                entry.container.x += (entry.targetX - entry.container.x) * blend;
                entry.container.y += (entry.targetY - entry.container.y) * blend;
            }
        }
    }

    formationUnits() {
        const player = this.army.map(unit => {
            const center = this.cellCenter('player', unit.cell);
            return {id: unit.id, team: 'player', species: unit.species, x: center.x, y: center.y,
                hp: unit.hp, maxHp: maxHp(unit, this.upgrades)};
        });
        const enemy = this.enemies.map(unit => {
            const center = this.cellCenter('enemy', unit.cell);
            return {id: unit.id, team: 'enemy', species: unit.species, x: center.x, y: center.y,
                hp: unit.hp, maxHp: unit.hp};
        });
        return [...player, ...enemy];
    }

    createUnit(unit) {
        const scene = this.scene;
        const color = SPECIES[unit.species].color;
        const container = scene.add.container(unit.x, unit.y).setDepth(1);
        const shadow = scene.add.ellipse(0, 18, 46, 18, 0x101c23, 0.5);
        const circle = scene.add.circle(0, -3, 24, color);
        const shortName = scene.add.text(0, -8, SPECIES[unit.species].name.slice(0, 3).toUpperCase(),
            {fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color: '#101c23'}).setOrigin(0.5);
        const healthBack = scene.add.rectangle(-24, 26, 48, 6, 0x15212b).setOrigin(0, 0.5);
        const health = scene.add.rectangle(-24, 26, 48, 6, 0x91ebb3).setOrigin(0, 0.5);
        container.add([shadow, circle, shortName, healthBack, health]);
        if (unit.team === 'player') {
            container.setSize(60, 60);
            container.setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains);
            container.setData('unitId', unit.id);
            scene.input.setDraggable(container);
        }
        const result = {container, circle, health, targetX: unit.x, targetY: unit.y, hp: unit.hp, team: unit.team};
        this.units.set(unit.team + ':' + unit.id, result);
        return result;
    }

    render() {
        if (!this.scene || this.destroyed) return;
        const frame = this.mode === 'formation' ? this.formationUnits() : this.playback?.frames[this.playback.index] ?? [];
        this.hint.setText(this.mode === 'formation' ? 'Dino auswählen und auf Feld tippen oder ziehen' : 'KAMPF LÄUFT ...');
        const visible = new Set();
        for (const unit of frame) {
            const key = unit.team + ':' + unit.id;
            visible.add(key);
            const entry = this.units.get(key) ?? this.createUnit(unit);
            entry.targetX = unit.x;
            entry.targetY = unit.y;
            if (this.mode === 'formation') entry.container.setPosition(unit.x, unit.y);
            entry.container.setVisible(unit.hp > 0 || this.mode === 'formation');
            entry.container.setAlpha(unit.hp > 0 ? 1 : 0.4);
            entry.circle.setFillStyle(unit.stunned ? 0xf0d37d : SPECIES[unit.species].color);
            entry.circle.setStrokeStyle(unit.id === this.selected && this.mode === 'formation' ? 4 : 1.5,
                unit.id === this.selected && this.mode === 'formation' ? 0xffef8a : 0x15212b);
            entry.health.displayWidth = 48 * Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
            entry.hp = unit.hp;
            if (entry.team === 'player') {
                if (this.mode === 'battle') entry.container.disableInteractive();
                else if (!entry.container.input) {
                    entry.container.setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains);
                    this.scene.input.setDraggable(entry.container);
                }
            }
        }
        for (const [key, entry] of this.units) {
            if (!visible.has(key)) {
                entry.container.destroy();
                this.units.delete(key);
            }
        }
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.playback = null;
        this.game.destroy(true);
        this.units.clear();
        this.scene = null;
        this.host.replaceChildren();
    }
}
