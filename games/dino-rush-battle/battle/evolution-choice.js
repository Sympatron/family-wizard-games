import {SPECIES, maxHp, unitPower} from '../core/game.js';

export function createEvolutionChoiceButton(doc, species, level, upgrades = {}, battleUpgrades = {}) {
    const definition = SPECIES[species];
    if (!definition) throw new Error('Unbekannte Dinoart.');
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'dino-merge-choice';
    button.style.setProperty('--dino-color', '#' + definition.color.toString(16).padStart(6, '0'));
    const image = doc.createElement('img');
    image.src = './assets/dinos/' + species + '.svg';
    image.alt = definition.name;
    image.width = 96;
    image.height = 76;
    const details = doc.createElement('span');
    details.className = 'dino-merge-details';
    const name = doc.createElement('strong');
    name.textContent = definition.name;
    const role = doc.createElement('span');
    role.className = 'dino-merge-role';
    role.textContent = 'Rang ' + definition.rank + ' · Tier ' + level + ' · Klasse: ' + definition.role;
    const stats = doc.createElement('span');
    stats.className = 'dino-merge-stats';
    const unit = {species, level};
    const damage = Math.round(definition.damage * unitPower(unit) * (1 + (battleUpgrades.damage ?? 0) * 0.15));
    stats.textContent = 'Leben ' + maxHp(unit, upgrades) + ' · Schaden ' + damage;
    details.append(name, role, stats);
    button.append(image, details);
    return button;
}
