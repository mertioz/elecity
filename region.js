(() => {
  "use strict";

  function create({ canvas, labels, edit }) {
    const T = globalThis.GridLabThree;
    if (!T) return null;
    const context = canvas.getContext("webgl2", { antialias: true, alpha: true });
    if (!context) return null;
    const renderer = new T.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(43, 1, 0.2, 1800);
    camera.position.set(40, 58, 70);
    const controls = new T.OrbitControls(camera, canvas);
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minDistance = 9;
    controls.maxDistance = 750;
    controls.maxPolarAngle = 1.35;
    const daylight = new T.DirectionalLight(0xfff1d8, 1.9);
    daylight.position.set(-60, 90, 35);
    scene.add(daylight, new T.HemisphereLight(0xe2ecff, 0x3e5444, 1.55));
    const world = new T.Group();
    scene.add(world);
    const shapes = {
      box: new T.BoxGeometry(1, 1, 1),
      sphere: new T.SphereGeometry(1, 9, 6),
      tower: new T.CylinderGeometry(0.76, 1.15, 1, 12, 1, true),
      cone: new T.ConeGeometry(0.53, 1.65, 8)
    };
    const up = new T.Vector3(0, 1, 0);
    const zeroRotation = new T.Quaternion();
    const pinPosition = new T.Vector3();
    const hitMaterial = new T.MeshBasicMaterial({ visible: false });
    const hitObjects = [];
    const pins = [];
    const cables = new Map();
    const instances = new Map();
    let signature = "";
    let layout;
    let lastRows;
    let playing = false;
    let frame = 0;
    let width = 0;
    let height = 0;
    let inView = false;
    let motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const vector = new T.Vector3();

    function shape(type, color, x, y, z, w, h, d) {
      const name = type + color;
      if (!instances.has(name)) instances.set(name, { type, color, transforms: [] });
      instances.get(name).transforms.push(new T.Matrix4().compose(
        new T.Vector3(x, y, z), zeroRotation, new T.Vector3(w, h, d)
      ));
    }

    function addHit(target, x, y, z, w, h, d) {
      const mesh = new T.Mesh(shapes.box, hitMaterial);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      mesh.userData.pick = target;
      world.add(mesh);
      hitObjects.push(mesh);
    }

    function drawCity(node) {
      const { x, z } = node;
      shape("box", 0x4e635b, x, 0.18, z, 9.4, 0.72, 8.1);
      shape("box", 0x7fa391, x, 0.59, z, 9, 0.17, 7.7);
      shape("box", 0x44515b, x, 0.73, z, 0.62, 0.09, 7.4);
      shape("box", 0x44515b, x, 0.74, z, 8.8, 0.09, 0.62);
      for (let i = 0; i < 12; i++) {
        const dx = (i % 4 - 1.5) * 2.12;
        const dz = (Math.floor(i / 4) - 1) * 2.25 + (i < 4 ? -0.28 : 0.45);
        const h = 0.75 + ((i * 13 + 3) % 7) * 0.38;
        shape("box", i % 3 ? 0xb5c5d1 : 0x93abae, x + dx, 0.78 + h / 2, z + dz, 1.45, h, 1.1);
        shape("box", i % 3 ? 0x718597 : 0x85a6a1, x + dx, 0.81 + h, z + dz, 1.51, 0.15, 1.16);
      }
      addHit({ kind: "city", id: node.id }, x, 1.85, z, 9.3, 3.5, 8);
    }

    function drawPlant(node) {
      const { x, z } = node;
      shape("box", 0x647078, x, 0.36, z, 9.5, 0.72, 8.2);
      shape("box", 0xb2b6ae, x + 1.8, 1.68, z + 0.9, 4.5, 2.1, 3.8);
      shape("sphere", 0xc9b788, x + 1.6, 2.78, z + 0.9, 1.29, 1.2, 1.29);
      for (const dz of [-1.85, 1.7]) {
        shape("tower", 0xd1bb9b, x - 2.3, 2.62, z + dz, 1.26, 4.1, 1.26);
        shape("box", 0x7c7063, x - 2.3, 0.66, z + dz, 2.1, 0.2, 2.1);
      }
      shape("box", 0xb1dde0, x + 2, 0.83, z - 2.55, 4.6, 0.47, 1.3);
      addHit({ kind: "plant", id: node.id }, x, 2.3, z, 9.3, 4.6, 8);
    }

    function overhead(line, a, b) {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const direct = Math.hypot(dx, dz);
      const nx = -dz / direct;
      const nz = dx / direct;
      const start = new T.Vector3(a.x + dx / direct * 4.5, 0, a.z + dz / direct * 4.5);
      const end = new T.Vector3(b.x - dx / direct * 4.5, 0, b.z - dz / direct * 4.5);
      const segments = line.poles + 1;
      const wire = new T.MeshBasicMaterial({ color: 0x8ea8b9 });
      for (let i = 0; i <= segments; i++) {
        const { x, z } = start.clone().lerp(end, i / segments);
        shape("box", 0x637e8c, x, 2.15, z, 0.32, 4.3, 0.32);
        shape("box", 0x8da1ad, x, 4.2, z, 1.7, 0.15, 1.7);
        if (i > 0 && i < segments) addHit({ kind: "pole", id: line.id, index: i }, x, 2.3, z, 1.7, 4.6, 1.7);
      }
      let centerCurve;
      for (const offset of [-0.44, 0, 0.44]) {
        const points = Array.from({ length: 2 * segments + 1 }, (_, i) => {
          const position = start.clone().lerp(end, i / (2 * segments));
          position.x += nx * offset;
          position.z += nz * offset;
          position.y = i % 2 ? 3.5 : 4.22;
          return position;
        });
        const curve = new T.CatmullRomCurve3(points);
        world.add(new T.Mesh(new T.TubeGeometry(curve, segments * 6, 0.095, 5, false), wire));
        if (offset === 0) centerCurve = curve;
      }
      const clickArea = new T.Mesh(new T.TubeGeometry(centerCurve, segments * 5, 0.50, 5, false), hitMaterial);
      clickArea.userData.pick = { kind: "line", id: line.id };
      clickArea.userData.isCable = true;
      world.add(clickArea);
      hitObjects.push(clickArea);
      const arrow = new T.Mesh(shapes.cone, new T.MeshBasicMaterial({ color: 0xeaf4ff }));
      world.add(arrow);
      cables.set(line.id, { wire, arrow, curve: centerCurve, flow: 0, direction: 1 });
    }

    function setMap(nodes, lines) {
      const nextSignature = JSON.stringify([nodes, lines]);
      if (nextSignature === signature) return;
      const resetCamera = !layout || JSON.stringify(nodes.map(({ x, z }) => [x, z])) !== layout.positions;
      signature = nextSignature;
      for (const child of world.children) {
        if (!Object.values(shapes).includes(child.geometry)) child.geometry?.dispose();
        if (child.material !== hitMaterial) child.material?.dispose();
        if (child.isInstancedMesh) child.dispose();
      }
      world.clear();
      labels.replaceChildren();
      instances.clear();
      pins.length = 0;
      hitObjects.length = 0;
      cables.clear();

      const nodeMap = new Map(nodes.map((node) => [node.key, node]));
      const minX = Math.min(...nodes.map((node) => node.x));
      const maxX = Math.max(...nodes.map((node) => node.x));
      const minZ = Math.min(...nodes.map((node) => node.z));
      const maxZ = Math.max(...nodes.map((node) => node.z));
      const x = (minX + maxX) / 2;
      const z = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX + 25, maxZ - minZ + 25, 39);
      layout = { x, z, span, positions: JSON.stringify(nodes.map(({ x, z }) => [x, z])) };
      shape("box", 0x273e40, x, -1.25, z, maxX - minX + 31, 2.3, maxZ - minZ + 31);
      shape("box", 0x466859, x, -0.08, z, maxX - minX + 30, 0.22, maxZ - minZ + 30);
      for (let i = 0; i < 95; i++) {
        const px = minX - 12 + ((i * 37) % 97) / 97 * (maxX - minX + 24);
        const pz = minZ - 12 + ((i * 53) % 89) / 89 * (maxZ - minZ + 24);
        if (nodes.some((node) => Math.hypot(node.x - px, node.z - pz) < 6.5)) continue;
        const radius = 0.40 + (i % 5) * 0.17;
        shape("sphere", i % 3 ? 0x4c846c : 0x6b9278, px, 0.65, pz, radius, 0.84 + radius * 0.35, radius);
      }
      for (const node of nodes) {
        if (node.kind === "city") drawCity(node);
        else drawPlant(node);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "city-pin region-pin";
        button.dataset.site = node.key;
        const name = document.createElement("span");
        name.textContent = node.name;
        const reading = document.createElement("strong");
        button.append(name, reading);
        const target = { kind: node.kind, id: node.id };
        button.addEventListener("click", () => edit(target));
        button.addEventListener("contextmenu", (event) => { event.preventDefault(); edit(target); });
        labels.append(button);
        pins.push({ button, reading, position: new T.Vector3(node.x, node.kind === "city" ? 4.4 : 5.9, node.z), node });
      }
      for (const line of lines) overhead(line, nodeMap.get(line.from), nodeMap.get(line.to));
      for (const { type, color, transforms } of instances.values()) {
        const mesh = new T.InstancedMesh(shapes[type], new T.MeshLambertMaterial({ color }), transforms.length);
        transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        world.add(mesh);
      }
      if (resetCamera) changeCamera("reset");
      if (lastRows) update(lastRows);
      requestRender();
    }

    function update(row) {
      lastRows = row;
      for (const [id, cable] of cables) {
        const readings = row.lines[id];
        if (!readings) continue;
        cable.flow = readings.sent;
        cable.direction = readings.direction;
        cable.wire.color.setHex(readings.open ? 0x7b7776 : readings.sent > 0.001 ? 0x80c9ff : 0xa1b4bd);
      }
      for (const { node, reading } of pins) {
        const value = node.kind === "city" ? row.towns[node.key]?.served : row.plants[node.id]?.power;
        reading.textContent = value === undefined ? "" : Math.round(value).toLocaleString("fr-FR") + " kW";
      }
      requestRender();
    }

    function draw(now) {
      frame = 0;
      if (!width || !height || !inView) return;
      const animated = playing && !motion.matches;
      for (const cable of cables.values()) {
        cable.arrow.visible = cable.flow > 0.001;
        if (!cable.arrow.visible) continue;
        const travel = animated ? 0.15 + ((now / 2800) % 1) * 0.7 : 0.52;
        const t = cable.direction < 0 ? 1 - travel : travel;
        cable.curve.getPointAt(t, cable.arrow.position);
        cable.arrow.position.y += 0.26;
        cable.curve.getTangentAt(t, vector).multiplyScalar(cable.direction);
        cable.arrow.quaternion.setFromUnitVectors(up, vector);
      }
      renderer.render(scene, camera);
      for (const { button, position } of pins) {
        pinPosition.copy(position).project(camera);
        button.style.left = (1 + pinPosition.x) * width / 2 + "px";
        button.style.top = (1 - pinPosition.y) * height / 2 + "px";
        button.style.visibility = Math.abs(pinPosition.x) < 0.98 && Math.abs(pinPosition.y) < 0.95
          && Math.abs(pinPosition.z) < 1 ? "visible" : "hidden";
      }
      if (animated && [...cables.values()].some((cable) => cable.flow > 0.001)) requestRender();
    }

    function requestRender() {
      if (!frame && inView) frame = requestAnimationFrame(draw);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
      renderer.setSize(width, height, false);
      requestRender();
    }

    function changeCamera(action) {
      if (action === "reset") {
        if (!layout) return;
        const { x, z, span } = layout;
        const ratio = Math.max(1, 0.96 / camera.aspect);
        controls.target.set(x, 0, z);
        camera.position.set(x + span * 0.65 * ratio, span * 0.95 * ratio, z + span * 1.26 * ratio);
      } else if (action === "zoomIn" || action === "zoomOut") {
        vector.copy(camera.position).sub(controls.target);
        const scale = action === "zoomIn" ? 0.78 : 1.28;
        vector.setLength(Math.max(controls.minDistance, Math.min(controls.maxDistance, vector.length() * scale)));
        camera.position.copy(controls.target).add(vector);
      } else if (action === "rotate") {
        camera.position.sub(controls.target).applyAxisAngle(up, Math.PI / 4).add(controls.target);
      } else {
        const dx = action === "left" ? -1 : action === "right" ? 1 : 0;
        const dy = action === "up" ? 1 : action === "down" ? -1 : 0;
        const step = camera.position.distanceTo(controls.target) * 0.13;
        vector.set(dx * step, dy * step, 0).applyQuaternion(camera.quaternion);
        vector.y = 0;
        controls.target.add(vector);
        camera.position.add(vector);
      }
      controls.update();
      requestRender();
    }

    const ray = new T.Raycaster();
    const pointer = new T.Vector2();
    let pressed;
    const moved = (event) => pressed && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 6;
    function target(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / width * 2 - 1, 1 - (event.clientY - rect.top) / height * 2);
      ray.setFromCamera(pointer, camera);
      const hits = ray.intersectObjects(hitObjects);
      const direct = hits.find(({ object }) => !object.userData.isCable) ?? hits[0];
      if (direct) return direct.object.userData.pick;
      const { origin, direction } = ray.ray;
      const along = -origin.y / direction.y;
      return { kind: "ground", x: origin.x + direction.x * along, z: origin.z + direction.z * along };
    }
    canvas.addEventListener("pointerdown", (event) => { pressed = { x: event.clientX, y: event.clientY }; });
    canvas.addEventListener("pointerup", (event) => {
      if (event.button !== 0 || moved(event)) return;
      const pick = target(event);
      if (pick.kind !== "ground") edit(pick);
    });
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!moved(event)) edit(target(event));
    });
    new ResizeObserver(resize).observe(canvas);
    controls.addEventListener("change", requestRender);
    motion.addEventListener("change", requestRender);
    return {
      setMap, update, changeCamera,
      show(visible) {
        inView = visible;
        if (visible) { resize(); requestRender(); }
      },
      play(value) { playing = value; requestRender(); }
    };
  }

  globalThis.GridLabRegionScene = { create };
})();
