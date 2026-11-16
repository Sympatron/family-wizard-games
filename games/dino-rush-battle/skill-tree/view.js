import {DNA_TYPES, PASSIVE_NAMES, skillDefinitions, skillCost, getSkillLevel, isSkillVisible} from '../core/skills.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TREE_WIDTH = 1600;
const TREE_HEIGHT = 1200;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.75;
const GROUPS = Object.freeze([
    {key: 'runner', label: 'Spieler', currency: 'Urzeitkristalle'},
    {key: 'tank', label: 'Tank', currency: DNA_TYPES.tank.label},
    {key: 'damageDealer', label: 'Damage Dealer', currency: DNA_TYPES.damageDealer.label},
    {key: 'sniper', label: 'Sniper', currency: DNA_TYPES.sniper.label}
]);
const POSITIONS = Object.freeze({
    runner: {root: [380, 275], damage: [250, 145], fireRate: [80, 90], bullets: [410, 70], magnet: [520, 210],
        spawn1: [155, 340], spawn2: [85, 480], spawn3: [280, 485], spawn4: [485, 440], lightning: [600, 90]},
    tank: {root: [1180, 270], damage: [985, 110], health: [1200, 80], speed: [1440, 150],
        regeneration: [1000, 385], range: [1460, 370], passive: [1230, 465]},
    damageDealer: {root: [355, 820], damage: [155, 655], health: [350, 620], speed: [565, 670],
        regeneration: [120, 1020], range: [575, 1010], passive: [360, 1110]},
    sniper: {root: [1220, 825], damage: [995, 650], health: [1190, 615], speed: [1460, 660],
        regeneration: [995, 1020], range: [1460, 1015], passive: [1225, 1110]}
});
const ICON_PATHS = Object.freeze({
    runner: ['polygon', '12,2 21,9 17,21 7,21 3,9'],
    tank: ['path', 'M12 2 21 6v7c0 5-4.5 8-9 9-4.5-1-9-4-9-9V6z'],
    damageDealer: ['path', 'M6 3 18 21M18 3 6 21M4 3l4 3m12-3-4 3M4 21l4-3m12 3-4-3'],
    sniper: ['path', 'M12 2v5m0 10v5M2 12h5m10 0h5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3v4']
});
let currentZoom = 0.68;
const clampZoom = value => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
const create = (doc, tag, className, value) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
};
function addText(parent, tag, className, value) {
    const child = create(parent.ownerDocument, tag, className, value);
    parent.append(child);
    return child;
}
function createIcon(doc, kind) {
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'dino-currency-icon ' + kind);
    svg.setAttribute('aria-hidden', 'true');
    const [tag, data] = ICON_PATHS[kind];
    const shape = doc.createElementNS(SVG_NS, tag);
    shape.setAttribute(tag === 'polygon' ? 'points' : 'd', data);
    shape.setAttribute('fill', tag === 'polygon' ? 'currentColor' : 'none');
    shape.setAttribute('stroke', 'currentColor');
    shape.setAttribute('stroke-width', '2');
    shape.setAttribute('stroke-linejoin', 'round');
    shape.setAttribute('stroke-linecap', 'round');
    svg.append(shape);
    return svg;
}
function edge(svg, from, to, unlocked) {
    const path = svg.ownerDocument.createElementNS(SVG_NS, 'path');
    const [x1, y1] = from, [x2, y2] = to;
    const cx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
    const cy = (y1 + y2) / 2 - (x2 - x1) * 0.12;
    path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    path.setAttribute('class', 'dino-skill-branch' + (unlocked ? ' complete' : ' sealed'));
    svg.append(path);
}
export function centerSkillTree(dialog, reset = false) {
    const viewport = dialog.querySelector('.dino-skill-scroll');
    if (!viewport) return;
    if (reset) {
        const fit = Math.min((viewport.clientWidth - 12) / TREE_WIDTH, (viewport.clientHeight - 12) / TREE_HEIGHT);
        viewport.setZoom(clampZoom(fit), [TREE_WIDTH / 2, TREE_HEIGHT / 2]);
    } else viewport.setZoom(currentZoom);
}
export function renderSkillTree(dialog, game, onBuy) {
    const doc = dialog.ownerDocument;
    const previous = dialog.querySelector('.dino-skill-scroll');
    const worldCenter = previous?.clientWidth
        ? [(previous.scrollLeft + previous.clientWidth / 2) / currentZoom, (previous.scrollTop + previous.clientHeight / 2) / currentZoom]
        : [TREE_WIDTH / 2, TREE_HEIGHT / 2];
    dialog.replaceChildren();
    const top = create(doc, 'header', 'dino-skill-heading');
    addText(top, 'h3', '', 'Skillbaum');
    const controls = create(doc, 'div', 'dino-skill-controls');
    const close = create(doc, 'button', 'dino-skill-close', 'Schließen');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    const wallet = create(doc, 'div', 'dino-skill-wallet');
    wallet.setAttribute('aria-label', 'Deine Währungen');
    for (const group of GROUPS) {
        const balance = group.key === 'runner' ? game.meta.currency : game.meta.dna[group.key];
        const item = create(doc, 'div', 'dino-skill-wallet-item ' + group.key);
        item.title = group.currency;
        item.setAttribute('aria-label', group.currency + ': ' + balance);
        item.append(createIcon(doc, group.key), addText(item, 'strong', '', balance));
        wallet.append(item);
    }
    const zoomLabel = create(doc, 'output', 'dino-skill-zoom-level');
    for (const [label, className, action] of [['−', 'dino-skill-zoom-out', -1], ['+', 'dino-skill-zoom-in', 1], ['Übersicht', 'dino-skill-fit', 0]]) {
        const button = create(doc, 'button', className, label);
        button.type = 'button';
        button.setAttribute('aria-label', action === 0 ? 'Gesamten Skillbaum anzeigen' : action > 0 ? 'Hineinzoomen' : 'Herauszoomen');
        button.dataset.zoomAction = String(action);
        controls.append(button);
    }
    controls.append(zoomLabel, close);
    top.append(wallet, controls);
    dialog.append(top);
    addText(dialog, 'p', 'dino-skill-description', 'Vier Basen, eine Baumkrone. Gesperrte Knoten bleiben verborgen, bis du ihre Vorgänger maximierst. Zoomen: +/−, Strg + Mausrad oder zwei Finger.');
    const viewport = create(doc, 'div', 'dino-skill-scroll');
    viewport.setAttribute('aria-label', 'Zoombare Skillbaum-Übersicht');
    const canvas = create(doc, 'div', 'dino-skill-canvas');
    const crown = create(doc, 'div', 'dino-skill-crown');
    crown.style.width = TREE_WIDTH + 'px';
    crown.style.height = TREE_HEIGHT + 'px';
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${TREE_WIDTH} ${TREE_HEIGHT}`);
    svg.setAttribute('class', 'dino-skill-lines');
    svg.setAttribute('aria-hidden', 'true');
    crown.append(svg);
    for (const group of GROUPS) {
        const positions = POSITIONS[group.key];
        const root = create(doc, 'div', 'dino-skill-root ' + group.key, group.label);
        root.style.left = positions.root[0] + 'px';
        root.style.top = positions.root[1] + 'px';
        crown.append(root);
        const definitions = skillDefinitions(group.key);
        const balance = group.key === 'runner' ? game.meta.currency : game.meta.dna[group.key];
        for (const [key, definition] of Object.entries(definitions)) {
            const visible = isSkillVisible(game.meta, group.key, key);
            const level = getSkillLevel(game.meta, group.key, key);
            const maxed = level >= definition.maxLevel;
            const levelLock = definition.minStage && game.meta.highestStage < definition.minStage;
            const node = create(doc, 'button', 'dino-skill-node ' + group.key + (visible ? '' : ' sealed') + (maxed ? ' maxed' : '') + (levelLock && visible ? ' level-locked' : ''));
            node.type = 'button';
            node.style.left = positions[key][0] + 'px';
            node.style.top = positions[key][1] + 'px';
            node.disabled = !visible || maxed || !!levelLock || balance < skillCostIfNeeded(group.key, key, level, maxed);
            if (!visible) {
                node.setAttribute('aria-label', 'Unbekannte Verbesserung – gesperrt');
                node.append(addText(node, 'span', 'dino-skill-chains', '⛓'), addText(node, 'span', 'dino-skill-lock', '🔒'));
            } else {
                const title = key === 'passive' ? PASSIVE_NAMES[group.key] : definition.label;
                node.setAttribute('aria-label', `${title}, Level ${level} von ${definition.maxLevel}`);
                addText(node, 'strong', '', title);
                addText(node, 'span', '', key === 'passive' ? passiveDescription(group.key, level) : definition.effect);
                addText(node, 'small', '', `Level ${level}/${definition.maxLevel}`);
                const cost = create(doc, 'em', 'dino-skill-price');
                if (maxed) cost.textContent = 'MAX';
                else if (levelLock) cost.textContent = 'Ab Stufe ' + definition.minStage;
                else cost.append(createIcon(doc, group.key), doc.createTextNode(String(skillCost(group.key, key, level))));
                node.append(cost);
                node.addEventListener('click', () => onBuy(group.key, key));
            }
            crown.append(node);
            for (const parent of definition.requires) edge(svg, positions[parent], positions[key], visible);
            if (!definition.requires.length) edge(svg, positions.root, positions[key], true);
        }
    }
    canvas.append(crown);
    viewport.append(canvas);
    dialog.append(viewport);
    const footer = addText(dialog, 'p', 'dino-skill-footer', 'Skills und DNA bleiben dauerhaft erhalten. Dinosaurierfähigkeiten wirken automatisch; der Spieler kann Blitz im Kampf aktiv einsetzen.');
    footer.setAttribute('aria-live', 'polite');
    function setZoom(next, focus = null) {
        const oldZoom = currentZoom;
        const center = focus ?? [(viewport.scrollLeft + viewport.clientWidth / 2) / oldZoom, (viewport.scrollTop + viewport.clientHeight / 2) / oldZoom];
        currentZoom = clampZoom(next);
        canvas.style.width = TREE_WIDTH * currentZoom + 'px';
        canvas.style.height = TREE_HEIGHT * currentZoom + 'px';
        crown.style.transform = `scale(${currentZoom})`;
        zoomLabel.textContent = Math.round(currentZoom * 100) + ' %';
        viewport.scrollLeft = Math.max(0, center[0] * currentZoom - viewport.clientWidth / 2);
        viewport.scrollTop = Math.max(0, center[1] * currentZoom - viewport.clientHeight / 2);
    }
    viewport.setZoom = setZoom;
    setZoom(currentZoom, worldCenter);
    controls.addEventListener('click', event => {
        const button = event.target.closest('button[data-zoom-action]');
        if (!button) return;
        const direction = Number(button.dataset.zoomAction);
        if (direction) setZoom(currentZoom + direction * 0.15);
        else centerSkillTree(dialog, true);
    });
    viewport.addEventListener('wheel', event => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        setZoom(currentZoom * (event.deltaY < 0 ? 1.1 : 0.9));
    }, {passive: false});
    let pinchDistance = null;
    viewport.addEventListener('touchstart', event => {
        if (event.touches.length === 2) pinchDistance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
    }, {passive: true});
    viewport.addEventListener('touchmove', event => {
        if (event.touches.length !== 2 || !pinchDistance) return;
        const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
        setZoom(currentZoom * distance / pinchDistance);
        pinchDistance = distance;
        event.preventDefault();
    }, {passive: false});
    viewport.addEventListener('touchend', event => { if (event.touches.length < 2) pinchDistance = null; });
}
function skillCostIfNeeded(group, key, level, maxed) { return maxed ? 0 : skillCost(group, key, level); }
function passiveDescription(group, level) {
    if (group === 'tank') return 'Heilender Panzerwall mit Cooldown';
    if (group === 'damageDealer') return 'Periodischer Schadensstoß';
    return 'Verstärkter Präzisionsschuss';
}
