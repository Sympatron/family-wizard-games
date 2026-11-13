const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = Object.freeze({
    time: [['circle', {cx: 12, cy: 12, r: 9}], ['path', {d: 'M12 7v5l3.5 2.5'}]],
    hp: [['path', {d: 'M20.8 8.5c0 4.4-8.8 10.4-8.8 10.4S3.2 12.9 3.2 8.5c0-4.6 6.3-6.5 8.8-2.5 2.5-4 8.8-2.1 8.8 2.5Z'}]],
    dinos: [['path', {d: 'M5 20v-4l3-2 2-5 3-3 3-1 3 2-1 4-4 1-2 4 1 4M7 17l-4-1M14 12l5 4 2-1'}],
        ['circle', {cx: 16, cy: 8, r: 1, fill: 'currentColor', stroke: 'none'}]],
    damage: [['path', {d: 'M5 3l13 13m-3-13L4 14m0-7 3-3m10 10 3 3M4 20l5-5m6 0 5 5'}]],
    fireRate: [['path', {d: 'M13 2 5 13h6l-1 9 9-12h-7l1-8Z'}]],
    bullets: [['path', {d: 'M5 4v5m7-5v5m7-5v5M3 12h4v8H3zM10 12h4v8h-4zM17 12h4v8h-4z'}]],
    pickupRange: [['path', {d: 'M5 4v10a7 7 0 0 0 14 0V4h-5v10a2 2 0 0 1-4 0V4H5Z'}]],
    coins: [['circle', {cx: 12, cy: 12, r: 10, fill: '#c68c32'}], ['circle', {cx: 12, cy: 12, r: 7.4, fill: '#f2c65a'}],
        ['path', {d: 'M12 6v12m3-9.5c-2.3-1.7-6-1-6 1.1 0 2.5 6 1 6 3.9 0 2.5-3.4 3-6 1.4', stroke: '#694317', 'stroke-width': 2}]]
});

function createIcon(doc, kind) {
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
        ['damage', 'Schaden', progress => '×' + progress.temporary.damage.toFixed(1)],
        ['fireRate', 'Tempo', progress => '×' + progress.temporary.fireRate.toFixed(1)],
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
