import {SPECIES, maxHp, unitPower} from './game.js';

const TICK = 0.1;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const snapshot = (units, shots = []) => {
    const frame = units.map(u => ({id: u.id, team: u.team, species: u.species, level: u.level, x: u.x, y: u.y, hp: Math.max(0, u.hp), maxHp: u.maxHp, stunned: u.stunned > 0}));
    frame.shots = shots;
    return frame;
};

export function simulateBattle(army, enemies, upgrades = {}, battleUpgrades = {}) {
    const units = [...army.map(unit => makeUnit(unit, 'player', upgrades, battleUpgrades)), ...enemies.map(unit => makeUnit(unit, 'enemy'))];
    const frames = [snapshot(units)];
    const teamSupport = Object.fromEntries(['player', 'enemy'].map(team => [
        team, Math.min(0.16, units.filter(unit => unit.team === team && unit.trait === 'support').length * 0.04)
    ]));
    let shots = [];
    let winner = null;
    for (let step = 0; step < 600; step++) {
        for (const unit of units) {
            if (unit.hp <= 0) continue;
            unit.cooldown = Math.max(0, unit.cooldown - TICK);
            unit.stunned = Math.max(0, unit.stunned - TICK);
            if (unit.poison > 0) {
                unit.poison = Math.max(0, unit.poison - TICK);
                unit.hp = Math.max(0, unit.hp - 1.8 * TICK);
                if (unit.hp <= 0) continue;
            }
            if (unit.stunned > 0) continue;
            const targets = units.filter(other => other.team !== unit.team && other.hp > 0);
            if (!targets.length) break;
            targets.sort((a, b) => distance(unit, a) - distance(unit, b));
            const target = targets[0];
            const d = distance(unit, target);
            if (d > unit.range) {
                const stepDistance = Math.min(d - unit.range + 1, unit.speed * TICK);
                unit.x += (target.x - unit.x) / d * stepDistance;
                unit.y += (target.y - unit.y) / d * stepDistance;
            } else if (unit.cooldown <= 0) {
                unit.cooldown = unit.attackTime;
                unit.attacks++;
                if (SPECIES[unit.species].role === 'Fernkampf') {
                    shots.push({team: unit.team, species: unit.species, x: unit.x, y: unit.y, tx: target.x, ty: target.y});
                }
                target.receivedAttacks++;
                let damage = unit.damage * (1 + teamSupport[unit.team]);
                if (unit.trait === 'burst' && unit.attacks % 3 === 0) damage *= 1.45;
                if (target.trait === 'armor') damage *= 0.78;
                if (target.trait === 'evasion' && target.receivedAttacks % 6 === 0) damage = 0;
                damage = Math.max(0, Math.round(damage));
                target.hp = Math.max(0, target.hp - damage);
                if (target.trait === 'reflect' || target.trait === 'counter') {
                    unit.hp = Math.max(0, unit.hp - Math.ceil(damage * (target.trait === 'reflect' ? 0.18 : 0.1)));
                }
                if (['poison', 'bleed'].includes(unit.trait) && unit.attacks % 2 === 0) target.poison = Math.max(target.poison, 1.7);
                if ((unit.trait === 'stun' || unit.species === 'triceratops') && unit.attacks % 3 === 0) {
                    target.stunned = Math.max(target.stunned, 0.55);
                }
                if (['cleave', 'pierce'].includes(unit.trait)) {
                    for (const other of targets.slice(1, unit.trait === 'cleave' ? 3 : 2)) {
                        if (other.hp > 0 && distance(other, target) < 105) {
                            other.hp = Math.max(0, other.hp - Math.ceil(damage * 0.3));
                        }
                    }
                }
                if (unit.trait === 'heal' && unit.attacks % 3 === 0) {
                    const ally = units.filter(other => other.team === unit.team && other.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                    if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + Math.ceil(ally.maxHp * 0.075));
                }
            }
        }
        if (step % 2 === 0) {
            frames.push(snapshot(units, shots));
            shots = [];
        }
        const alivePlayer = units.some(u => u.team === 'player' && u.hp > 0);
        const aliveEnemy = units.some(u => u.team === 'enemy' && u.hp > 0);
        if (!alivePlayer || !aliveEnemy) {
            winner = alivePlayer ? 'player' : 'enemy';
            frames.push(snapshot(units, shots));
            shots = [];
            break;
        }
    }
    if (!winner) winner = units.reduce((sum, unit) => sum + (unit.team === 'player' ? unit.hp : -unit.hp), 0) > 0 ? 'player' : 'enemy';
    return {winner, frames, survivors: units.filter(u => u.team === 'player').map(u => ({id: u.id, hp: Math.round(u.hp)}))};
}
function makeUnit(unit, team, upgrades = {}, battleUpgrades = {}) {
    const species = SPECIES[unit.species];
    const depth = Math.floor(unit.cell / 5);
    const lane = unit.cell % 5;
    const unitMax = team === 'player' ? maxHp(unit, upgrades) : Math.max(1, unit.hp);
    return {
        id: unit.id, team, species: unit.species, level: unit.level,
        x: team === 'player' ? 80 - depth * 90 : 880 + depth * 90,
        y: 82 + lane * 58,
        hp: Math.min(unitMax, unit.hp), maxHp: unitMax,
        speed: species.speed, range: species.range, damage: Math.round(species.damage * unitPower(unit) * (team === 'player' ? (1 + battleUpgrades.damage * 0.15) : 1)),
        trait: unit.trait ?? species.trait, poison: 0, receivedAttacks: 0,
        attackTime: species.cooldown * ((unit.trait ?? species.trait) === 'rapid' ? 0.82 : 1),
        cooldown: 0.2, stunned: 0, attacks: 0
    };
}
