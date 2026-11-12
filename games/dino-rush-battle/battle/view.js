import {SPECIES} from '../core/game.js';

const Phaser = window.Phaser;
const BOARD_W = 960;
const BOARD_H = 520;

export class BattleView {
    constructor(host, onCell) {
        if (!Phaser) throw new Error('Die 2D-Spielengine konnte nicht geladen werden.');
        this.host = host;
        this.onCell = onCell;
        this.army = [];
        this.enemies = [];
        this.selected = null;
        this.mode = 'formation';
        this.currentFrame = null;
        this.interval = null;
        this.scene = null;
        this.game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: host,
            width: BOARD_W,
            height: BOARD_H,
            backgroundColor: '#132938',
            scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: BOARD_W, height: BOARD_H},
            scene: {
                create: () => {
                    this.scene = this.game.scene.scenes[0];
                    this.render();
                }
            }
        });
    }
    showFormation(army, enemies, selected = null) {
        this.army = army;
        this.enemies = enemies;
        this.selected = selected;
        this.mode = 'formation';
        this.currentFrame = null;
        this.render();
    }
    play(frames, complete) {
        clearInterval(this.interval);
        this.mode = 'battle';
        let index = 0;
        this.currentFrame = frames[0];
        this.render();
        this.interval = setInterval(() => {
            if (index >= frames.length - 1) {
                clearInterval(this.interval);
                this.interval = null;
                complete();
                return;
            }
            index = Math.min(frames.length - 1, index + 1);
            this.currentFrame = frames[index];
            this.render();
        }, 70);
    }
    render() {
        const scene = this.scene;
        if (!scene) return;
        scene.children.removeAll(true);
        scene.add.text(245, 15, 'DEIN TEAM', {fontFamily: 'system-ui', fontSize: '24px', color: '#b4e4c4'}).setOrigin(0.5);
        scene.add.text(715, 15, 'GEGNER', {fontFamily: 'system-ui', fontSize: '24px', color: '#ffc49b'}).setOrigin(0.5);
        for (const team of ['player', 'enemy']) {
            for (let depth = 0; depth < 3; depth++) {
                for (let lane = 0; lane < 5; lane++) {
                    const x = team === 'player' ? 380 - depth * 66 : 580 + depth * 66;
                    const y = 82 + lane * 58;
                    const cell = depth * 5 + lane;
                    const square = scene.add.rectangle(x, y, 62, 64, team === 'player' ? 0x294c52 : 0x593b3f, 0.7);
                    square.setStrokeStyle(1, 0x8eaab0, 0.6);
                    if (this.mode === 'formation' && team === 'player') {
                        square.setInteractive({useHandCursor: true});
                        square.on('pointerdown', () => this.onCell(cell));
                    }
                }
            }
        }
        let units;
        if (this.currentFrame) units = this.currentFrame;
        else units = [...this.army.map(unit => this.formationUnit(unit, 'player')), ...this.enemies.map(unit => this.formationUnit(unit, 'enemy'))];
        for (const unit of units) {
            if (unit.hp <= 0 && this.mode === 'battle') continue;
            const species = SPECIES[unit.species];
            const isSelected = unit.id === this.selected && this.mode === 'formation';
            scene.add.circle(unit.x, unit.y, 24, species.color, unit.hp > 0 ? 1 : 0.35).setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0xfff1a0 : 0x183139);
            scene.add.text(unit.x, unit.y - 5, species.name.slice(0, 3).toUpperCase(), {fontFamily: 'system-ui', fontSize: '11px', color: '#0c1927', fontStyle: 'bold'}).setOrigin(0.5);
            scene.add.rectangle(unit.x, unit.y + 26, 46, 6, 0x182331);
            scene.add.rectangle(unit.x - 23 + (Math.max(0, unit.hp) / unit.maxHp) * 23, unit.y + 26, 46 * Math.max(0, unit.hp) / unit.maxHp, 6, 0x7fe6a0);
        }
        if (this.mode === 'battle') scene.add.text(480, 460, 'KAMPF LÄUFT ...', {fontFamily: 'system-ui', fontSize: '24px', color: '#fff4bf'}).setOrigin(0.5);
        else scene.add.text(480, 462, 'Wähle unten einen Dino und tippe auf ein Feld', {fontFamily: 'system-ui', fontSize: '19px', color: '#b4d6d9'}).setOrigin(0.5);
    }
    formationUnit(unit, team) {
        const depth = Math.floor(unit.cell / 5);
        const lane = unit.cell % 5;
        return {
            id: unit.id, team, species: unit.species, hp: unit.hp, maxHp: SPECIES[unit.species].hp * (1 + (unit.level - 1) * 0.2),
            x: team === 'player' ? 380 - depth * 66 : 580 + depth * 66,
            y: 82 + lane * 58
        };
    }
    destroy() {
        clearInterval(this.interval);
        this.interval = null;
        this.game.destroy(true);
        this.scene = null;
        this.host.replaceChildren();
    }
}
