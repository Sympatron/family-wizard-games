export function createRanger(THREE) {
    const ranger = new THREE.Group();
    const mat = color => new THREE.MeshStandardMaterial({color, roughness: 0.86});
    const coat = mat(0x47644b);
    const hat = mat(0x66533b);
    const leather = mat(0x705039);
    const skin = mat(0xe8af7c);
    const trousers = mat(0x3d4936);
    const boots = mat(0x493728);
    const steel = mat(0x6e8580);
    const scarf = mat(0xc7a65c);
    const black = mat(0x252e30);
    const add = (geometry, material, x, y, z) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        ranger.add(mesh);
        return mesh;
    };
    const box = (width, height, depth, material, x, y, z) => add(new THREE.BoxGeometry(width, height, depth), material, x, y, z);
    const sphere = (radius, material, x, y, z) => add(new THREE.SphereGeometry(radius, 10, 8), material, x, y, z);
    const torso = box(0.85, 1.05, 0.5, coat, 0, 1.57, 0);
    const backpack = box(0.72, 0.85, 0.36, leather, 0, 1.58, 0.47);
    box(0.9, 0.14, 0.55, leather, 0, 1.12, 0);
    box(0.18, 0.18, 0.56, steel, 0, 1.12, -0.05);
    box(0.92, 0.18, 0.58, scarf, 0, 2.06, -0.02);
    sphere(0.34, skin, 0, 2.47, -0.05);
    for (const side of [-1, 1]) {
        sphere(0.035, black, side * 0.15, 2.52, -0.35);
        const leg = box(0.3, 0.9, 0.35, trousers, side * 0.23, 0.63, 0.06);
        const boot = box(0.35, 0.29, 0.53, boots, side * 0.23, 0.17, -0.08);
        leg.add(boot);
        boot.position.set(0, -0.49, -0.14);
        ranger.userData.legs ??= [];
        ranger.userData.legs.push(leg);
        const sleeve = box(0.3, 0.7, 0.36, coat, side * 0.58, 1.75, -0.15);
        sleeve.rotation.x = -0.75;
        box(0.29, 0.17, 0.32, leather, side * 0.58, 1.48, -0.43);
    }
    add(new THREE.CylinderGeometry(0.43, 0.43, 0.25, 12), hat, 0, 2.86, 0);
    add(new THREE.CylinderGeometry(0.68, 0.68, 0.07, 12), hat, 0, 2.72, 0);
    const rifle = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.18, 1.05), leather);
    rifle.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 1.2, 8), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.77;
    rifle.add(barrel);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.18), black);
    sight.position.set(0, 0.15, -0.7);
    rifle.add(sight);
    rifle.position.set(0.3, 1.48, -0.88);
    ranger.add(rifle);
    ranger.userData.skin = coat;
    ranger.userData.rifle = rifle;
    ranger.userData.torso = torso;
    return ranger;
}
