(() => {
  "use strict";

  const { CITY_SIZES, DISTRICT_IDS, originalBuildings } = globalThis.GridLab;
  const assets = {
    solar: { name: "Parc solaire", label: "Solaire", icon: "sun", color: 0xd89431, x: -38, z: -27, labelHeight: 7, socket: [-26, -23] },
    battery: { name: "Batterie", label: "Batterie", icon: "battery", color: 0x8662c5, x: -38, z: 0, labelHeight: 8, socket: [-28, 0] },
    grid: { name: "Réseau amont", label: "Réseau", icon: "tower", color: 0x497fbd, x: -38, z: 27, labelHeight: 18, socket: [-36, 28] },
    bus: { name: "Poste central", label: "Poste", icon: "bolt", color: 0x437f65, x: 0, z: 0, labelHeight: 10 },
    business: { name: "Quartier tertiaire", label: "Tertiaire", icon: "building", color: 0x437f65, x: 38, z: -27, labelHeight: 22, socket: [26, -26] },
    services: { name: "Services publics", label: "Services publics", icon: "public", color: 0x437f65, x: 38, z: 0, labelHeight: 13, socket: [26, 0] },
    residential: { name: "Quartier résidentiel", label: "Résidentiel", icon: "home", color: 0x437f65, x: 38, z: 27, labelHeight: 11, socket: [26, 27] }
  };

  function create({ canvas, labels, bubble, select, edit, unavailable }) {
    const T = globalThis.GridLabThree;
    if (!T) return null;
    const alpha = document.documentElement.dataset.host === "desktop";
    const context = canvas.getContext("webgl2", { antialias: true, alpha });
    if (!context) return null;

    const renderer = new T.WebGLRenderer({ canvas, context, antialias: true, alpha });
    const scene = new T.Scene();
    const surface = new T.Color();
    const camera = new T.OrthographicCamera(-64, 64, 40, -40, 0.1, 600);
    const controls = new T.OrbitControls(camera, canvas);
    controls.enablePan = true;
    controls.minZoom = 0.82;
    controls.maxZoom = 2.6;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = 1.22;
    controls.target.set(0, 1, 0);
    camera.position.set(64, 96, 124);
    controls.update();
    const sunlight = new T.DirectionalLight(0xfff4d9, 2.15);
    sunlight.position.set(-22, 45, 19);
    scene.add(new T.HemisphereLight(0xf8fff9, 0x637a70, 1.75), sunlight);

    const geometries = {
      box: new T.BoxGeometry(1, 1, 1),
      ball: new T.SphereGeometry(1, 9, 7),
      post: new T.CylinderGeometry(1, 1, 1, 7),
      roof: new T.ConeGeometry(1, 1, 4)
    };
    const groups = new Map();
    const up = new T.Vector3(0, 1, 0);
    const straight = new T.Quaternion();
    function piece(shape, color, x, y, z, w, h, d, rotation = straight) {
      const key = shape + color;
      if (!groups.has(key)) groups.set(key, { shape, color, matrices: [] });
      groups.get(key).matrices.push(new T.Matrix4().compose(
        new T.Vector3(x, y, z), rotation, new T.Vector3(w, h, d)
      ));
    }
    function box(color, x, y, z, w, h, d, rotation) {
      piece("box", color, x, y, z, w, h, d, rotation);
    }
    function beam(color, start, end, radius) {
      const a = new T.Vector3(...start);
      const b = new T.Vector3(...end);
      const center = a.clone().lerp(b, 0.5);
      const rotation = new T.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
      piece("post", color, center.x, center.y, center.z, radius, a.distanceTo(b), radius, rotation);
    }

    function tree(x, z, size = 1) {
      piece("post", 0x655d45, x, 1.25 * size, z, 0.22 * size, 2.1 * size, 0.22 * size);
      piece("ball", 0x588971, x, 2.6 * size, z, 1.35 * size, 1.55 * size, 1.35 * size);
      piece("ball", 0x7ca687, x + 0.46 * size, 2.6 * size, z + 0.3 * size, 0.93 * size, 1.18 * size, 0.96 * size);
    }
    function fence(x, z, width, depth) {
      const color = 0x647c73;
      for (const edge of [z - depth / 2, z + depth / 2]) {
        for (let i = 0; i <= 8; i++) box(color, x - width / 2 + width * i / 8, 1, edge, 0.16, 1.7, 0.16);
        box(color, x, 1.33, edge, width, 0.08, 0.09);
        box(color, x, 0.65, edge, width, 0.08, 0.09);
      }
    }

    function ground() {
      box(0xa9bcb0, 0, -3.4, 0, 115, 3.5, 86);
      box(0x91a998, 0, -1.27, 0, 115, 1.0, 86);
      box(0xc1cbb9, 0, -0.44, 0, 114, 0.66, 85);
      for (const x of [-38, 38]) {
        for (const z of [-27, 0, 27]) box(0xa6bb9d, x, 0.025, z, 33, 0.28, 23);
      }
      for (const x of [-19, 19]) {
        box(0x606e6b, x, -0.013, 0, 5.8, 0.16, 84);
        for (let z = -40; z <= 40; z += 5) box(0xc5cdc4, x, 0.08, z, 0.12, 0.035, 2);
      }
      for (const z of [-13.5, 13.5]) {
        box(0x606e6b, 0, -0.012, z, 113, 0.17, 3.0);
        for (let x = -53; x <= 54; x += 5) box(0xc5cdc4, x, 0.09, z, 2, 0.035, 0.12);
      }
      for (const x of [-54, 53]) for (const z of [-39, 39]) box(0xd9e3d1, x, 0.04, z, 4, 0.14, 1);
      for (const z of [-37, -29, 28, 39]) {
        tree(-9, z, 1.1);
        tree(10, z, 0.95);
      }
    }

    function solar(x, z) {
      fence(x, z, 28, 19);
      const tilt = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -0.27);
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          const px = x - 9 + col * 6;
          const pz = z - 6 + row * 4;
          box(0x6b8278, px, 0.85, pz, 0.23, 1.4, 0.26);
          box(0xc2d3cb, px, 1.65, pz, 5.2, 0.22, 2.8, tilt);
          box(0x365f85, px, 1.79, pz, 4.95, 0.12, 2.65, tilt);
          for (const offset of [-1.25, 0, 1.25]) box(0x7495a8, px + offset, 1.87, pz, 0.065, 0.028, 2.62, tilt);
        }
      }
      box(0xc3cbb0, x + 12, 1.15, z + 4, 2.5, 2, 2.3);
    }

    function storage(x, z) {
      fence(x, z, 29, 20);
      box(0x95a39a, x, 0.18, z, 29, 0.23, 19.8);
      for (const offset of [-6, 0, 6]) {
        box(0xcfd3d1, x - 1, 1.9, z + offset, 15, 3.3, 4.1);
        box(0xa69bc4, x - 1, 3.58, z + offset, 15.5, 0.24, 4.35);
        box(0x71668e, x + 6.55, 1.68, z + offset, 0.16, 2.5, 3.2);
        for (const vent of [-1.1, 0, 1.1]) box(0xc7c6d6, x + 6.67, 2.02, z + offset + vent, 0.1, 1.13, 0.46);
      }
      box(0xd5a25e, x + 10, 0.9, z, 2.5, 1.5, 3.1);
    }

    function tower(x, z) {
      const metal = 0x557678;
      box(0xa7b4aa, x, 0.25, z, 24, 0.34, 16.6);
      for (const sign of [-1, 1]) {
        for (const depth of [-1, 1]) {
          beam(metal, [x + 4.6 * sign, 0.45, z + depth * 3.5], [x + 1.2 * sign, 13.7, z + depth * 0.8], 0.19);
          beam(metal, [x + 3.7 * sign, 4.5, z + depth * 2.7], [x - 2.5 * sign, 9.7, z + depth * 1.55], 0.13);
          box(0xafbdad, x + 4.6 * sign, 0.44, z + depth * 3.5, 1.15, 0.56, 1.15);
        }
      }
      for (const [height, width] of [[7, 7], [10.3, 12], [13.7, 16]]) {
        box(metal, x, height, z, width, 0.36, 0.44);
        for (const sign of [-1, 1]) box(0xc8d8d5, x + (width / 2 - 0.6) * sign, height - 0.75, z, 0.32, 1.16, 0.31);
      }
      beam(metal, [x, 13.2, z], [x, 16.2, z], 0.22);
      tree(x - 11, z + 5, 0.9);
    }

    function substation() {
      box(0xa4b6a6, 0, 0.06, 0, 27, 0.28, 20);
      box(0xd4ddd0, 0, 2.4, -1.9, 11.1, 4.5, 8.1);
      box(0x53796d, 0, 4.82, -1.9, 11.9, 0.58, 8.7);
      box(0x576e65, 1, 1.47, 2.18, 3, 2.7, 0.16);
      for (const x of [-4.2, 4.2]) {
        box(0x7a8982, x, 1.12, 6.6, 2.45, 1.9, 2.5);
        for (const dx of [-0.7, 0, 0.7]) box(0xd5e1d0, x + dx, 2.43, 6.6, 0.26, 0.84, 0.27);
      }
      box(0xd5bd71, 0, 3.45, 2.27, 2.1, 0.2, 0.16);
    }

    function office(x, z, w, d, h, wall) {
      box(0xc3cbc5, x, 0.17, z, w + 1.1, 0.3, d + 0.9);
      box(wall, x, h / 2 + 0.22, z, w, h, d);
      box(0x82998e, x, h + 0.32, z, w + 0.28, 0.3, d + 0.28);
      box(0xbbc9c3, x, h + 0.7, z, w * 0.36, 0.55, d * 0.35);
      for (let y = 1.7; y < h - 0.8; y += 1.7) {
        for (let dx = -w / 2 + 1.1; dx < w / 2 - 0.7; dx += 1.55) {
          box(0x668481, x + dx, y, z + d / 2 + 0.03, 0.85, 0.65, 0.09);
          box(0x668481, x + dx, y, z - d / 2 - 0.03, 0.85, 0.65, 0.09);
        }
        for (let dz = -d / 2 + 1.1; dz < d / 2 - 0.7; dz += 1.7) {
          box(0x78948e, x + w / 2 + 0.03, y, z + dz, 0.09, 0.65, 0.88);
          box(0x78948e, x - w / 2 - 0.03, y, z + dz, 0.09, 0.65, 0.88);
        }
      }
    }
    function business(x, z) {
      box(0xb6c1b7, x, 0.13, z, 30, 0.18, 20.5);
      for (const dx of [-12.5, 0, 12.5]) tree(x + dx, z + 9.1, 0.65);
    }

    function services(x, z) {
      box(0xbcc8b9, x, 0.1, z, 30, 0.24, 21);
      tree(x - 12.4, z + 8, 0.85);
      tree(x + 10.8, z - 8.2, 0.93);
    }

    ground();
    for (const [key, draw] of Object.entries({ solar, battery: storage, grid: tower, bus: substation, business, services })) {
      draw(assets[key].x, assets[key].z);
    }
    function flushPieces(parent) {
      for (const { shape, color, matrices } of groups.values()) {
        const mesh = new T.InstancedMesh(geometries[shape], new T.MeshLambertMaterial({ color }), matrices.length);
        matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        parent.add(mesh);
      }
      groups.clear();
    }
    flushPieces(scene);

    const hitboxes = Object.entries(assets).map(([key, asset]) => {
      const hitbox = new T.Mesh(new T.BoxGeometry(key === "bus" ? 25 : 31, asset.labelHeight, 21),
        new T.MeshBasicMaterial({ visible: false }));
      hitbox.position.set(asset.x, asset.labelHeight / 2, asset.z);
      hitbox.userData.asset = key;
      scene.add(hitbox);
      return hitbox;
    });

    const selector = new T.Group();
    const selectionMaterial = new T.MeshBasicMaterial({ color: 0xc4edaf });
    const border = new T.BoxGeometry(1, 0.055, 0.009);
    const corner = new T.BoxGeometry(0.007, 0.055, 1);
    for (const side of [-0.5, 0.5]) {
      const horizontal = new T.Mesh(border, selectionMaterial);
      horizontal.position.z = side;
      const vertical = new T.Mesh(corner, selectionMaterial);
      vertical.position.x = side;
      selector.add(horizontal, vertical);
    }
    scene.add(selector);
    const pin = {};
    function createPin(key, asset) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "city-pin";
      button.dataset.asset = key;
      button.style.setProperty("--pin", "#" + asset.color.toString(16));
      button.innerHTML = "<i></i><span></span><strong></strong>";
      button.addEventListener("click", () => select(key, true));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        edit({ key });
      });
      labels.append(button);
      pin[key] = { button, at: new T.Vector3(asset.x, asset.labelHeight, asset.z) };
    }
    for (const [key, asset] of Object.entries(assets)) createPin(key, asset);

    const extension = new T.Group();
    const buildingHitboxShape = new T.BoxGeometry(1, 1, 1);
    const buildingHitboxMaterial = new T.MeshBasicMaterial({ visible: false });
    const lots = new Map();
    const extensionHits = [];
    const vacantHits = [];
    let extensionWidth = 0;
    let extensionKey = "";
    scene.add(extension);

    function drawOriginal(building, x, z) {
      if (building.district === "residential") {
        const turn = new T.Quaternion().setFromAxisAngle(up, Math.PI / 4);
        const index = Number(building.id.at(-1)) - 1;
        box(0xc6c6ae, x, 0.13, z, 6.5, 0.19, 7);
        box(0xe0daca, x, 1.39, z, 4.7, 2.3, 4.45);
        piece("roof", (Math.floor(index / 2) + index % 2) % 2 ? 0xa17159 : 0x7e7074, x, 3.37, z, 3.66, 1.65, 3.56, turn);
        box(0x6f8b85, x + 0.9, 1.7, z + 2.25, 0.95, 0.63, 0.12);
        box(0x7b7469, x - 1.05, 1.03, z + 2.26, 0.69, 1.44, 0.11);
        tree(x + 2.75, z + 1.9, 0.61);
      } else if (building.district === "business") {
        office(x, z, building.width, building.depth, building.height, building.color);
      } else if (building.id === "original-centre") {
        box(0xcbd2c0, x, 2.3, z, 10, 4.1, 12.5);
        box(0x638b7e, x, 4.51, z, 10.6, 0.55, 13.2);
        box(0x97afa3, x, 2, z + 6.32, 5, 2.8, 0.15);
      } else {
        box(0x7ba084, x, 0.22, z, 13.6, 0.28, 12.6);
        const ink = 0xe7ebd9;
        for (const side of [-1, 1]) {
          box(ink, x + side * 6, 0.38, z, 0.11, 0.05, 10.6);
          box(ink, x, 0.38, z + side * 5.3, 12.1, 0.05, 0.11);
        }
        box(ink, x, 0.38, z, 0.11, 0.05, 10.6);
      }
    }

    function addHitbox(target, x, z, width, height, depth, collection) {
      const hitbox = new T.Mesh(buildingHitboxShape, buildingHitboxMaterial);
      hitbox.scale.set(width, height, depth);
      hitbox.position.set(x, height / 2, z);
      hitbox.userData.target = target;
      collection.push(hitbox);
      extension.add(hitbox);
    }

    function registerBuilding(building, x, z, width, height, depth) {
      const key = "building:" + building.id;
      lots.set(key, { x, z, width, depth, labelHeight: height + 2.2, color: assets[building.district].color });
      addHitbox({ key, district: building.district }, x, z, width, height, depth, extensionHits);
      createPin(key, lots.get(key));
      pin[key].button.hidden = true;
    }

    function drawBuilding(type, x, z) {
      box(0xb9c4b7, x, 0.08, z, 6.6, 0.25, 7.1);
      switch (type) {
        case "house": {
          const turn = new T.Quaternion().setFromAxisAngle(up, Math.PI / 4);
          box(0xdbd1bb, x, 1.45, z, 4.5, 2.5, 4.2);
          piece("roof", 0xa97155, x, 3.47, z, 3.55, 1.8, 3.42, turn);
          box(0x6b8a80, x, 1.34, z + 2.12, 1.9, 1, 0.13);
          return 4.7;
        }
        case "apartment":
          office(x, z, 5.6, 5.4, 10.5, 0xd4c3ad);
          return 11.6;
        case "office":
          office(x, z, 5.5, 5.1, 9, 0xa4bfbf);
          return 10.1;
        case "hospital":
          office(x, z, 5.9, 5.7, 6.8, 0xd4dcd5);
          box(0xb45e5e, x, 7.65, z, 2.2, 0.15, 0.53);
          box(0xb45e5e, x, 7.65, z, 0.53, 0.15, 2.2);
          return 8.3;
        case "industry":
          box(0x929b9c, x, 2.13, z, 5.9, 3.9, 5.6);
          box(0x515e66, x, 4.25, z, 6.2, 0.5, 5.95);
          for (const dx of [-1.7, 1.7]) piece("post", 0x76898e, x + dx, 5.45, z - 1, 0.34, 2.5, 0.34);
          return 7.3;
        case "charger":
          box(0x65767b, x, 0.3, z, 6.05, 0.30, 5.5);
          for (const dx of [-1.9, 0, 1.9]) {
            box(0xd0d9c9, x + dx, 0.48, z, 0.08, 0.05, 3.2);
            box(0x62a68d, x + dx, 0.97, z - 2.1, 0.45, 1.28, 0.44);
          }
          return 2.4;
        case "school":
        case "market": {
          const color = type === "school" ? 0x758eab : 0xc99055;
          box(0xd7d4c6, x, 1.94, z, 5.9, 3.3, 5.7);
          box(color, x, 3.66, z, 6.18, 0.48, 5.95);
          box(0x6e8c8a, x, 1.45, z + 2.87, 3.7, 1.0, 0.09);
          return 4.6;
        }
      }
    }

    function setExpansion(network) {
      const originals = originalBuildings(network);
      const key = JSON.stringify([network.size, originals.filter(({ removed }) => removed).map(({ id }) => id),
        network.buildings.map(({ id, type, district, lot }) => [id, type, district, lot])]);
      if (key === extensionKey) return;
      extensionKey = key;
      for (const mesh of extension.children) {
        if (mesh.isInstancedMesh) {
          mesh.dispose();
          mesh.material.dispose();
        }
      }
      extension.clear();
      for (const id of lots.keys()) {
        pin[id].button.remove();
        delete pin[id];
      }
      lots.clear();
      extensionHits.length = 0;
      vacantHits.length = 0;
      for (const building of originals) {
        const x = assets[building.district].x + building.x;
        const z = assets[building.district].z + building.z;
        if (building.removed) {
          box(0xb1c2a6, x, 0.19, z, building.width, 0.05, building.depth);
          addHitbox({ restore: building.id, district: building.district }, x, z,
            building.width, 0.4, building.depth, vacantHits);
        } else {
          drawOriginal(building, x, z);
          registerBuilding(building, x, z, building.width, building.height, building.depth);
        }
      }
      const lotCount = CITY_SIZES[network.size].lots;
      const nextWidth = network.size > 1 || network.buildings.length ? lotCount * 4 + 5 : 0;
      if (nextWidth) {
        const mid = 57.5 + nextWidth / 2;
        box(0xa9bcb0, mid, -3.4, 0, nextWidth, 3.5, 86);
        box(0x91a998, mid, -1.27, 0, nextWidth, 1.0, 86);
        box(0xc1cbb9, mid, -0.44, 0, nextWidth + 0.12, 0.66, 85);
        for (const edge of [-13.5, 13.5]) {
          box(0x606e6b, mid, -0.012, edge, nextWidth, 0.17, 3);
          for (let offset = 2; offset < nextWidth - 1; offset += 5) {
            box(0xc5cdc4, 57.5 + offset, 0.09, edge, 2, 0.035, 0.12);
          }
        }
        for (const district of DISTRICT_IDS) {
          const row = assets[district].z;
          const occupants = new Map(network.buildings.filter((building) => building.district === district)
            .map((building) => [building.lot, building]));
          box(0xa5b89d, mid, 0.025, row, nextWidth - 1, 0.28, 23);
          box(0xb8c7ad, mid, 0.22, row, nextWidth - 0.6, 0.13, 2.1);
          for (let slot = 0; slot < lotCount; slot++) {
            const x = 62.5 + Math.floor(slot / 2) * 8;
            const z = row + (slot % 2 ? 5.7 : -5.7);
            const building = occupants.get(slot);
            if (!building) {
              box(0xb1c2a6, x, 0.195, z, 6.6, 0.075, 7.1);
              addHitbox({ district, lot: slot }, x, z, 6.6, 0.4, 7.1, vacantHits);
              continue;
            }
            const height = drawBuilding(building.type, x, z);
            registerBuilding(building, x, z, 6.6, height, 7.1);
          }
        }
      }
      flushPieces(extension);
      if (nextWidth !== extensionWidth) {
        const centerDelta = (nextWidth - extensionWidth) / 2;
        extensionWidth = nextWidth;
        controls.target.x += centerDelta;
        camera.position.x += centerDelta;
        controls.update();
        resize();
      }
      cameraChanged = true;
      requestRender();
    }

    const curvePoint = new T.Vector3();
    const tangent = new T.Vector3();
    const pulseShape = new T.SphereGeometry(0.53, 9, 7);
    const arrowShape = new T.ConeGeometry(0.64, 1.78, 6);
    const inactiveColor = 0x7e938c;
    const alertColor = 0xe27149;
    const socketGeometry = new T.BoxGeometry(1.45, 1.15, 1.25);
    const socketMaterial = new T.MeshLambertMaterial({ color: 0x647c73 });
    const cable = {};
    for (const [key, asset] of Object.entries(assets)) {
      if (key === "bus") continue;
      const side = Math.sign(asset.x);
      const source = side < 0;
      const busSocket = [9 * side, Math.sign(asset.z) * 5];
      const points = asset.z
        ? [asset.socket, [14 * side, asset.z], [10 * side, asset.z * 0.68], busSocket]
        : [asset.socket, [15 * side, 0], busSocket];
      for (const [x, z] of [asset.socket, busSocket]) {
        const socket = new T.Mesh(socketGeometry, socketMaterial);
        socket.position.set(x, 0.76, z);
        scene.add(socket);
      }
      if (!source) points.reverse();
      const path = new T.CatmullRomCurve3(points.map(([x, z]) => new T.Vector3(x, 0.72, z)));
      const segments = asset.z ? 34 : 10;
      const shell = new T.Mesh(
        new T.TubeGeometry(path, segments, 0.37, 7, false),
        new T.MeshLambertMaterial({ color: 0x435a51 })
      );
      const material = new T.MeshBasicMaterial({ color: inactiveColor });
      const core = new T.Mesh(new T.TubeGeometry(path, segments, 0.25, 6, false), material);
      core.position.y = 0.19;
      const arrow = new T.Mesh(arrowShape, material);
      const dots = Array.from({ length: 3 }, () => new T.Mesh(pulseShape, material));
      scene.add(shell, core, arrow, ...dots);
      cable[key] = { path, material, arrow, dots, powerKw: 0 };
    }

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let width = 0;
    let height = 0;
    let inView = true;
    let playing = false;
    let disposed = false;
    let cameraChanged = true;
    let selectedKey;
    let bubbleKey;
    const position = new T.Vector3();

    function projectPins() {
      for (const { button, at } of Object.values(pin)) {
        position.copy(at).project(camera);
        button.style.left = ((position.x + 1) * width / 2) + "px";
        button.style.top = ((1 - position.y) * height / 2) + "px";
        button.style.visibility = Math.abs(position.x) > 0.97 || Math.abs(position.y) > 0.94 ? "hidden" : "visible";
      }
      if (!bubbleKey || !pin[bubbleKey]) return;
      position.copy(pin[bubbleKey].at).project(camera);
      const x = (position.x + 1) * width / 2;
      const y = (1 - position.y) * height / 2;
      const within = x >= 0 && x <= width && y >= 0 && y <= height;
      bubble.style.visibility = within ? "visible" : "hidden";
      const left = Math.max(6, Math.min(x - bubble.offsetWidth / 2, width - bubble.offsetWidth - 6));
      const above = y - bubble.offsetHeight - 7;
      const top = above >= 6 ? above : Math.max(6, Math.min(y + 7, height - bubble.offsetHeight - 6));
      bubble.style.left = left + "px";
      bubble.style.top = top + "px";
    }

    function updateSelection() {
      for (const [key, { button }] of Object.entries(pin)) {
        button.setAttribute("aria-pressed", String(key === selectedKey));
        button.hidden = key === bubbleKey || (lots.has(key) && key !== selectedKey);
      }
      bubble.hidden = !bubbleKey;
      cameraChanged = true;
      requestRender();
    }
    function render(now) {
      frame = 0;
      if (!width || disposed) return;
      const moving = playing && !motion.matches;
      for (const { path, powerKw, arrow, dots } of Object.values(cable)) {
        const active = Math.abs(powerKw) > 0.05;
        const direction = powerKw >= 0 ? 1 : -1;
        arrow.visible = active;
        path.getPointAt(0.56, curvePoint);
        arrow.position.copy(curvePoint);
        arrow.position.y += 0.48;
        arrow.quaternion.setFromUnitVectors(up, path.getTangentAt(0.56, tangent).multiplyScalar(direction));
        dots.forEach((dot, index) => {
          dot.visible = active && moving;
          if (!dot.visible) return;
          const pace = 0.14 + Math.min(0.5, Math.abs(powerKw) / 1800);
          const t = ((now / 1000) * pace + index / dots.length) % 1;
          path.getPointAt(direction === 1 ? t : 1 - t, curvePoint);
          dot.position.copy(curvePoint);
          dot.position.y += .42;
        });
      }
      renderer.render(scene, camera);
      if (cameraChanged) projectPins();
      cameraChanged = false;
      if (moving && inView && !document.hidden && Object.values(cable).some(({ powerKw }) => Math.abs(powerKw) > 0.05)) {
        requestRender();
      }
    }
    function requestRender() {
      if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(render);
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (!width || !height) return;
      const aspect = width / height;
      // Conserve toute la ville dans le champ, y compris sur un écran étroit.
      const halfHeight = Math.max(41.5 + extensionWidth * 0.19, (73 + extensionWidth * 0.5) / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
      renderer.setSize(width, height, false);
      cameraChanged = true;
      requestRender();
    }
    function changeCamera(action) {
      if (action === "reset") {
        controls.target.set(extensionWidth / 2, 1, 0);
        camera.position.set(64 + extensionWidth / 2, 96, 124);
        camera.zoom = 1;
        camera.updateProjectionMatrix();
      } else if (action === "rotate") {
        camera.position.sub(controls.target).applyAxisAngle(up, Math.PI / 4).add(controls.target);
      } else if (action === "left" || action === "right") {
        const delta = new T.Vector3(action === "left" ? -12 : 12, 0, 0).applyQuaternion(camera.quaternion);
        camera.position.add(delta);
        controls.target.add(delta);
      } else {
        const scale = action === "zoomIn" ? 1.25 : 0.8;
        camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * scale));
        camera.updateProjectionMatrix();
      }
      controls.update();
      cameraChanged = true;
      requestRender();
    }

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) requestRender();
    });
    visibilityObserver.observe(canvas);
    controls.addEventListener("change", () => {
      cameraChanged = true;
      requestRender();
    });
    motion.addEventListener("change", requestRender);
    document.addEventListener("visibilitychange", requestRender);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      disposed = true;
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      controls.dispose();
      motion.removeEventListener("change", requestRender);
      document.removeEventListener("visibilitychange", requestRender);
      unavailable();
    }, { once: true });

    const pointer = new T.Vector2();
    const raycaster = new T.Raycaster();
    let pointerStart;
    function pick(event) {
      if (!width || !height) return {};
      const rect = canvas.getBoundingClientRect();
      pointer.set(2 * (event.clientX - rect.left) / width - 1, 1 - 2 * (event.clientY - rect.top) / height);
      raycaster.setFromCamera(pointer, camera);
      const [individual] = raycaster.intersectObjects([...extensionHits, ...vacantHits]);
      if (individual) return individual.object.userData.target;
      const [equipment] = raycaster.intersectObjects(hitboxes);
      if (equipment) return { key: equipment.object.userData.asset };
      const { origin, direction } = raycaster.ray;
      const z = origin.z - origin.y * direction.z / direction.y;
      return { district: z < -13.5 ? "business" : z > 13.5 ? "residential" : "services" };
    }

    canvas.addEventListener("pointerdown", (event) => { pointerStart = [event.clientX, event.clientY]; });
    canvas.addEventListener("pointerup", (event) => {
      if (!pointerStart || event.button !== 0 || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
      const target = pick(event);
      select(target.key ?? null, true);
    });
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (pointerStart && Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 6) return;
      edit(pick(event));
    });
    bubble.addEventListener("contextmenu", (event) => {
      if (!bubbleKey) return;
      event.preventDefault();
      edit({ key: bubbleKey });
    });

    resize();

    return {
      setExpansion,
      setTheme(dark) {
        if (!alpha) scene.background = surface.setHex(dark ? 0x1a2028 : 0xe9edf0);
        requestRender();
      },
      update(flows, warnings, values, names) {
        for (const [key, line] of Object.entries(cable)) {
          line.powerKw = flows[key];
          const active = Math.abs(line.powerKw) > 0.05;
          line.material.color.setHex(warnings[key] ? alertColor : active ? assets[key].color : inactiveColor);
        }
        for (const [key, { button }] of Object.entries(pin)) {
          button.querySelector("span").textContent = names[key] ?? assets[key]?.label;
          button.querySelector("strong").textContent = values[key];
          button.setAttribute("aria-label", (names[key] ?? assets[key]?.name) + " · " + values[key]);
        }
        requestRender();
      },
      select(key, showStats = false) {
        if (selectedKey !== key) bubbleKey = undefined;
        selectedKey = key;
        if (showStats && pin[key]) bubbleKey = key;
        const spot = lots.get(key);
        const { x, z } = assets[key] ?? spot ?? assets.bus;
        selector.position.set(x, 0.23, z);
        selector.scale.set(spot ? spot.width + 0.7 : key === "bus" ? 27 : 33,
          1, spot ? spot.depth + 0.8 : key === "bus" ? 20 : 23);
        updateSelection();
      },
      hideBubble() {
        bubbleKey = undefined;
        updateSelection();
      },
      play(value) {
        playing = value;
        requestRender();
      },
      changeCamera
    };
  }

  globalThis.GridLabCity = { assets, create };
})();
