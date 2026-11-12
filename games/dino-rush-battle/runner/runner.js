import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';

const DURATION = 70;
const SPECIES = ['raptor', 'triceratops', 'pteranodon'];
const GATE_KINDS = ['damage', 'fireRate', 'bullets'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function startRunner(host, {stage, upgrades = {}, onProgress, onFinish}) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x142734);
    scene.fog = new THREE.Fog(0x142734, 50, 150);
    const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 250);
    camera.position.set(0, 8, 23);
    camera.lookAt(0, 1, -17);
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    host.replaceChildren(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd6f7ff, 0x354b39, 2.2));
    const sunlight = new THREE.DirectionalLight(0xffe6bd, 2.2);
    sunlight.position.set(-8, 18, 5);
    scene.add(sunlight);
    const material = color => new THREE.MeshStandardMaterial({color, roughness: 0.75});
    function box(width, height, depth, color, x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
    }
    box(8.7, 0.2, 230, 0x395a46, 0, -0.18, -49);
    box(0.25, 1, 230, 0x86b177, -4.5, 0.3, -49);
    box(0.25, 1, 230, 0x86b177, 4.5, 0.3, -49);
    const markings = Array.from({length: 16}, (_, i) => box(0.12, 0.015, 4.2, 0xb5d4a1, 0, 0.01, 12 - i * 9));
    const player = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 4, 8), material(0xf5c768));
    body.position.y = 1.1;
    player.add(body);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.75, 6), material(0xc26b4b));
    crest.position.set(0, 2.2, -0.1);
    player.add(crest);
    scene.add(player);
    player.position.set(0, 0, 8);

    const objects = [];
    const bullets = [];
    const collected = [];
    const temporary = {damage: 1 + (upgrades.runnerDamage ?? 0) * 0.12, fireRate: 1, bullets: 1};
    let remaining = DURATION;
    let elapsed = 0;
    let playerHp = 3;
    let shots = 0;
    let kills = 0;
    let spawnCount = 0;
    let nextSpawn = 1;
    let nextGate = 9;
    let shotTimer = 0;
    let reportTimer = 0;
    let targetX = 0;
    let active = true;
    let dragging = false;
    let frame = 0;
    let previous = performance.now();
    const keys = new Set();

    function label(text, color = '#f4f8dd') {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 96);
        ctx.fillStyle = '#142734cf';
        ctx.fillRect(0, 9, 256, 78);
        ctx.strokeStyle = '#99c4a5';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 11, 252, 74);
        ctx.fillStyle = color;
        ctx.font = 'bold 33px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 61);
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true}));
        sprite.scale.set(3.3, 1.3, 1);
        sprite.position.y = 4.2;
        return sprite;
    }
    function gateText(obj) {
        const name = obj.modifier === 'damage' ? 'SCHADEN' : obj.modifier === 'fireRate' ? 'TEMPO' : 'KUGELN';
        return name + ' ' + (obj.level > 0 ? '+' : '') + obj.level;
    }
    function updateGate(obj) {
        obj.mesh.material.color.setHex(obj.level > 0 ? 0x5bc8c0 : obj.level < 0 ? 0xe57366 : 0xc0b66b);
        const old = obj.label;
        if (old) {
            obj.group.remove(old);
            old.material.map.dispose();
            old.material.dispose();
        }
        obj.label = label(gateText(obj));
        obj.group.add(obj.label);
    }
    function spawnGatePair() {
        const modifier = GATE_KINDS[Math.floor(stage + elapsed / 18) % GATE_KINDS.length];
        for (const [x, level] of [[-2.15, -2], [2.15, 1]]) {
            const group = new THREE.Group();
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 0.35), material(0xcccccc));
            mesh.position.y = 1.85;
            group.add(mesh);
            group.position.set(x, 0, -95);
            scene.add(group);
            const obj = {kind: 'gate', x, z: -95, level, modifier, charge: 0, mesh, group, label: null, resolved: false};
            updateGate(obj);
            objects.push(obj);
        }
    }
    function spawnEnemyOrCage() {
        const isCage = spawnCount % 3 !== 1;
        const x = [-2.6, 0, 2.6][(spawnCount + stage) % 3];
        const group = new THREE.Group();
        const color = isCage ? 0xeac472 : 0xeb745e;
        const outer = new THREE.Mesh(new THREE.BoxGeometry(isCage ? 1.9 : 1.4, isCage ? 2.0 : 1.5, 1.6), material(color));
        outer.position.y = 1.1;
        outer.material.wireframe = isCage;
        group.add(outer);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), material(isCage ? 0x77d7ad : 0xa84648));
        inner.position.y = 1.15;
        group.add(inner);
        group.position.set(x, 0, -100);
        scene.add(group);
        const species = SPECIES[(spawnCount + Math.floor(stage / 2)) % SPECIES.length];
        objects.push({kind: isCage ? 'cage' : 'enemy', x, z: -100, hp: isCage ? 3 : 2 + Math.floor(stage / 3), species, group});
        spawnCount++;
    }
    function disposeGroup(group) {
        scene.remove(group);
        group.traverse(node => {
            node.geometry?.dispose();
            const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
            for (const m of materials) {
                m.map?.dispose();
                m.dispose();
            }
        });
    }
    function removeObject(obj) {
        const i = objects.indexOf(obj);
        if (i >= 0) objects.splice(i, 1);
        disposeGroup(obj.group);
    }
    function shoot() {
        const count = Math.min(5, temporary.bullets);
        for (let i = 0; i < count; i++) {
            const x = player.position.x + (i - (count - 1) / 2) * 0.4;
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), material(0xffef9c));
            mesh.position.set(x, 1.35, 6);
            scene.add(mesh);
            bullets.push({mesh, x, z: 6});
        }
        shots++;
    }
    function applyGate(obj) {
        if (obj.level < 0) {
            if (obj.modifier === 'bullets') temporary.bullets = Math.max(1, temporary.bullets + obj.level);
            else temporary[obj.modifier] = Math.max(0.35, temporary[obj.modifier] + obj.level * 0.3);
        } else if (obj.modifier === 'bullets') temporary.bullets = Math.min(5, temporary.bullets + obj.level);
        else temporary[obj.modifier] = Math.min(5, temporary[obj.modifier] + obj.level * 0.35);
    }
    function collideBullet(bullet, previousZ) {
        for (const obj of objects) {
            if (obj.resolved || Math.abs(bullet.x - obj.x) > (obj.kind === 'gate' ? 1.35 : 1.1)) continue;
            if (obj.z < bullet.z - 1.25 || obj.z > previousZ + 1.25) continue;
            if (obj.kind === 'gate') {
                obj.charge++;
                if (obj.charge >= 3) {
                    obj.charge = 0;
                    obj.level = Math.min(3, obj.level + 1);
                    updateGate(obj);
                }
            } else {
                obj.hp -= temporary.damage;
                if (obj.hp <= 0) {
                    if (obj.kind === 'cage') collected.push(obj.species);
                    else kills++;
                    removeObject(obj);
                }
            }
            return true;
        }
        return false;
    }
    function finish() {
        if (!active) return;
        active = false;
        destroy();
        onFinish({collected, temporary, kills, shots});
    }
    function animate(time) {
        if (!active) return;
        const dt = Math.min(0.05, (time - previous) / 1000);
        previous = time;
        elapsed += dt;
        remaining = Math.max(0, DURATION - elapsed);
        if (keys.has('ArrowLeft') || keys.has('KeyA')) targetX -= dt * 6.2;
        if (keys.has('ArrowRight') || keys.has('KeyD')) targetX += dt * 6.2;
        targetX = clamp(targetX, -3.4, 3.4);
        player.position.x = THREE.MathUtils.damp(player.position.x, targetX, 14, dt);
        player.rotation.z = (player.position.x - targetX) * 0.07;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, player.position.x * 0.3, 2.5, dt);
        shotTimer -= dt;
        if (shotTimer <= 0) {
            shoot();
            shotTimer += 0.28 / temporary.fireRate;
        }
        if (elapsed >= nextSpawn) {
            spawnEnemyOrCage();
            nextSpawn += 3.1;
        }
        if (elapsed >= nextGate) {
            spawnGatePair();
            nextGate += 18;
        }
        const speed = 12.5 + stage * 0.4;
        for (const marking of markings) {
            marking.position.z += speed * dt;
            if (marking.position.z > 18) marking.position.z -= 144;
        }
        for (const obj of [...objects]) {
            obj.z += speed * dt;
            obj.group.position.z = obj.z;
            if (obj.z > 8) {
                if (obj.kind === 'gate') {
                    if (Math.abs(player.position.x - obj.x) < 1.25) applyGate(obj);
                    for (const gate of [...objects].filter(item => item.kind === 'gate' && Math.abs(item.z - obj.z) < 2)) removeObject(gate);
                } else {
                    if (obj.kind === 'enemy' && Math.abs(obj.x - player.position.x) < 1.1) playerHp--;
                    removeObject(obj);
                }
            }
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const oldZ = bullet.z;
            bullet.z -= 48 * dt;
            bullet.mesh.position.z = bullet.z;
            if (bullet.z < -125 || collideBullet(bullet, oldZ)) {
                bullets.splice(i, 1);
                scene.remove(bullet.mesh);
                bullet.mesh.geometry.dispose();
                bullet.mesh.material.dispose();
            }
        }
        reportTimer -= dt;
        if (reportTimer <= 0) {
            onProgress({seconds: Math.ceil(remaining), collected: collected.length, hp: Math.max(0, playerHp), temporary});
            reportTimer = 0.25;
        }
        renderer.render(scene, camera);
        if (remaining <= 0 || playerHp <= 0) finish();
        else frame = requestAnimationFrame(animate);
    }
    function setPointer(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        targetX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 8, -3.4, 3.4);
    }
    function pointerDown(event) {
        dragging = true;
        renderer.domElement.setPointerCapture(event.pointerId);
        setPointer(event);
    }
    function pointerMove(event) {
        if (dragging) setPointer(event);
    }
    function pointerUp() { dragging = false; }
    function keyDown(event) {
        if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
            event.preventDefault();
            keys.add(event.code);
        }
    }
    function keyUp(event) { keys.delete(event.code); }
    function resize() {
        const width = host.clientWidth, height = host.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    frame = requestAnimationFrame(animate);
    function destroy() {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('pointerdown', pointerDown);
        renderer.domElement.removeEventListener('pointermove', pointerMove);
        renderer.domElement.removeEventListener('pointerup', pointerUp);
        renderer.domElement.removeEventListener('pointercancel', pointerUp);
        window.removeEventListener('keydown', keyDown);
        window.removeEventListener('keyup', keyUp);
        for (const obj of [...objects]) removeObject(obj);
        for (const bullet of bullets) {
            scene.remove(bullet.mesh);
            bullet.mesh.geometry.dispose();
            bullet.mesh.material.dispose();
        }
        scene.traverse(node => {
            node.geometry?.dispose();
            const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
            for (const m of materials) m.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
    }
    return {destroy: () => { if (active) { active = false; destroy(); } }};
}
