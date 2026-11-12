import {SPECIES, maxHp} from '../core/game.js';
import {BOARD_SIZE, toBattleScreen, battleCellCenter, battleCellAt} from '../core/board-layout.js';

const Phaser = window.Phaser;
export class BattleView {
    constructor(host, {onCell, onSelect, onDrop}) {
        if (!Phaser) throw new Error('Die 2D-Spielengine konnte nicht geladen werden.');
        this.host = host;
        this.portrait = host.clientWidth < 620;
        this.onCell = onCell;
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
                create() { owner.initialize(this); },
                update(_time, delta) { owner.update(delta); }
            }
        });
    }

    initialize(scene) {
        if (this.destroyed) return;
        this.scene = scene;
        const width = this.portrait ? BOARD_SIZE.portrait.width : BOARD_SIZE.landscape.width;
        const background = scene.add.graphics();
        background.fillStyle(0x213a44, 1);
        background.fillRoundedRect(this.portrait ? 14 : 250, 328, this.portrait ? 512 : 460, 174, 15);
        background.fillStyle(0x47373f, 1);
        background.fillRoundedRect(this.portrait ? 14 : 250, 42, this.portrait ? 512 : 460, 174, 15);
        const grid = scene.add.graphics();
        for (const team of ['player', 'enemy']) {
            for (let cell = 0; cell < 15; cell++) {
                const {x, y} = this.cellCenter(team, cell);
                grid.lineStyle(1.5, team === 'player' ? 0x8cb6b0 : 0xc6a7a2, 0.75);
                grid.fillStyle(team === 'player' ? 0x325a58 : 0x62494b, 0.75);
                grid.fillRoundedRect(x - (this.portrait ? 41 : 40), y - 24, this.portrait ? 82 : 80, 48, 8);
                grid.strokeRoundedRect(x - (this.portrait ? 41 : 40), y - 24, this.portrait ? 82 : 80, 48, 8);
            }
        }
        scene.add.text(width / 2, 316, 'DEIN TEAM', {fontFamily: 'system-ui', fontSize: '23px', color: '#b4e4c4'}).setOrigin(0.5);
        scene.add.text(width / 2, 20, 'GEGNER', {fontFamily: 'system-ui', fontSize: '23px', color: '#ffc49b'}).setOrigin(0.5);
        this.hint = scene.add.text(width / 2, 270, '', {fontFamily: 'system-ui', fontSize: '19px', color: '#b4d6d9'}).setOrigin(0.5);
        this.reserveBackground = scene.add.rectangle(width / 2, 561, width - 16, 115, 0x223c48, 0.95);
        this.reserveTitle = scene.add.text(width / 2, 522, '', {fontFamily: 'system-ui', fontSize: '19px', color: '#d7e5f5'}).setOrigin(0.5);
        this.reserveButtons = [-1, 1].map(direction => {
            const x = direction === -1 ? 36 : width - 36;
            const backing = scene.add.rectangle(x, 568, 66, 82, 0x42677a, 0.96).setDepth(2);
            const arrow = scene.add.text(x, 565, direction === -1 ? '‹' : '›',
                {fontFamily: 'system-ui', fontSize: '58px', color: '#f0ca7c'}).setOrigin(0.5).setDepth(3);
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

    toScreen(x, y) { return toBattleScreen(x, y, this.portrait); }
    cellCenter(team, cell) { return battleCellCenter(team, cell, this.portrait); }
    cellAt(x, y) { return battleCellAt(x, y, this.portrait); }
    get reservePageSize() { return this.portrait ? 7 : 13; }
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
        const firstX = (this.width - (visible.length - 1) * 59) / 2;
        return visible.map((unit, index) => ({
            id: unit.id, team: 'reserve', species: unit.species, x: firstX + index * 59, y: 568,
            hp: unit.hp, maxHp: maxHp(unit, this.upgrades)
        }));
    }

    changeReservePage(direction) {
        const maxPage = Math.max(0, Math.ceil(this.inventory.length / this.reservePageSize) - 1);
        this.reservePage = Math.max(0, Math.min(maxPage, this.reservePage + direction));
        this.render();
    }

    unitAtPoint(x, y, excludeId = null) {
        const units = y >= 525 ? this.reserveUnits() : this.army.map(unit => ({
            id: unit.id, ...this.cellCenter('player', unit.cell)
        }));
        return units.find(unit => unit.id !== excludeId && Math.hypot(unit.x - x, unit.y - y) <= 29)?.id ?? null;
    }

    targetAtPoint(x, y, excludeId = null) {
        if (y >= 527 && y <= 618 && x >= 0 && x <= this.width) {
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
        if (target.reserve) this.dropMarker.strokeRoundedRect(7, 508, this.width - 14, 108, 12);
        else if (Number.isInteger(target.cell)) {
            const {x, y} = this.cellCenter('player', target.cell);
            this.dropMarker.strokeRoundedRect(x - (this.portrait ? 41 : 40), y - 24, this.portrait ? 82 : 80, 48, 8);
        }
    }

    highlightClient(clientX, clientY, excludeId = null) {
        this.showDropTarget(this.targetAtClient(clientX, clientY, excludeId));
    }

    handlePointerDown(event) {
        if (this.mode !== 'formation' || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const point = this.pointAtClient(event.clientX, event.clientY);
        if (!point) return;
        if (point.y >= 535 && point.y <= 610 && (point.x <= 70 || point.x >= this.width - 70)) {
            this.changeReservePage(point.x <= 70 ? -1 : 1);
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
        if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
        const unit = this.units.get('player:' + drag.id) ?? this.units.get('reserve:' + drag.id);
        if (unit) unit.container.setPosition(unit.targetX, unit.targetY).setDepth(1);
        this.showDropTarget(null);
        if (cancelled || this.mode !== 'formation') return;
        if (!drag.moved) {
            if (drag.id) this.onSelect(drag.id);
            else {
                const point = this.pointAtClient(event.clientX, event.clientY);
                const cell = point ? this.cellAt(point.x, point.y) : null;
                if (cell !== null) this.onCell(cell);
            }
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
        this.showDropTarget(null);
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
        if (this.mode === 'battle') {
            const blend = Math.min(1, delta / 65);
            for (const entry of this.units.values()) {
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
        return [...player, ...enemy, ...this.reserveUnits()];
    }

    createUnit(unit) {
        const scene = this.scene;
        const container = scene.add.container(unit.x, unit.y).setDepth(1);
        const shadow = scene.add.ellipse(0, 18, 46, 18, 0x101c23, 0.5);
        const circle = scene.add.circle(0, -3, 24, SPECIES[unit.species].color);
        const shortName = scene.add.text(0, -8, SPECIES[unit.species].name.slice(0, 3).toUpperCase(),
            {fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color: '#101c23'}).setOrigin(0.5);
        const healthBack = scene.add.rectangle(-24, 26, 48, 6, 0x15212b).setOrigin(0, 0.5);
        const health = scene.add.rectangle(-24, 26, 48, 6, 0x91ebb3).setOrigin(0, 0.5);
        container.add([shadow, circle, shortName, healthBack, health]);
        const result = {container, circle, health, targetX: unit.x, targetY: unit.y, team: unit.team};
        this.units.set(unit.team + ':' + unit.id, result);
        return result;
    }

    render() {
        if (!this.scene || this.destroyed) return;
        const frame = this.mode === 'formation' ? this.formationUnits() : this.playback?.frames[this.playback.index] ?? [];
        const isFormation = this.mode === 'formation';
        this.hint.setText(isFormation ? 'Dino wählen oder ziehen' : 'KAMPF LÄUFT ...');
        for (const element of [this.reserveBackground, this.reserveTitle, ...this.reserveButtons.flatMap(button => [button.backing, button.arrow])]) {
            element.setVisible(isFormation);
        }
        const pageCount = Math.max(1, Math.ceil(this.inventory.length / this.reservePageSize));
        this.reserveTitle.setText('VORRAT (' + this.inventory.length + ') · ' + (this.reservePage + 1) + '/' + pageCount);
        this.reserveButtons[0].backing.setVisible(isFormation && this.reservePage > 0);
        this.reserveButtons[0].arrow.setVisible(isFormation && this.reservePage > 0);
        this.reserveButtons[1].backing.setVisible(isFormation && this.reservePage < pageCount - 1);
        this.reserveButtons[1].arrow.setVisible(isFormation && this.reservePage < pageCount - 1);
        const visible = new Set();
        for (const raw of frame) {
            const unit = isFormation ? raw : {...raw, ...this.toScreen(raw.x, raw.y)};
            const key = unit.team + ':' + unit.id;
            visible.add(key);
            const entry = this.units.get(key) ?? this.createUnit(unit);
            entry.targetX = unit.x;
            entry.targetY = unit.y;
            if (isFormation && this.drag?.id !== unit.id) entry.container.setPosition(unit.x, unit.y);
            entry.container.setVisible(unit.hp > 0 || isFormation);
            entry.container.setAlpha(unit.hp > 0 ? 1 : 0.4);
            entry.circle.setFillStyle(unit.stunned ? 0xf0d37d : SPECIES[unit.species].color);
            const chosen = unit.id === this.selected && isFormation;
            entry.circle.setStrokeStyle(chosen ? 4 : 1.5, chosen ? 0xffef8a : 0x15212b);
            entry.health.displayWidth = 48 * Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
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
