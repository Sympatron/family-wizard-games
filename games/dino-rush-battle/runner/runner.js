import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';
import {SPECIES as DINOSAURS} from '../core/game.js';
import {createGatePair, gateLabel, improveGate, applyGate} from './gates.js';
import {createRanger} from './ranger.js';
import {runnerCameraSettings} from './camera.js';
import {createRunnerWave} from './spawns.js';
import {bulletHitsCage} from './collision.js';

const DURATION = 35;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function startRunner(host, {stage, upgrades = {}, onProgress, onFinish}) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x142734);
    scene.fog = new THREE.Fog(0x142734, 85, 260);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 340);
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer:coarse)').matches ? 1.5 : 2));
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
    function dinosaur(species, color) {
        const result = new THREE.Group();
        const skin = material(color);
        const belly = material(0xe9ca9f);
        const eyes = material(0x192333);
        const detail = material(0x415569);
        function piece(geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.position.set(x, y, z);
            mesh.scale.set(sx, sy, sz);
            result.add(mesh);
            return mesh;
        }
        const sphere = (radius, mat, x, y, z, sx = 1, sy = 1, sz = 1) =>
            piece(new THREE.SphereGeometry(radius, 10, 8), mat, x, y, z, sx, sy, sz);
        sphere(0.69, skin, 0, 1.35, 0.1, 1, 0.75, 1.3);
        sphere(0.48, skin, 0, 1.95, -0.66);
        sphere(0.39, belly, 0, 1.69, -1.0, 0.9, 0.5, 1.2);
        for (const side of [-1, 1]) {
            sphere(0.13, eyes, side * 0.36, 2.09, -0.91);
            const leg = piece(new THREE.CylinderGeometry(0.17, 0.27, 0.95, 7), skin, side * 0.45, 0.55, 0.33);
            (result.userData.legs ??= []).push(leg);
            sphere(0.23, skin, side * 0.46, 0.13, -0.03, 0.8, 0.45, 1.3);
            sphere(0.16, skin, side * 0.58, 1.39, -0.78, 0.65, 1.1, 0.65);
        }
        const tail = piece(new THREE.ConeGeometry(0.42, 2.1, 8), skin, 0, 1.32, 1.36);
        tail.rotation.x = Math.PI / 2;
        if (species === 'triceratops') {
            for (const side of [-1, 1]) {
                const horn = piece(new THREE.ConeGeometry(0.14, 0.75, 7), belly, side * 0.34, 2.35, -1.02);
                horn.rotation.x = -0.35;
            }
            sphere(0.57, skin, 0, 2.2, -0.38, 1.25, 0.7, 0.36);
        } else if (species === 'pteranodon') {
            for (const side of [-1, 1]) {
                const wing = piece(new THREE.ConeGeometry(0.64, 2.2, 5), skin, side * 1.01, 1.64, 0.2);
                wing.rotation.z = side * Math.PI / 2;
            }
            const beak = piece(new THREE.ConeGeometry(0.22, 0.95, 5), belly, 0, 1.89, -1.27);
            beak.rotation.x = -Math.PI / 2;
        } else {
            for (let i = 0; i < 3; i++) {
                const spine = piece(new THREE.ConeGeometry(0.18, 0.55, 5), detail, 0, 1.98, 0.2 + i * 0.5);
                spine.rotation.x = -0.2;
            }
        }
        result.userData.skin = skin;
        return result;
    }
    box(13, 0.2, 540, 0x395a46, 0, -0.18, -240);
    box(0.3, 0.8, 540, 0x86b177, -6.65, 0.3, -240);
    box(0.3, 0.8, 540, 0x86b177, 6.65, 0.3, -240);
    const markings = Array.from({length: 40}, (_, i) => box(0.18, 0.02, 3.8, 0xb5d4a1, 0, 0.01, 12 - i * 8));
    const scenery = [];
    for (let i = 0; i < 84; i++) {
        const decoration = new THREE.Group();
        const side = i % 2 ? 1 : -1;
        const x = side * (8.4 + (i % 4) * 2.2);
        const z = 16 - Math.floor(i / 2) * 7;
        if (i % 5 === 0) {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + i % 3 * 0.3), material(0x7f9991));
            rock.scale.y = 0.6;
            rock.position.y = 0.6;
            decoration.add(rock);
        } else {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 6), material(0x806044));
            trunk.position.y = 1.3;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.3 + i % 3 * 0.18, 3.8, 7), material(i % 3 ? 0x3e865d : 0x569a68));
            leaves.position.y = 4.2;
            decoration.add(trunk, leaves);
        }
        decoration.position.set(x, 0, z);
        scene.add(decoration);
        scenery.push(decoration);
    }
    const player = createRanger(THREE);
    scene.add(player);
    player.position.set(0, 0, 8);

    const objects = [];
    const bullets = [];
    const collected = [];
    const followers = [];
    const followerOffsets = [-1.5, 1.5, -3.1, 0, 3.1];
    function collectDinosaur(species) {
        collected.push(species);
        if (followers.length >= 15) return;
        const follower = dinosaur(species, DINOSAURS[species].color);
        follower.scale.setScalar(0.42);
        follower.position.set(player.position.x, 0, 9.4);
        scene.add(follower);
        followers.push(follower);
    }
    const temporary = {damage: 1 + (upgrades.runnerDamage ?? 0) * 0.12, fireRate: 1, bullets: 1};
    let remaining = DURATION;
    let elapsed = 0;
    let playerHp = 3;
    let shots = 0;
    let kills = 0;
    let spawnCount = 0;
    let nextSpawn = 0.5;
    let nextGate = 4.2;
    let gateCount = 0;
    let shotTimer = 0;
    let reportTimer = 0;
    let targetX = 0;
    let active = true;
    let dragging = false;
    let frame = 0;
    let previous = performance.now();
    const keys = new Set();
    let hurtFlash = 0;

    function gateText(text, y, width, height, fontSize, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.font = '900 ' + fontSize + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 13;
        ctx.strokeStyle = '#17252b';
        ctx.strokeText(text, 512, 136, 970);
        ctx.fillStyle = color;
        ctx.fillText(text, 512, 136, 970);
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true}));
        sprite.scale.set(width, height, 1);
        sprite.position.set(0, y, 0.35);
        return sprite;
    }
    function updateGate(obj) {
        const positive = obj.level > 0;
        const color = positive ? 0x5bc8c0 : obj.level < 0 ? 0xe57366 : 0xd5c774;
        obj.mesh.material.color.setHex(color);
        obj.header.material.color.setHex(positive ? 0x256d68 : obj.level < 0 ? 0x873c35 : 0x777044);
        if (obj.label) {
            obj.group.remove(obj.label);
            obj.label.traverse(node => {
                node.material?.map?.dispose();
                node.material?.dispose();
            });
        }
        const [type, value] = gateLabel(obj).split(' ');
        const label = new THREE.Group();
        label.add(gateText(type, 4.55, 5.8, 0.8, 126, '#ffffff'));
        label.add(gateText(value, 2.15, 5.75, 2.55, 210, '#fff3a0'));
        obj.label = label;
        obj.group.add(label);
    }
    function spawnGatePair() {
        for (const [index, definition] of createGatePair(stage, gateCount++).entries()) {
            const x = index === 0 ? -3.2 : 3.2;
            const group = new THREE.Group();
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 4.1), new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide
            }));
            mesh.position.y = 2.05;
            group.add(mesh);
            const header = new THREE.Mesh(new THREE.BoxGeometry(6.12, 0.95, 0.42), material(0x647d79));
            header.position.y = 4.55;
            group.add(header);
            for (const side of [-1, 1]) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 4.1, 0.2), material(0xaac7bf));
                post.position.set(side * 3.03, 2.05, 0.04);
                group.add(post);
            }
            group.position.set(x, 0, -80);
            scene.add(group);
            const obj = {...definition, kind: 'gate', x, z: -80, charge: 0, mesh, header, group, label: null};
            updateGate(obj);
            objects.push(obj);
        }
    }
    function cage(species) {
        const group = new THREE.Group();
        const frame = material(0x6a5843);
        const iron = new THREE.MeshStandardMaterial({color: 0xc3d2cd, metalness: 0.65, roughness: 0.35});
        const lock = new THREE.MeshStandardMaterial({color: 0xf1d277, metalness: 0.55, roughness: 0.3});
        function bar(width, height, depth, x, y, z, mat = iron) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
            mesh.position.set(x, y, z);
            group.add(mesh);
            return mesh;
        }
        const creature = dinosaur(species, DINOSAURS[species].color);
        creature.scale.setScalar(0.68);
        creature.rotation.y = Math.PI;
        group.add(creature);
        bar(2.85, 0.3, 2.85, 0, 0.1, 0, frame);
        bar(2.85, 0.26, 2.85, 0, 3.05, 0, frame);
        for (const x of [-1.36, 1.36]) {
            for (const z of [-1.36, 1.36]) bar(0.18, 3.05, 0.18, x, 1.6, z, frame);
        }
        for (const z of [-1.36, 1.36]) {
            for (const x of [-1.01, -0.67, -0.33, 0, 0.33, 0.67, 1.01]) bar(0.065, 2.8, 0.08, x, 1.59, z);
            bar(2.8, 0.09, 0.09, 0, 1.58, z);
        }
        for (const x of [-1.36, 1.36]) {
            for (const z of [-0.82, -0.27, 0.27, 0.82]) bar(0.08, 2.8, 0.065, x, 1.59, z);
        }
        for (const x of [-0.72, 0, 0.72]) bar(0.08, 0.075, 2.85, x, 3.2, 0);
        bar(0.32, 0.4, 0.19, 0.36, 1.53, 1.51, lock);
        return group;
    }
    function spawnWave() {
        for (const item of createRunnerWave(spawnCount++, stage)) {
            const group = cage(item.species);
            group.position.set(item.x, 0, item.z);
            scene.add(group);
            objects.push({kind: 'cage', x: item.x, z: item.z, species: item.species, hp: 2, hitFlash: 0, group});
        }
    }
    function createFinishGoal() {
        const group = new THREE.Group();
        const gold = material(0xf1cb76);
        const dark = material(0x263a40);
        const post = (width, height, depth, x, y, z, mat = gold) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
            mesh.position.set(x, y, z);
            group.add(mesh);
            return mesh;
        };
        for (const x of [-6.3, 6.3]) {
            post(0.5, 5.9, 0.6, x, 2.95, 0);
            post(0.72, 0.72, 0.72, x, 5.7, 0, dark);
        }
        post(13, 0.6, 0.65, 0, 5.85, 0);
        const sign = gateText('ZIEL', 5.85, 6, 1.4, 190, '#ffffff');
        sign.position.z = 0.5;
        group.add(sign);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.045, 0.9), material(0xffffff));
        stripe.position.set(0, 0.015, 0);
        group.add(stripe);
        const mark = material(0x182c35);
        for (let i = 0; i < 10; i++) {
            post(1.25, 0.05, 0.9, -5.625 + i * 1.25, 0.045, 0, i % 2 ? gold : mark);
        }
        scene.add(group);
        return group;
    }
    const finishGoal = createFinishGoal();
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
        if (i < 0) return;
        objects.splice(i, 1);
        disposeGroup(obj.group);
    }
    function shoot() {
        const count = Math.min(7, temporary.bullets);
        for (let i = 0; i < count; i++) {
            const x = player.position.x + (i - (count - 1) / 2) * 0.4;
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), material(0xffef9c));
            mesh.position.set(x, 1.5, 6);
            scene.add(mesh);
            bullets.push({mesh, x, z: 6});
        }
        shots++;
    }
    function collectGate(obj) {
        Object.assign(temporary, applyGate(temporary, obj));
    }
    function collideBullet(bullet, previousZ) {
        for (const obj of objects) {
            const hit = obj.kind === 'gate'
                ? Math.abs(bullet.x - obj.x) <= 3.05 && bullet.z <= obj.z + 0.35 && previousZ >= obj.z - 0.35
                : bulletHitsCage(bullet.x, previousZ, bullet.z, obj.x, obj.z);
            if (!hit) continue;
            if (obj.kind === 'gate') {
                obj.charge++;
                if (obj.charge >= 2) {
                    obj.charge = 0;
                    Object.assign(obj, improveGate(obj));
                    updateGate(obj);
                }
            } else {
                obj.hp -= temporary.damage;
                obj.hitFlash = 0.18;
                if (obj.hp <= 0) {
                    collectDinosaur(obj.species);
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
        if (keys.has('ArrowLeft') || keys.has('KeyA')) targetX -= dt * 8;
        if (keys.has('ArrowRight') || keys.has('KeyD')) targetX += dt * 8;
        targetX = clamp(targetX, -5.15, 5.15);
        player.position.x = THREE.MathUtils.damp(player.position.x, targetX, 14, dt);
        player.rotation.z = (player.position.x - targetX) * 0.07;
        player.position.y = Math.sin(elapsed * 13) * 0.05;
        for (const [index, leg] of player.userData.legs.entries()) leg.rotation.x = Math.sin(elapsed * 13 + index * Math.PI) * 0.25;
        for (const [index, follower] of followers.entries()) {
            const row = Math.floor(index / followerOffsets.length);
            const x = clamp(player.position.x + followerOffsets[index % followerOffsets.length], -5.5, 5.5);
            follower.position.x = THREE.MathUtils.damp(follower.position.x, x, 4 / (1 + row * 0.3), dt);
            follower.position.z = player.position.z + 1.4 + row * 1.15;
            follower.position.y = Math.sin(elapsed * 7 + index) * 0.04;
            for (const [legIndex, leg] of follower.userData.legs.entries()) leg.rotation.x = Math.sin(elapsed * 7 + legIndex * Math.PI + index) * 0.18;
        }
        hurtFlash = Math.max(0, hurtFlash - dt);
        player.userData.skin.color.setHex(hurtFlash > 0 ? 0xffffff : 0x47644b);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, player.position.x * 0.25, 2.5, dt);
        camera.lookAt(camera.position.x * 0.4, 1.5, -20);
        shotTimer -= dt;
        if (shotTimer <= 0) {
            shoot();
            shotTimer += 0.28 / temporary.fireRate;
        }
        if (elapsed >= nextSpawn) {
            spawnWave();
            nextSpawn += 1.65;
        }
        if (elapsed >= nextGate) {
            spawnGatePair();
            nextGate += 9.8;
        }
        const speed = 17 + stage * 0.6;
        finishGoal.position.z = player.position.z - speed * remaining;
        for (const marking of markings) {
            marking.position.z += speed * dt;
            if (marking.position.z > 20) marking.position.z -= 320;
        }
        for (const decoration of scenery) {
            decoration.position.z += speed * dt;
            if (decoration.position.z > 22) decoration.position.z -= 294;
        }
        for (const obj of [...objects]) {
            if (!objects.includes(obj)) continue;
            obj.z += speed * dt;
            obj.group.position.z = obj.z;
            if (obj.kind === 'cage') {
                obj.hitFlash = Math.max(0, obj.hitFlash - dt);
                obj.group.scale.setScalar(obj.hitFlash > 0 ? 1.06 : 1);
            }
            if (obj.z > 8) {
                if (obj.kind === 'gate') {
                    if (Math.abs(player.position.x - obj.x) < 3.05) collectGate(obj);
                    for (const gate of [...objects].filter(item => item.kind === 'gate' && Math.abs(item.z - obj.z) < 2)) removeObject(gate);
                } else {
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
        targetX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 12, -5.15, 5.15);
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
        const settings = runnerCameraSettings(width, height);
        camera.aspect = width / height;
        camera.fov = settings.fov;
        camera.far = settings.far;
        camera.position.y = settings.y;
        camera.position.z = settings.z;
        camera.lookAt(camera.position.x * 0.4, settings.lookY, settings.lookZ);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
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
        renderer.forceContextLoss();
        renderer.dispose();
        renderer.domElement.remove();
    }
    return {destroy: () => { if (active) { active = false; destroy(); } }};
}
