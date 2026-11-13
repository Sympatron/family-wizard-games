import {SPECIES, maxHp, getMergeChoices} from '../core/game.js';
import {BOARD_SIZE, toCombatScreen, battleCellCenter, battleCellAt, reserveSidebar, reserveUnitPosition} from '../core/board-layout.js';
import {createHitSound} from '../core/hit-sound.js';
import {drawBattlefield} from './terrain.js';

const Phaser = window.Phaser;
export const MASTERY_APPEARANCE = Object.freeze([
    {width: 60, height: 48, halo: 0x285c4e, border: 0x83e7b4, label: '#b8f6d5'},
    {width: 68, height: 55, halo: 0x264c85, border: 0x75bfff, label: '#a5d8ff'},
    {width: 77, height: 63, halo: 0x684276, border: 0xffd071, label: '#ffe3a1'}
]);
export class BattleView {
    constructor(host, {onSelect, onDrop}) {
        if (!Phaser) throw new Error('Die 2D-Spielengine konnte nicht geladen werden.');
        this.host = host;
        this.portrait = host.clientWidth < 620;
        this.onSelect = onSelect;
        this.onDrop = onDrop;
        this.army = [];
        this.enemies = [];
        this.inventory = [];
        this.reservePage = 0;
        this.selected = null;
        this.upgrades = {};
        this.mode = 'formation';
        this.playback = null;
        this.lastShotFrame = -1;
        this.hitSound = createHitSound();
        this.previousHp = new Map();
        this.units = new Map();
        this.scene = null;
        this.canvas = null;
        this.drag = null;
        this.destroyed = false;
        const size = this.portrait ? BOARD_SIZE.portrait : BOARD_SIZE.landscape;
        const owner = this;
        this.game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: host,
            width: size.width,
            height: size.height,
            backgroundColor: '#132938',
            scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: size.width, height: size.height},
            scene: {
                preload() { owner.preload(this); },
                create() { owner.initialize(this); },
                update(_time, delta) { owner.update(delta); }
            }
        });
    }

    preload(scene) {
        for (const species of Object.keys(SPECIES)) {
            scene.load.svg('dino-' + species, './assets/dinos/' + species + '.svg', {width: 160, height: 128});
        }
    }

    initialize(scene) {
        if (this.destroyed) return;
        this.scene = scene;
        const width = this.portrait ? BOARD_SIZE.portrait.width : BOARD_SIZE.landscape.width;
        const sidebar = reserveSidebar(this.portrait);
        const fieldCenter = sidebar.left / 2;
        const terrain = scene.textures?.createCanvas('dino-battlefield', 960, 620);
        if (terrain) {
            drawBattlefield(terrain.context);
            terrain.refresh();
        }
        this.battlefield = scene.add.image(width / 2, 310, 'dino-battlefield').setDisplaySize(960, 620).setDepth(-10);
        const background = scene.add.graphics().setDepth(-4);
        background.fillStyle(0x223c36, 0.68);
        background.fillRoundedRect(8, 328, sidebar.left - 16, 174, 15);
        background.fillStyle(0x483a3e, 0.7);
        background.fillRoundedRect(8, 42, sidebar.left - 16, 174, 15);
        const grid = scene.add.graphics().setDepth(-3);
        for (const team of ['player', 'enemy']) {
            for (let cell = 0; cell < 15; cell++) {
                const {x, y} = this.cellCenter(team, cell);
                grid.lineStyle(1.5, team === 'player' ? 0x8cb6b0 : 0xc6a7a2, 0.85);
                grid.fillStyle(team === 'player' ? 0x325a58 : 0x62494b, 0.82);
                grid.fillRoundedRect(x - (this.portrait ? 41 : 40), y - 24, this.portrait ? 82 : 80, 48, 8);
                grid.strokeRoundedRect(x - (this.portrait ? 41 : 40), y - 24, this.portrait ? 82 : 80, 48, 8);
            }
        }
        this.formationLayers = [background, grid,
            scene.add.text(fieldCenter, 540, 'DEIN TEAM', {fontFamily: 'system-ui', fontSize: '23px', fontStyle: 'bold', color: '#b4e4c4'}).setOrigin(0.5).setDepth(4),
            scene.add.text(fieldCenter, 20, 'GEGNER', {fontFamily: 'system-ui', fontSize: '23px', fontStyle: 'bold', color: '#ffc49b'}).setOrigin(0.5).setDepth(4)];
        this.reserveBackground = scene.add.rectangle(sidebar.center, 310, sidebar.width - 4, 610, 0x142a36, 0.95).setDepth(-2);
        this.reserveTitle = scene.add.text(sidebar.center, 25, '', {fontFamily: 'system-ui', fontSize: this.portrait ? '13px' : '17px', fontStyle: 'bold', color: '#d7e5f5'}).setOrigin(0.5).setDepth(3);
        this.reserveButtons = [-1, 1].map(direction => {
            const x = sidebar.center + direction * (this.portrait ? 28 : 42);
            const backing = scene.add.rectangle(x, 588, this.portrait ? 46 : 64, 46, 0x42677a, 0.96).setDepth(2);
            const arrow = scene.add.text(x, 585, direction === -1 ? '‹' : '›',
                {fontFamily: 'system-ui', fontSize: '35px', color: '#f0ca7c'}).setOrigin(0.5).setDepth(3);
            return {backing, arrow};
        });
        this.dropMarker = scene.add.graphics().setDepth(5);
        this.canvas = scene.game.canvas;
        this.pointerDown = event => this.handlePointerDown(event);
        this.pointerMove = event => this.handlePointerMove(event);
        this.pointerUp = event => this.handlePointerUp(event);
        this.pointerCancel = event => this.handlePointerUp(event, true);
        this.canvas.addEventListener('pointerdown', this.pointerDown);
        this.canvas.addEventListener('pointermove', this.pointerMove);
        this.canvas.addEventListener('pointerup', this.pointerUp);
        this.canvas.addEventListener('pointercancel', this.pointerCancel);
        this.render();
    }

    toScreen(x, y) { return toCombatScreen(x, y, this.portrait); }
    cellCenter(team, cell) { return battleCellCenter(team, cell, this.portrait); }
    cellAt(x, y) { return battleCellAt(x, y, this.portrait); }
    get reservePageSize() { return 6; }
    get width() { return this.portrait ? BOARD_SIZE.portrait.width : BOARD_SIZE.landscape.width; }

    pointAtClient(clientX, clientY) {
        if (!this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
        return {x: (clientX - rect.left) / rect.width * this.width, y: (clientY - rect.top) / rect.height * BOARD_SIZE.portrait.height};
    }

    clientCell(clientX, clientY) {
        const point = this.pointAtClient(clientX, clientY);
        return point ? this.cellAt(point.x, point.y) : null;
    }

    reserveUnits() {
        const from = this.reservePage * this.reservePageSize;
        const visible = this.inventory.slice(from, from + this.reservePageSize);
        return visible.map((unit, index) => ({
            id: unit.id, team: 'reserve', species: unit.species, level: unit.level, ...reserveUnitPosition(index, this.portrait),
            hp: unit.hp, maxHp: maxHp(unit, this.upgrades)
        }));
    }

    changeReservePage(direction) {
        const maxPage = Math.max(0, Math.ceil(this.inventory.length / this.reservePageSize) - 1);
        this.reservePage = Math.max(0, Math.min(maxPage, this.reservePage + direction));
        this.render();
    }

    unitAtPoint(x, y, excludeId = null) {
        const units = x >= reserveSidebar(this.portrait).left ? this.reserveUnits() : this.army.map(unit => ({
            id: unit.id, ...this.cellCenter('player', unit.cell)
        }));
        return units.find(unit => unit.id !== excludeId && Math.hypot(unit.x - x, unit.y - y) <= 29)?.id ?? null;
    }

    targetAtPoint(x, y, excludeId = null) {
        if (x >= reserveSidebar(this.portrait).left && y >= 55 && y <= 559) {
            const unitId = this.unitAtPoint(x, y, excludeId);
            return unitId ? {unitId, reserve: true} : {reserve: true};
        }
        const cell = this.cellAt(x, y);
        if (cell === null) return null;
        const unitId = this.army.find(unit => unit.id !== excludeId && unit.cell === cell)?.id;
        return unitId ? {unitId, cell} : {cell};
    }

    targetAtClient(clientX, clientY, excludeId = null) {
        const point = this.pointAtClient(clientX, clientY);
        return point ? this.targetAtPoint(point.x, point.y, excludeId) : null;
    }

    showDropTarget(target) {
        if (!this.dropMarker) return;
        this.dropMarker.clear();
        if (!target || this.mode !== 'formation') return;
        this.dropMarker.lineStyle(4, 0xffe59b, 1);
        if (target.reserve) {
            const sidebar = reserveSidebar(this.portrait);
            this.dropMarker.strokeRoundedRect(sidebar.left + 4, 54, sidebar.width - 8, 504, 12);
        }
        else if (Number.isInteger(target.cell)) {
            const {x, y} = this.cellCenter('player', target.cell);
            this.dropMarker.strokeRoundedRect(x - (this.portrait ? 41 : 40), y - 24, this.portrait ? 82 : 80, 48, 8);
        }
    }

    highlightClient(clientX, clientY, excludeId = null) {
        this.showDropTarget(this.targetAtClient(clientX, clientY, excludeId));
    }

    updateDragCompatibility() {
        const pool = [...this.army, ...this.inventory];
        const source = this.mode === 'formation' && this.drag?.moved ? pool.find(unit => unit.id === this.drag.id) : null;
        for (const [key, entry] of this.units) {
            const [team, id] = key.split(':');
            const unit = (team === 'enemy' ? this.enemies : pool).find(candidate => candidate.id === id);
            const incompatible = source && (team === 'enemy' || (id !== source.id && getMergeChoices(source, unit).length === 0));
            entry.container.setAlpha(incompatible ? 0.28 : unit?.hp > 0 ? 1 : 0.4);
            if (source || entry.dragDimmed) entry.sprite?.setTint(incompatible ? 0x777777 : 0xffffff);
            entry.dragDimmed = !!incompatible;
            entry.mastery?.setAlpha(incompatible ? 0.28 : unit?.hp > 0 ? 1 : 0.4);
        }
    }

    handlePointerDown(event) {
        this.hitSound?.unlock();
        if (this.mode !== 'formation' || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const point = this.pointAtClient(event.clientX, event.clientY);
        if (!point) return;
        const sidebar = reserveSidebar(this.portrait);
        if (point.x >= sidebar.left && point.y >= 562 && point.y <= 620) {
            this.changeReservePage(point.x < sidebar.center ? -1 : 1);
            event.preventDefault();
            return;
        }
        const id = this.unitAtPoint(point.x, point.y);
        this.drag = {id, pointerId: event.pointerId, start: point, moved: false};
        this.canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }

    handlePointerMove(event) {
        const drag = this.drag;
        if (!drag || drag.pointerId !== event.pointerId || this.mode !== 'formation') return;
        const point = this.pointAtClient(event.clientX, event.clientY);
        if (!point) {
            this.showDropTarget(null);
            return;
        }
        if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 9) return;
        drag.moved = true;
        if (drag.id) this.updateDragCompatibility();
        if (drag.id) {
            const unit = this.units.get('player:' + drag.id) ?? this.units.get('reserve:' + drag.id);
            if (unit) {
                unit.container.setDepth(10);
                unit.container.setPosition(unit.targetX + point.x - drag.start.x, unit.targetY + point.y - drag.start.y);
            }
            this.showDropTarget(this.targetAtPoint(point.x, point.y, drag.id));
        }
        event.preventDefault();
    }

    handlePointerUp(event, cancelled = false) {
        const drag = this.drag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        this.drag = null;
        this.updateDragCompatibility();
        if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
        const unit = this.units.get('player:' + drag.id) ?? this.units.get('reserve:' + drag.id);
        if (unit) unit.container.setPosition(unit.targetX, unit.targetY).setDepth(1);
        this.showDropTarget(null);
        if (cancelled || this.mode !== 'formation') return;
        if (!drag.moved) {
            if (drag.id) this.onSelect(drag.id);
            return;
        }
        if (drag.id) {
            const target = this.targetAtClient(event.clientX, event.clientY, drag.id);
            if (target) this.onDrop(drag.id, target);
        }
    }

    showFormation(army, enemies, selected = null, upgrades = {}, inventory = []) {
        this.army = army;
        this.enemies = enemies;
        this.inventory = inventory;
        this.reservePage = Math.min(this.reservePage, Math.max(0, Math.ceil(inventory.length / this.reservePageSize) - 1));
        this.selected = selected;
        this.upgrades = upgrades;
        this.mode = 'formation';
        this.playback = null;
        this.drag = null;
        this.showDropTarget(null);
        this.render();
    }

    play(frames, complete) {
        this.hitSound?.unlock();
        this.previousHp = new Map(frames[0].map(unit => [unit.team + ':' + unit.id, unit.hp]));
        this.lastShotFrame = -1;
        this.mode = 'battle';
        this.drag = null;
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
        if (this.mode === 'battle') {
            const blend = Math.min(1, delta / 65);
            for (const entry of this.units.values()) {
                entry.container.x += (entry.targetX - entry.container.x) * blend;
                entry.container.y += (entry.targetY - entry.container.y) * blend;
            }
        }
        for (const entry of this.units.values()) entry.mastery?.setPosition(entry.container.x, entry.container.y - 43);
    }

    formationUnits() {
        const player = this.army.map(unit => {
            const center = this.cellCenter('player', unit.cell);
            return {id: unit.id, team: 'player', species: unit.species, level: unit.level, x: center.x, y: center.y,
                hp: unit.hp, maxHp: maxHp(unit, this.upgrades)};
        });
        const enemy = this.enemies.map(unit => {
            const center = this.cellCenter('enemy', unit.cell);
            return {id: unit.id, team: 'enemy', species: unit.species, level: unit.level, x: center.x, y: center.y,
                hp: unit.hp, maxHp: unit.hp};
        });
        return [...player, ...enemy, ...this.reserveUnits()];
    }

    emitHitSparks(raw, damage = 0) {
        if (!this.scene?.tweens) return;
        const {x, y} = this.toScreen(raw.x, raw.y);
        for (let index = 0; index < 7; index++) {
            const angle = index * Math.PI * 2 / 7;
            const speed = 18 + Math.random() * 19;
            const spark = this.scene.add.circle(x, y, 2.5 + Math.random() * 2, index % 2 ? 0xffc779 : 0xff8069).setDepth(20);
            this.scene.tweens.add({
                targets: spark, x: x + Math.cos(angle) * speed, y: y + Math.sin(angle) * speed,
                alpha: 0, scale: 0.2, duration: 250,
                onComplete: () => spark.destroy()
            });
        }
        if (damage > 0) {
            const label = this.scene.add.text(x, y - 35, '−' + Math.round(damage), {
                fontFamily: 'system-ui', fontSize: '22px', fontStyle: 'bold', color: '#ffcf9e',
                stroke: '#1a2a35', strokeThickness: 4
            }).setOrigin(0.5).setDepth(22);
            this.scene.tweens.add({
                targets: label, y: y - 82, alpha: 0, duration: 650, ease: 'Cubic.Out',
                onComplete: () => label.destroy()
            });
        }
        this.hitSound?.hit('impact');
    }
    emitRangedProjectile(shot) {
        if (!this.scene?.tweens) return;
        const from = this.toScreen(shot.x, shot.y);
        const to = this.toScreen(shot.tx, shot.ty);
        const color = shot.team === 'player' ? 0x7aeaff : 0xffaa7d;
        const projectile = this.scene.add.circle(from.x, from.y - 8, 6, color).setDepth(19);
        this.scene.tweens.add({
            targets: projectile, x: to.x, y: to.y - 8, alpha: 0.25,
            duration: 175, ease: 'Linear', onComplete: () => projectile.destroy()
        });
    }

    createUnit(unit) {
        const scene = this.scene;
        const container = scene.add.container(unit.x, unit.y).setDepth(1);
        const tier = Math.max(1, Math.min(3, unit.level ?? 1));
        const appearance = MASTERY_APPEARANCE[tier - 1];
        const shadow = scene.add.ellipse(0, 18, appearance.width * 0.76, 18, 0x101c23, 0.5);
        const aura = scene.add.ellipse(0, -8, appearance.width + 7, appearance.height + 7, appearance.halo, 0.55)
            .setStrokeStyle(3, appearance.border, 0.95);
        const sprite = scene.add.image(0, -8, 'dino-' + unit.species).setDisplaySize(appearance.width, appearance.height);
        const selection = scene.add.ellipse(0, -8, appearance.width + 15, appearance.height + 15, 0xffef8a, 0)
            .setStrokeStyle(0, 0xffef8a);
        const mastery = scene.add.text(unit.x, unit.y - 43, 'R' + SPECIES[unit.species].rank + ' · T' + tier, {
            fontFamily: 'system-ui', fontSize: '13px', fontStyle: 'bold', color: appearance.label,
            stroke: '#10202b', strokeThickness: 3
        }).setOrigin(0.5).setDepth(12);
        const healthBack = scene.add.rectangle(-24, 26, 48, 6, 0x15212b).setOrigin(0, 0.5);
        const health = scene.add.rectangle(-24, 26, 48, 6, 0x91ebb3).setOrigin(0, 0.5);
        container.add([shadow, aura, selection, sprite, healthBack, health]);
        const result = {container, sprite, aura, selection, mastery, health, targetX: unit.x, targetY: unit.y, team: unit.team};
        this.units.set(unit.team + ':' + unit.id, result);
        return result;
    }

    render() {
        if (!this.scene || this.destroyed) return;
        const frame = this.mode === 'formation' ? this.formationUnits() : this.playback?.frames[this.playback.index] ?? [];
        const isFormation = this.mode === 'formation';
        if (!isFormation && this.playback && this.playback.index !== this.lastShotFrame) {
            this.lastShotFrame = this.playback.index;
            for (const shot of frame.shots ?? []) this.emitRangedProjectile(shot);
        }
        for (const layer of this.formationLayers) layer.setVisible(isFormation);
        for (const element of [this.reserveBackground, this.reserveTitle, ...this.reserveButtons.flatMap(button => [button.backing, button.arrow])]) {
            element.setVisible(isFormation);
        }
        const pageCount = Math.max(1, Math.ceil(this.inventory.length / this.reservePageSize));
        this.reserveTitle.setText('VORRAT ' + this.inventory.length + ' · ' + (this.reservePage + 1) + '/' + pageCount);
        this.reserveButtons[0].backing.setVisible(isFormation && this.reservePage > 0);
        this.reserveButtons[0].arrow.setVisible(isFormation && this.reservePage > 0);
        this.reserveButtons[1].backing.setVisible(isFormation && this.reservePage < pageCount - 1);
        this.reserveButtons[1].arrow.setVisible(isFormation && this.reservePage < pageCount - 1);
        const visible = new Set();
        for (const raw of frame) {
            const unit = isFormation ? raw : {...raw, ...this.toScreen(raw.x, raw.y)};
            const key = unit.team + ':' + unit.id;
            if (!isFormation) {
                const previous = this.previousHp?.get(key);
                if (previous !== undefined && unit.hp < previous) this.emitHitSparks(raw, previous - unit.hp);
                this.previousHp?.set(key, unit.hp);
            }
            visible.add(key);
            const entry = this.units.get(key) ?? this.createUnit(unit);
            entry.targetX = unit.x;
            entry.targetY = unit.y;
            if (isFormation && this.drag?.id !== unit.id) entry.container.setPosition(unit.x, unit.y);
            entry.mastery.setPosition(entry.container.x, entry.container.y - 43);
            entry.mastery.setVisible(unit.hp > 0 || isFormation);
            entry.container.setVisible(unit.hp > 0 || isFormation);
            entry.container.setAlpha(unit.hp > 0 ? 1 : 0.4);
            entry.mastery.setAlpha(unit.hp > 0 ? 1 : 0.4);
            entry.sprite.setTint(unit.stunned ? 0xf0d37d : 0xffffff);
            const chosen = unit.id === this.selected && isFormation;
            entry.aura.setVisible(isFormation);
            entry.selection.setVisible(isFormation);
            entry.selection.setStrokeStyle(chosen ? 4 : 0, 0xffef8a);
            entry.health.displayWidth = 48 * Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
        }
        this.updateDragCompatibility();
        for (const [key, entry] of this.units) {
            if (!visible.has(key)) {
                entry.container.destroy();
                entry.mastery.destroy();
                this.units.delete(key);
            }
        }
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.playback = null;
        this.hitSound?.dispose();
        if (this.canvas) {
            this.canvas.removeEventListener('pointerdown', this.pointerDown);
            this.canvas.removeEventListener('pointermove', this.pointerMove);
            this.canvas.removeEventListener('pointerup', this.pointerUp);
            this.canvas.removeEventListener('pointercancel', this.pointerCancel);
        }
        this.drag = null;
        this.game.destroy(true);
        this.units.clear();
        this.scene = null;
        this.host.replaceChildren();
    }
}
