import {DNA_TYPES, skillDefinitions, skillCost, getSkillLevel, isSkillVisible} from '../core/skills.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GROUPS = Object.freeze([
    {key: 'runner', label: 'Runner', currency: 'Urzeitkristalle'},
    ...Object.entries(DNA_TYPES).map(([key, value]) => ({key, label: value.label.replace('-DNA', ''), currency: value.label}))
]);
const create = (doc, tag, className, value) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
};
const addText = (parent, tag, className, value) => {
    const element = create(parent.ownerDocument, tag, className, value);
    parent.append(element);
    return element;
};
function edge(svg, from, to, completed) {
    const doc = svg.ownerDocument;
    const path = doc.createElementNS(SVG_NS, 'path');
    const x1 = from.x * 10, y1 = from.y * 7;
    const x2 = to.x * 10, y2 = to.y * 7;
    const cx = (x1 + x2) / 2 + (y2 - y1) * 0.1;
    const cy = (y1 + y2) / 2 - (x2 - x1) * 0.1;
    path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    path.setAttribute('class', 'dino-skill-branch' + (completed ? ' complete' : ''));
    svg.append(path);
}
export function renderSkillTree(dialog, game, selectedGroup, onBuy, onTab) {
    const doc = dialog.ownerDocument;
    dialog.replaceChildren();
    const top = create(doc, 'div', 'dino-skill-heading');
    addText(top, 'h3', '', 'Skillbaum');
    const close = create(doc, 'button', 'dino-skill-close', 'Schließen');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    top.append(close);
    dialog.append(top);
    addText(dialog, 'p', 'dino-skill-description', 'Die Baumkrone wächst: Neue Äste erscheinen erst, wenn du den vorherigen Skill vollständig verbessert hast.');
    const tabs = create(doc, 'div', 'dino-skill-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Skillbereich auswählen');
    for (const group of GROUPS) {
        const button = create(doc, 'button', selectedGroup === group.key ? 'active' : '', group.label);
        button.type = 'button';
        button.setAttribute('aria-pressed', String(selectedGroup === group.key));
        button.addEventListener('click', () => onTab(group.key));
        tabs.append(button);
    }
    dialog.append(tabs);
    const definitions = skillDefinitions(selectedGroup);
    const balance = selectedGroup === 'runner' ? game.meta.currency : game.meta.dna[selectedGroup];
    const currency = GROUPS.find(group => group.key === selectedGroup).currency;
    const summary = create(doc, 'div', 'dino-skill-balance');
    addText(summary, 'strong', '', `${balance} ${currency}`);
    addText(summary, 'span', '', selectedGroup === 'runner' ? 'Dauerhafte Verbesserungen für den Lauf'
        : 'DNA erhältst du, wenn du Dinos dieser Klasse in die Trashcan ziehst.');
    dialog.append(summary);
    const scroll = create(doc, 'div', 'dino-skill-scroll');
    const crown = create(doc, 'div', 'dino-skill-crown');
    crown.dataset.group = selectedGroup;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 700');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'dino-skill-lines');
    svg.setAttribute('aria-hidden', 'true');
    crown.append(svg);
    const root = create(doc, 'div', 'dino-skill-root', selectedGroup === 'runner' ? 'Runner' : GROUPS.find(group => group.key === selectedGroup).label);
    root.style.left = '50%';
    root.style.top = '54%';
    crown.append(root);
    for (const [key, definition] of Object.entries(definitions)) {
        if (!isSkillVisible(game.meta, selectedGroup, key)) continue;
        const parent = definition.requires.length ? definitions[definition.requires[0]] : {x: 50, y: 54};
        edge(svg, parent, definition, getSkillLevel(game.meta, selectedGroup, key) >= definition.maxLevel);
        const level = getSkillLevel(game.meta, selectedGroup, key);
        const maxed = level >= definition.maxLevel;
        const locked = definition.minStage && game.meta.highestStage < definition.minStage;
        const cost = maxed ? 0 : skillCost(selectedGroup, key, level);
        const button = create(doc, 'button', 'dino-skill-node' + (maxed ? ' maxed' : '') + (locked ? ' locked' : ''));
        button.type = 'button';
        button.style.left = definition.x + '%';
        button.style.top = definition.y + '%';
        button.disabled = maxed || locked || balance < cost;
        button.setAttribute('aria-label', `${definition.label}, Level ${level} von ${definition.maxLevel}`);
        addText(button, 'strong', '', definition.label);
        addText(button, 'span', '', definition.effect);
        addText(button, 'small', '', `Level ${level}/${definition.maxLevel}`);
        addText(button, 'em', '', maxed ? 'MAX' : locked ? 'Ab Stufe ' + definition.minStage : cost + ' ' + (selectedGroup === 'runner' ? 'Kristalle' : 'DNA'));
        button.addEventListener('click', () => onBuy(selectedGroup, key));
        crown.append(button);
    }
    scroll.append(crown);
    dialog.append(scroll);
    addText(dialog, 'p', 'dino-skill-footer', 'Alle gekauften Skills und DNA-Punkte bleiben über mehrere Durchläufe erhalten.');
}
