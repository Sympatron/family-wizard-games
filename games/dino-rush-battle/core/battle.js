import {SPECIES, maxHp, unitPower} from './game.js';
import {dnaTypeForDino, lightningCooldown, lightningDamage} from './skills.js';

const TICK = 0.1;
export const BATTLE_FRAME_SECONDS = 0.2;
const MAX_STEPS = 900;
const ATTACK_DELAY_FACTOR = 1.2;
const DAMAGE_FACTOR = 0.86;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const snapshot = (units, shots = [], effects = []) => {
    const frame = units.map(u => ({id: u.id, team: u.team, species: u.species, level: u.level, x: u.x, y: u.y, hp: Math.max(0, u.hp), maxHp: u.maxHp, stunned: u.stunned > 0}));
    frame.shots = shots;
    frame.effects = effects;
    return frame;
};
function castLightning(units, level, effects) {
    const enemies = units.filter(unit => unit.team === 'enemy' && unit.hp > 0);
    if (!enemies.length || level <= 0) return;
    const target = enemies.reduce((best, unit) => {
        const nearby = enemies.filter(other => distance(other, unit) <= 210).length;
        return nearby > best.nearby ? {unit, nearby} : best;
    }, {unit: enemies[0], nearby: 0}).unit;
    const radius = 210 + level * 12;
    const damage = lightningDamage(level);
    for (const enemy of enemies) {
        if (distance(enemy, target) <= radius) enemy.hp = Math.max(0, enemy.hp - damage);
    }
    effects.push({type: 'lightning', x: target.x, y: target.y, radius, damage});
}
function validLightningFrames(casts, level) {
    const frames = new Set();
    if (!level) return frames;
    const cooldownFrames = Math.ceil(lightningCooldown(level) / BATTLE_FRAME_SECONDS);
    let previous = -Infinity;
    for (const cast of [...casts].sort((a, b) => a.frame - b.frame)) {
        if (cast.ability !== 'lightning' || !Number.isInteger(cast.frame) || cast.frame < 1 || cast.frame - previous < cooldownFrames) continue;
        frames.add(cast.frame);
        previous = cast.frame;
    }
    return frames;
}
export function simulateBattle(army, enemies, upgrades = {}, battleUpgrades = {}, skills = {}, playerCasts = []) {
    const units = [...army.map(unit => makeUnit(unit, 'player', upgrades, battleUpgrades, skills)), ...enemies.map(unit => makeUnit(unit, 'enemy'))];
    const frames = [snapshot(units)];
    const teamSupport = Object.fromEntries(['player', 'enemy'].map(team => [
        team, Math.min(0.16, units.filter(unit => unit.team === team && unit.trait === 'support').length * 0.04)
    ]));
    const lightningLevel = skills.runner?.lightning ?? 0;
    const scheduledLightning = validLightningFrames(playerCasts, lightningLevel);
    let shots = [], effects = [];
    let winner = null;
    for (let step = 0; step < MAX_STEPS; step++) {
        if (step % 2 === 0 && scheduledLightning.has(Math.floor(step / 2) + 1)) castLightning(units, lightningLevel, effects);
        for (const unit of units) {
            if (unit.hp <= 0) continue;
            unit.cooldown = Math.max(0, unit.cooldown - TICK);
            unit.passiveCooldown = Math.max(0, unit.passiveCooldown - TICK);
            unit.stunned = Math.max(0, unit.stunned - TICK);
            if (unit.poison > 0) {
                unit.poison = Math.max(0, unit.poison - TICK);
                unit.hp = Math.max(0, unit.hp - 1.8 * TICK);
                if (unit.hp <= 0) continue;
            }
            if (unit.stunned > 0) continue;
            if (unit.team === 'player' && unit.passiveKind === 'tank' && unit.passiveLevel > 0 && unit.passiveCooldown <= 0 && unit.hp < unit.maxHp) {
                unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * (0.04 + unit.passiveLevel * 0.025)));
                unit.passiveCooldown = Math.max(5, 9 - unit.passiveLevel * 0.6);
                effects.push({type: 'shield', x: unit.x, y: unit.y});
            }
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
                let damage = unit.damage * DAMAGE_FACTOR * (1 + teamSupport[unit.team]);
                if (unit.trait === 'burst' && unit.attacks % 3 === 0) damage *= 1.45;
                if (target.trait === 'armor') damage *= 0.78;
                if (target.trait === 'evasion' && target.receivedAttacks % 6 === 0) damage = 0;
                if (unit.team === 'player' && unit.passiveLevel > 0 && unit.passiveCooldown <= 0) {
                    if (unit.passiveKind === 'damageDealer') {
                        damage *= 1 + unit.passiveLevel * 0.24;
                        unit.passiveCooldown = Math.max(5, 9 - unit.passiveLevel * 0.7);
                        effects.push({type: 'rage', x: unit.x, y: unit.y});
                    } else if (unit.passiveKind === 'sniper') {
                        damage *= 1 + unit.passiveLevel * 0.3;
                        unit.passiveCooldown = Math.max(5, 10 - unit.passiveLevel * 0.7);
                        effects.push({type: 'precision', x: target.x, y: target.y});
                    }
                }
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
            frames.push(snapshot(units, shots, effects));
            shots = [];
            effects = [];
        }
        const alivePlayer = units.some(u => u.team === 'player' && u.hp > 0);
        const aliveEnemy = units.some(u => u.team === 'enemy' && u.hp > 0);
        if (!alivePlayer || !aliveEnemy) {
            winner = alivePlayer ? 'player' : 'enemy';
            frames.push(snapshot(units, shots, effects));
            break;
        }
    }
    if (!winner) winner = units.reduce((sum, unit) => sum + (unit.team === 'player' ? unit.hp : -unit.hp), 0) > 0 ? 'player' : 'enemy';
    return {winner, frames, survivors: units.filter(u => u.team === 'player').map(u => ({id: u.id, hp: Math.round(u.hp)}))};
}
function makeUnit(unit, team, upgrades = {}, battleUpgrades = {}, skills = {}) {
    const species = SPECIES[unit.species];
    const depth = Math.floor(unit.cell / 5);
    const lane = unit.cell % 5;
    const unitMax = team === 'player' ? maxHp(unit, upgrades, skills) : Math.max(1, unit.hp);
    const passiveKind = dnaTypeForDino(unit);
    const bonuses = team === 'player' ? skills[passiveKind] ?? {} : {};
    return {
        id: unit.id, team, species: unit.species, level: unit.level,
        x: team === 'player' ? 80 - depth * 90 : 880 + depth * 90,
        y: 82 + lane * 58,
        hp: Math.min(unitMax, unit.hp), maxHp: unitMax,
        speed: species.speed * (1 + (bonuses.speed ?? 0) * 0.04), range: species.range * (1 + (bonuses.range ?? 0) * 0.05),
        damage: Math.round(species.damage * unitPower(unit) * (team === 'player' ? (1 + battleUpgrades.damage * 0.15) * (1 + (bonuses.damage ?? 0) * 0.06) : 1)),
        trait: unit.trait ?? species.trait, poison: 0, receivedAttacks: 0,
        attackTime: species.cooldown * ATTACK_DELAY_FACTOR * ((unit.trait ?? species.trait) === 'rapid' ? 0.82 : 1),
        cooldown: 0.2, stunned: 0, attacks: 0, passiveKind, passiveLevel: bonuses.passive ?? 0, passiveCooldown: 2.5
    };
}
