import {SHOT_INTERVAL_SECONDS} from './shots.js';
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = Object.freeze({
    time: [['circle', {cx: 12, cy: 12, r: 9}], ['path', {d: 'M12 7v5l3.5 2.5'}]],
    hp: [['path', {d: 'M20.8 8.5c0 4.4-8.8 10.4-8.8 10.4S3.2 12.9 3.2 8.5c0-4.6 6.3-6.5 8.8-2.5 2.5-4 8.8-2.1 8.8 2.5Z'}]],
    damage: [
        ['path', {d: 'M20.5 2.5 13.1 3.6 6.5 13.3l4.3 4.2 9.5-6.7 0.2-8.3Z', fill: '#d6ecf7', stroke: '#607b89', 'stroke-width': 1.1}],
        ['path', {d: 'm5.1 13.9 5 5m-3.6-2.6-4.1 4.3m.8-4.4 4.7 4.7', stroke: '#ffcb82', 'stroke-width': 2.1}],
        ['path', {d: 'M3 3v3M1.5 4.5h3M7 1.5v2', stroke: '#ffcf76', 'stroke-width': 1.6}]
    ],
    fireRate: [['path', {d: 'M13 2 5 13h6l-1 9 9-12h-7l1-8Z'}]],
    bullets: [
        ['path', {d: 'M1.9 9 4.4 3.3 6.9 9V18.5H1.9Z', fill: '#e1b052', stroke: '#9e7633', 'stroke-width': 1}],
        ['path', {d: 'M9.5 7.6 12 2 14.5 7.6V18.5H9.5Z', fill: '#f2cb75', stroke: '#a57735', 'stroke-width': 1}],
        ['path', {d: 'M17.1 9 19.6 3.3 22.1 9V18.5H17.1Z', fill: '#e1b052', stroke: '#9e7633', 'stroke-width': 1}],
        ['path', {d: 'M1.9 15.5h5M9.5 15.5h5M17.1 15.5h5', stroke: '#fff0b2', 'stroke-width': 1.3}],
        ['path', {d: 'M2 19.2h4.8M9.5 19.2h5M17.2 19.2h4.8', stroke: '#79542d', 'stroke-width': 1.5}]
    ],
    pickupRange: [['path', {d: 'M5 4v10a7 7 0 0 0 14 0V4h-5v10a2 2 0 0 1-4 0V4H5Z'}]],
    coins: [['circle', {cx: 12, cy: 12, r: 10, fill: '#c68c32'}], ['circle', {cx: 12, cy: 12, r: 7.4, fill: '#f2c65a'}],
        ['path', {d: 'M12 6v12m3-9.5c-2.3-1.7-6-1-6 1.1 0 2.5 6 1 6 3.9 0 2.5-3.4 3-6 1.4', stroke: '#694317', 'stroke-width': 2}]]
});

function createIcon(doc, kind) {
    if (kind === 'dinos') {
        const image = doc.createElement('img');
        image.className = 'dino-runner-icon';
        image.src = './assets/dinos/raptor.svg';
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        return image;
    }
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'dino-runner-icon');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (const [tag, attributes] of ICONS[kind]) {
        const shape = doc.createElementNS(SVG_NS, tag);
        for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, String(value));
        svg.append(shape);
    }
    return svg;
}

export function createRunnerHud(doc) {
    const root = doc.createElement('div');
    root.className = 'dino-runner-stat-strip';
    const definitions = [
        ['time', 'Zeit', progress => progress.seconds + 's'],
        ['hp', 'Leben', progress => String(progress.hp)],
        ['dinos', 'Dinos', progress => String(progress.collected)],
        ['damage', 'Schaden pro Schussserie', progress => progress.temporary.damage.toFixed(1)],
        ['fireRate', 'Schussserien pro Sekunde', progress => (progress.temporary.fireRate / SHOT_INTERVAL_SECONDS).toFixed(1) + '/s'],
        ['bullets', 'Kugeln', progress => String(progress.temporary.bullets)],
        ['pickupRange', 'Magnet', progress => progress.temporary.pickupRange.toFixed(1)],
        ['coins', 'Münzen', progress => String(progress.coins ?? 0)]
    ];
    const counters = definitions.map(([kind, label, format]) => {
        const item = doc.createElement('span');
        item.className = 'dino-runner-stat dino-runner-stat-' + kind;
        item.title = label;
        if (kind === 'coins') item.id = 'runner-coin-counter';
        const value = doc.createElement('strong');
        value.textContent = '0';
        item.append(createIcon(doc, kind), value);
        root.append(item);
        return {item, label, format, value};
    });
    return {
        root, counter: counters.at(-1).item,
        update(progress) {
            for (const {item, label, format, value} of counters) {
                const display = format(progress);
                value.textContent = display;
                item.setAttribute('aria-label', label + ': ' + display);
            }
        }
    };
}
