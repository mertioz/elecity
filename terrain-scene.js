(() => {
  "use strict";

  const terrain = globalThis.GridLabTerrain;

  function create({ canvas, labels, select, context, holdStart, holdCancel, inspectIssue, quote, plots = [], waterway = false }) {
    const T = globalThis.GridLabThree;
    if (!T) return null;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
    if (!gl) return null;
    const renderer = new T.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
    renderer.shadowMap.enabled = waterway;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(43, 1, 0.3, 6500);
    const controls = new T.OrbitControls(camera, canvas);
    controls.maxPolarAngle = 1.32;
    controls.minDistance = 24;
    controls.maxDistance = 3200;
    controls.screenSpacePanning = false;
    controls.zoomSpeed = 1.1;
    camera.position.set(98, 133, 158);
    controls.update();
    const sun = new T.DirectionalLight(0xffedcf, 2.05);
    sun.position.set(-100, 160, 50);
    const sky = new T.HemisphereLight(0xecf3f7, 0x77836a, 1.52);
    scene.add(sun, sky, sun.target);
    if (waterway) {
      sun.castShadow = true;
      sun.target.position.set(-66,0,6);
      Object.assign(sun.shadow.camera, { left:-218, right:218, top:194, bottom:-194, near:1, far:680 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.mapSize.set(2048,2048);
      sun.shadow.bias = -.00025;
      sun.shadow.normalBias = .095;
    }
    const contents = new T.Group();
    scene.add(contents);
    const geometries = {
      box: new T.BoxGeometry(1, 1, 1), roof: gable(),
      drum: new T.CylinderGeometry(1, 1, 1, 20),
      tower: new T.LatheGeometry([[1.05, -.5], [1.04, -.42], [.9, -.22], [.72, .06], [.65, .23],
        [.68, .38], [.77, .5], [.71, .5]].map(([r, y]) => new T.Vector2(r, y)), 32),
      globe: new T.SphereGeometry(1, 24, 14), hoop: new T.TorusGeometry(1, .055, 8, 40), arrow: new T.ConeGeometry(0.7, 2.6, 8)
    };
    const valleyBuildings = globalThis.GridLabValleyBuildings;
    if (valleyBuildings) Object.assign(geometries, { glassWall:geometries.box, glassRoof:valleyBuildings.greenhouseRoof(T),
      blade:valleyBuildings.turbineBlade(T), mast:new T.CylinderGeometry(.60,1,1,18), openTank:new T.CylinderGeometry(1,1,1,40,1,true) });
    const land = globalThis.GridLabValley;
    const elevation = (x,z) => waterway && land ? land.height(x,z) : 0;
    const floor = (node) => node.type === "water" ? 0 : elevation(node.x,node.z);
    const rotors=[], basins=[], trains=[], lamps=[], vapour=[];
    const movingMaterials = new Map();
    let lightingHour = -1;
    const up = new T.Vector3(0, 1, 0);
    const pinPosition = new T.Vector3();
    const arrowDirection = new T.Vector3();
    const hitMaterial = new T.MeshBasicMaterial({ visible: false });
    const selectionMaterial = new T.MeshBasicMaterial({ color: 0xf5d266, transparent: true, opacity: 0.40, depthWrite: false });
    const ring = new T.Mesh(new T.CylinderGeometry(1, 1, 0.035, 40), selectionMaterial);
    ring.visible = false;
    scene.add(ring);
    const ghost = new T.Mesh(
      new T.CylinderGeometry(1, 1, 0.055, 36),
      new T.MeshBasicMaterial({ color: 0xacf0ff, opacity: 0.5, transparent: true, depthWrite: false })
    );
    ghost.visible = false;
    scene.add(ghost);
    const guide = new T.Mesh(geometries.drum, new T.MeshBasicMaterial({ color: 0xadf1ff, transparent: true, opacity: 0.8 }));
    const rejected = new T.Mesh(geometries.drum, new T.MeshBasicMaterial({ color: 0xf35558 }));
    guide.visible = rejected.visible = false;
    scene.add(guide, rejected);
    const palette = new Map();
    const cableViews = new Map();
    const pins = [];
    const warnings = [];
    const hitObjects = [];
    const raycast = new T.Raycaster();
    const pointer = new T.Vector2();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let world;
    let width;
    let height;
    let frame = 0;
    let lastDraw = 0;
    let labelsDirty = true;
    let press;
    let preview;
    let linkOrigin;
    let linkMedium;
    let lastQuote;
    let failure;
    let ignoreLabel;
    let skipContextUntil = 0;
    let names = true;
    let lost = false;
    let modelScale = null;
    const largeModels = { pole: 1.25, house: 1.22, apartment: 1.48, office: 1.46, hospital: 1.50, nuclear: 1.48, thermal: 1.40, mill: 1.28 };
    const scaleOf = (type) => largeModels[type] ?? 1.24;
    const eastWest = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -Math.PI / 2);
    const frontBack = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2);
    const wheelPlane = new T.Quaternion().setFromAxisAngle(up, Math.PI / 2);

    function gable() {
      const shape = new T.BufferGeometry();
      shape.setAttribute("position", new T.Float32BufferAttribute([
        -.5, -.5, -.5, -.5, -.5, .5, -.5, .5, 0,
        .5, -.5, -.5, .5, -.5, .5, .5, .5, 0
      ], 3));
      shape.setIndex([0, 1, 2, 3, 5, 4, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2, 0, 3, 4, 0, 4, 1]);
      const faces = shape.toNonIndexed();
      faces.computeVertexNormals();
      shape.dispose();
      return faces;
    }

    function groundTexture() {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 128;
      const ctx = tile.getContext("2d");
      const image = ctx.createImageData(128, 128);
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          const n = ((x * 40813 ^ y * 42703 ^ (x * y * 19937)) >>> 4) % 29;
          const wave = Math.sin(x * Math.PI / 32) * Math.sin(y * Math.PI / 32) * 6;
          const at = (128 * y + x) * 4;
          image.data.set([98 + n + wave, 130 + n + wave, 69 + n + wave, 255], at);
        }
      }
      ctx.putImageData(image, 0, 0);
      const texture = new T.CanvasTexture(tile);
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.repeat.set(125, 125);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }

    const landscape = waterway ? globalThis.GridLabLandscape?.create(T, scene, renderer, plots) : undefined;
    if (!landscape) {
      const ground = new T.Mesh(new T.PlaneGeometry(4400, 4400), new T.MeshLambertMaterial({ map: groundTexture() }));
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
    }

    const lotGeo = new T.RingGeometry(0.76, 0.88, 32);
    lotGeo.rotateX(-Math.PI / 2);
    const shadowGeo = new T.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMaterial = landscape ? new T.MeshBasicMaterial({ map: contactTexture(), transparent: true, depthWrite: false, opacity: .66 }) : null;
    const mist = landscape ? steamTexture() : null;

    function steamTexture() {
      const image=document.createElement("canvas"); image.width=image.height=96;
      const ctx=image.getContext("2d");
      for (const [x,y,r] of [[48,51,42],[33,42,24],[58,40,27],[43,29,20]]) {
        const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
        gradient.addColorStop(0,"rgba(244,245,227,.60)"); gradient.addColorStop(.50,"rgba(231,233,222,.35)"); gradient.addColorStop(1,"rgba(218,229,227,0)");
        ctx.fillStyle=gradient; ctx.fillRect(0,0,96,96);
      }
      return new T.CanvasTexture(image);
    }

    function contactTexture() {
      const image = document.createElement("canvas");
      image.width = image.height = 64;
      const context = image.getContext("2d");
      const fade = context.createRadialGradient(32, 32, 2, 32, 32, 32);
      fade.addColorStop(0, "rgba(22,32,24,.8)");
      fade.addColorStop(.54, "rgba(22,32,24,.53)");
      fade.addColorStop(1, "rgba(22,32,24,0)");
      context.fillStyle = fade;
      context.fillRect(0, 0, 64, 64);
      return new T.CanvasTexture(image);
    }

    function theme(dark) {
      const tone = dark ? 0x304535 : 0x8caa82;
      scene.background = new T.Color(tone);
      scene.fog = new T.Fog(tone, 300, 2250);
      request();
    }

    function piece(kind, color, x, y, z, w, h, d, orientation = new T.Quaternion()) {
      if (modelScale) {
        const { root, scale } = modelScale;
        x = root.x + (x - root.x) * scale;
        z = root.z + (z - root.z) * scale;
        y = y * scale + modelScale.floor;
        w *= scale;
        h *= scale;
        d *= scale;
      }
      const lit = modelScale && [0x49616a,0x526c72,0x556e73,0x526971,0x50686e].includes(color) ? modelScale.root.id : "";
      const circuit=lit ? Math.abs(Math.round(x*6.2+y*8.9+z*7.4))%4 : 0;
      const key = kind + color + lit + circuit;
      if (!palette.has(key)) palette.set(key, { kind, color, lit, circuit, transforms: [] });
      palette.get(key).transforms.push(new T.Matrix4().compose(new T.Vector3(x, y, z), orientation, new T.Vector3(w, h, d)));
    }
    const box = (color, x, y, z, w, h, d) => piece("box", color, x, y, z, w, h, d);

    function beam(color, a, b, w) {
      const start=new T.Vector3(...a), end=new T.Vector3(...b), vec=end.clone().sub(start);
      const mid=start.lerp(end,.5), length=vec.length();
      piece("box",color,mid.x,mid.y,mid.z,w,length,w,new T.Quaternion().setFromUnitVectors(up,vec.normalize()));
    }
    function moving(node,x,y,z) {
      const group=new T.Group(), scale=scaleOf(node.type);
      group.position.set(node.x+(x-node.x)*scale,floor(node)+y*scale,node.z+(z-node.z)*scale);
      group.scale.setScalar(scale); contents.add(group); return group;
    }
    function part(group,kind,color,x,y,z,w,h,d,orientation) {
      if (!movingMaterials.has(color)) movingMaterials.set(color,new T.MeshLambertMaterial({ color,side:T.DoubleSide }));
      const mesh=new T.Mesh(geometries[kind],movingMaterials.get(color));
      mesh.position.set(x,y,z); mesh.scale.set(w,h,d);
      if (orientation) mesh.quaternion.copy(orientation);
      mesh.castShadow=mesh.receiveShadow=true; group.add(mesh);
    }

    function hit(id, kind, x, y, z, w, h, d) {
      const target = new T.Mesh(geometries.box, hitMaterial);
      target.userData.pick = { id, kind };
      target.position.set(x, y, z);
      target.scale.set(w, h, d);
      contents.add(target);
      hitObjects.push(target);
    }

    function building(x, z, w, d, h, wall, top) {
      box(0x73796a, x, .12, z, w + .25, .24, d + .25);
      box(wall, x, h / 2 + .18, z, w, h, d);
      if (top !== null) box(top, x, h + .245, z, w + .35, .20, d + .35);
      const columns = Math.floor(w / 2.25);
      const rows = Math.floor(d / 2.25);
      for (let y = 1.9; y + .6 < h; y += 2.5) {
        for (let i = 0; i < columns; i++) {
          const c = x + (i - (columns - 1) * .5) * 2.12;
          for (const side of [-1, 1]) box(0x49616a, c, y, z + side * (d / 2 + .025), 1.11, 1.07, .064);
        }
        for (let i = 0; i < rows; i++) {
          const r = z + (i - (rows - 1) * .5) * 2.10;
          for (const side of [-1, 1]) box(0x526c72, x + side * (w / 2 + .025), y, r, .064, 1.07, 1.11);
        }
      }
    }

    function draw(node) {
      const { x, z, type } = node;
      const extra=valleyBuildings?.draw(node,{T,box,piece,beam,building,moving,part,rotors,basins,trains,contents,horizontal:frontBack});
      if (extra !== undefined) return extra;
      switch (type) {
        case "starter":
          box(0x777b6c, x, .12, z, 10.5, .24, 8.6);
          box(0x38434a, x, .43, z, 9.0, .45, 6.4);
          box(0xc3a44f, x, 2.04, z, 8.8, 2.95, 6.2);
          box(0x3e4949, x, 3.54, z, 8.95, .17, 6.32);
          box(0x343d41, x + 1.65, 2.20, z + 3.12, 3.25, 1.26, .10);
          for (let i = 0; i < 4; i++) box(i === 0 ? 0xc68183 : 0x92bda1, x + .60 + i * .67, 2.25, z + 3.19, .29, .27, .085);
          for (let i = 0; i < 5; i++) box(0x535348, x - 2.2, 1.42 + i * .32, z + 3.112, 3.0, .12, .07);
          box(0x4c5353, x - 4.36, 1.88, z, .14, 1.85, 3.4);
          return 3.65;
        case "mill": {
          building(x, z, 12.2, 10, 6.5, 0xb6a786, null);
          piece("roof", 0x57453c, x, 8.10, z, 13.05, 3.13, 11.05);
          const y = 2.75;
          piece("drum", 0x555854, x - 7.1, y, z, .49, 2.65, .49, eastWest);
          const wheel=moving(node,x-7.5,y,z);
          rotors.push({group:wheel,id:node.id,axis:"x",factor:1,speed:0});
          for (const offset of [-.55,.55]) part(wheel,"hoop",0x75543b,offset,0,0,3.05,3.05,3.05,wheelPlane);
          for (let i = 0; i < 12; i++) {
            const angle = Math.PI * i / 6;
            const blade = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), angle);
            const radial = (radius) => [radius * Math.cos(angle),radius * Math.sin(angle)];
            const [yRim, zRim] = radial(2.99);
            part(wheel,"box",0x936d46,0,yRim,zRim,1.41,.37,.73,blade);
            if (!(i % 2)) {
              const [ySpoke, zSpoke] = radial(1.58);
              part(wheel,"box",0x79593e,-.56,ySpoke,zSpoke,.19,2.78,.28,blade);
            }
          }
          box(0x65513e, x, 1.23, z + 5.04, 1.37, 2.17, .12);
          for (const dx of [-5.8,-2.75,2.75,5.8]) box(0x6b5845,x+dx,3.29,z+5.08,.22,6.14,.17);
          beam(0x79634b,[x-5.56,2.8,z+5.13],[x-3.08,5.8,z+5.13],.16);
          return 9.68;
        }
        case "water":
          piece("drum", 0x535b51, x, .18, z, 1.92, .36, 1.92);
          piece("drum", 0x556b68, x, .67, z, 1.61, .67, 1.61);
          piece("drum", 0x8b9182, x, 1.03, z, 1.72, .17, 1.72);
          for (const a of [-1, 0, 1]) box(0x364948, x + a * .65, 1.123, z, .19, .032, 2.27);
          return 1.15;
        case "pump":
          box(0x787c70, x, .13, z, 10.65, .26, 8.4);
          building(x, z, 8.2, 5.8, 3.4, 0x91a49a, 0x415f60);
          box(0x58706b, x, 1.22, z + 2.94, 2.13, 2.35, .11);
          for (const dx of [-4.1, 4.1]) {
            piece("drum", 0x537d78, x + dx, .62, z, .49, 2.3, .49, eastWest);
            piece("drum", 0x879990, x + Math.sign(dx) * 4.75, .62, z, .62, .18, .62, eastWest);
          }
          return 3.75;
        case "pole":
          piece("drum", 0x8e9aa4, x, 6, z, 0.35, 12, 0.35);
          box(0x51636c, x, 11.85, z, landscape ? .37 : 4.4, .3, landscape ? 4.4 : .37);
          for (const offset of [-1.7, 0, 1.7]) {
            piece("drum", 0xaec7c2, x + (landscape ? 0 : offset), 12.2, z + (landscape ? offset : 0), .22,.52,.22);
          }
          return 13;
        case "house":
          box(0x74786a, x, .11, z, 8.7, .22, 7.60);
          box(0xd2c3aa, x, 1.82, z, 8.5, 3.32, 7.4);
          piece("roof", 0x8e5139, x, 4.44, z, 9.18, 1.96, 8.08);
          box(0xad8165,x-2.35,4.95,z-.83,.76,2.10,.78);
          box(0x74594a,x-2.35,6.03,z-.83,.90,.18,.91);
          for (const side of [-1, 1]) box(0x654c3d, x, 3.49, z + side * 4.03, 9.19, .13, .14);
          box(0xafa895, x + 2, 1.88, z + 3.73, 2.29, 1.4, .13);
          box(0x556e73, x + 2, 1.89, z + 3.81, 1.96, 1.12, .058);
          box(0x6a5a47, x - 1.65, 1.16, z + 3.74, 1.12, 2.01, .13);
          box(0x8b8779, x - 1.65, .11, z + 4.06, 1.47, .22, .72);
          for (const offset of [-1.8, 1.8]) box(0x526971, x + 4.27, 1.92, z + offset, .070, 1.13, 1.13);
          for (const dx of [-6.7,6.7]) for (const dz of [-4.8,-1.2,2.4,6]) box(0x897856,x+dx,.65,z+dz,.23,1.3,.23);
          for (const dx of [-6.7,6.7]) for (const h of [.52,.98]) box(0xa38e66,x+dx,h,z+.6,.14,.15,10.8);
          box(0xab9b80,x-1.62,.08,z+5.45,1.47,.15,3.1);
          return 6.18;
        case "apartment":
        case "office": {
          const office = type === "office";
          const h = office ? 16 : 18.3;
          building(x, z, 13.5, 11, h, office ? 0x95b7c0 : 0xd9c9ab, 0x607179);
          box(0x5f6e70, x, h + .88, z - 1.65, 4.3, 1.19, 3.7);
          box(0x939c91, x, h + 1.50, z - 1.65, 4.47, .13, 3.87);
          if (office) {
            box(0x465d64, x, 1.32, z + 5.8, 6.4, 2.65, 0.66);
            for (let level = 3.1; level < h - 1; level += 2.55) {
              box(0x495f76, x, level, z + 5.57, 11.9, 1.35, 0.14);
              for (const offset of [-3, 0, 3]) box(0xafc9cb, x + offset, level, z + 5.68, 0.085, 1.35, 0.08);
            }
          } else {
            box(0x667471, x, 1.35, z + 5.54, 2.38, 2.42, .12);
            for (let level = 2.94; level < h - 1.2; level += 2.5) for (const offset of [-3.16, 3.16]) {
              box(0x50686e, x + offset, level + .85, z + 5.54, 1.36, 1.63, .09);
              box(0xa8a397, x + offset, level, z + 6.05, 3.77, .23, 1.18);
              box(0x71847c, x + offset, level + .46, z + 6.59, 3.63, .71, .09);
              for (const side of [-1, 1]) box(0x71847c, x + offset + side * 1.77, level + .46, z + 6.08, .09, .71, 1.04);
            }
          }
          return h + 1.6;
        }
        case "hospital": {
          building(x, z - 2, 16, 12, 9.4, 0xe1e7dc, 0x6b9692);
          building(x - 11.3, z + 1.2, 7.5, 9, 5.8, 0xe9ebdd, 0x839a92);
          building(x + 11.1, z + 1.2, 7.1, 9, 5.8, 0xe9ebdd, 0x839a92);
          box(0x437079, x, 1.35, z + 4.22, 7.7, 2.55, 0.25);
          box(0x749d93, x, 2.85, z + 5.35, 10, 0.36, 3.0);
          for (const offset of [-4.1, 4.1]) box(0x959b89, x + offset, 1.36, z + 6.6, .25, 2.72, .25);
          box(0xe1e4d8, x, 5.35, z + 4.05, 3.5, 3.5, .14);
          box(0xa52d38, x, 5.35, z + 4.13, .69, 2.82, .03);
          for (const side of [-1, 1]) box(0xa52d38, x + side * .88, 5.35, z + 4.13, 1.075, .69, .03);
          box(0xd8dbce, x, 9.755, z - 2, 8.5, .035, 8.22);
          box(0xa52d38, x, 9.779, z - 2, 1.69, .020, 6.1);
          for (const side of [-1, 1]) box(0xa52d38, x + side * 1.9475, 9.779, z - 2, 2.205, .020, 1.69);
          return 9.80;
        }
        case "market":
        case "school":
        case "industry": {
          const colors = {
            market: [0xd6c1a5, 0xb37748], school: [0xddcda7, 0x738cba],
            industry: [0xadb8af, 0x626c74]
          };
          const [wall, top] = colors[type];
          const h = 5.8;
          building(x, z, 15, 12, h, wall, top);
          if (type === "industry") {
            piece("drum", 0x9da8a7, x - 4, 7.45, z - 2.8, 0.68, 3.2, 0.68);
            box(0x596f7b, x, 1.75, z + 6.2, 4.0, 3.4, .2);
          } else {
            box(top, x, 3.4, z + 6.6, 12.6, .35, 2.1);
            box(0x507376, x, 1.55, z + 6.04, type === "market" ? 10.2 : 3.9, 2.2, .20);
          }
          return h + (type === "industry" ? 3.2 : 0.6);
        }
        case "charger":
          box(0x586871, x, 0.12, z, 11, 0.24, 8.6);
          for (const offset of [-3.6, 0, 3.6]) {
            box(0xa3dcca, x + offset, 1.30, z - 2.6, 0.88, 2.6, 0.85);
            box(0xcee7d2, x + offset + 1.3, 0.26, z, 0.13, 0.04, 4.8);
          }
          return 2.7;
        case "solar": {
          const inclination = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -0.24);
          for (const a of [-9, -3, 3, 9]) for (const b of [-6, 0, 6]) {
            for (const side of [-1, 1]) {
              const height = 1.54 + side * .29;
              box(0x596769, x + a + side * 1.14, height / 2, z + b + side * 1.12, .21, height, .25);
            }
            piece("box", 0x5b6b6c, x + a, 1.67, z + b, 4.98, .15, 3.87, inclination);
            piece("box", 0x334f6a, x + a, 1.763, z + b - .025, 4.80, .06, 3.69, inclination);
            for (const off of [-1.6, 0, 1.6]) piece("box", 0x637a88, x + a + off, 1.8, z + b - .032, .025, .012, 3.69, inclination);
          }
          box(0x909c88, x + 11.8, .57, z + 5.3, 1.18, 1.14, 1.09);
          return 2.31;
        }
        case "nuclear":
        case "thermal": {
          const nuclear = type === "nuclear";
          box(0x83847b, x, .11, z, 29.3, .22, 24.7);
          building(x + 6.2, z + 4.8, 12.4, 9.1, 5.55, 0xb9bbae, 0x626d6b);
          box(0x778882, x + 6.2, 1.07, z + 9.42, 6.8, 1.96, .11);
          if (nuclear) {
            piece("drum", 0x9d9d8f, x + 5.3, .31, z - 5.85, 5.10, .47, 5.10);
            piece("drum", 0xc7c4ac, x + 5.3, 3.94, z - 5.85, 4.64, 7.42, 4.64);
            piece("globe", 0xc7c4ac, x + 5.3, 7.61, z - 5.85, 4.64, 3.0, 4.64);
            box(0xa1aa9b, x + 5.1, 1.21, z - .76, 2.38, 2.16, 2.83);
            for (const side of [-5.65, 5.65]) {
              piece("drum", 0x94988a, x - 8.55, .35, z + side, 4.17, .56, 4.17);
              piece("tower", 0xbebdad, x - 8.55, 7.54, z + side, 3.78, 14.04, 3.78);
              piece("drum", 0x545d58, x - 8.55, 14.1, z + side, 2.70, .12, 2.70);
              piece("hoop", 0xa5a99a, x - 8.55, 14.55, z + side, 2.81, 2.81, 2.0, frontBack);
              if (mist) for (let i=0;i<4;i++) {
                const sprite=new T.Sprite(new T.SpriteMaterial({map:mist,transparent:true,depthWrite:false,opacity:0}));
                const scale=scaleOf(type);
                const base=new T.Vector3(x-8.55*scale,floor(node)+14.55*scale,z+side*scale);
                contents.add(sprite); vapour.push({sprite,base,phase:i/4+(side>0 ? .08 : 0),id:node.id,power:0});
              }
            }
            box(0x657b73, x - 10.95, .62, z, 3.9, .84, 2.04);
            piece("drum", 0x547871, x - 13.13, .55, z, .55, 1.96, .55, eastWest);
          } else {
            for (const offset of [-7, -3]) {
              piece("drum", 0xa79c8d, x + offset, 7.2, z - 5, 1.0, 14.4, 1.0);
              for (const band of [10.2, 13.2]) piece("drum", 0xb56556, x + offset, band, z - 5, 1.015, 1.15, 1.015);
            }
            piece("drum", 0xc4bfae, x - 7.8, 1.9, z + 2.7, 2.6, 3.8, 2.6);
          }
          return 14.75;
        }
        case "battery":
          box(0x797d74, x, .115, z, 14.6, .23, 14.1);
          for (const offset of [-4.7, 0, 4.7]) {
            box(0x9a9e9d, x, 1.61, z + offset, 12.4, 2.84, 3.5);
            box(0x656d74, x, 3.07, z + offset, 12.58, .17, 3.62);
            box(0x65747b, x + 6.23, 1.51, z + offset, .10, 2.20, 2.28);
            for (let i = 0; i < 6; i++) box(0x657279, x - 3.52 + i * .59, 1.68, z + offset + 1.762, .14, 1.65, .055);
          }
          return 3.2;
        default:
          box(0x757c71, x, .115, z, 12.35, .23, 11.4);
          building(x, z + .75, 10.45, 8.05, 3.65, 0xa1afa3, type === "grid" ? 0x627da3 : 0x527562);
          box(0x718378, x, 1.23, z + 4.812, 2.2, 2.23, .12);
          for (const offset of [-3, 3]) {
            box(0x687d76, x + offset, .67, z - 4.42, 1.35, 1.13, 1.15);
            piece("drum", 0xa5beb3, x + offset, 2.77, z - 4.42, .225, 3.31, .225);
            for (const band of [3.72, 4.00, 4.28]) piece("drum", 0x637a71, x + offset, band, z - 4.42, .39, .09, .39);
          }
          return 4.5;
      }
    }

    function attachment(node, other, medium) {
      const delta = new T.Vector3(other.x - node.x, 0, other.z - node.z);
      const scale = scaleOf(node.type);
      const y0=floor(node);
      if (landscape && medium === "water" && node.type === "nuclear") return new T.Vector3(node.x - 13.8 * scale, y0+.55 * scale, node.z);
      if (landscape && medium === "water" && node.type === "pump") {
        return new T.Vector3(node.x + Math.sign(delta.x) * 4.77 * scale, y0+.62 * scale, node.z);
      }
      if (landscape && node.type === "station" && other.type === "pole") return new T.Vector3(node.x+3.2*scale,y0+5.58*scale,node.z-3.8*scale);
      delta.setLength(Math.min(delta.length() * 0.23, node.type === "pole" ? 0 : terrain.catalog[node.type].radius * scale * 0.52));
      const y = medium === "water" ? .62 : (node.type === "pole" ? 12.4 : landscape ? .78 : 2.65) * scale;
      return new T.Vector3(node.x + delta.x, y0 + y, node.z + delta.z);
    }

    function segment(mesh, a, b) {
      const axis = b.clone().sub(a);
      mesh.position.copy(a).lerp(b, 0.5);
      mesh.scale.set(.34, axis.length(), .34);
      if (axis.lengthSq() > .01) mesh.quaternion.setFromUnitVectors(up, axis.normalize());
    }

    function issueButton(target, position, name) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "issue-marker";
      button.textContent = "!";
      button.setAttribute("aria-label", "Alerte : " + name);
      button.title = "Afficher l’alerte";
      button.dataset.issue = target.id ?? target.code;
      button.hidden = true;
      button.addEventListener("click", () => inspectIssue(target));
      button.addEventListener("contextmenu", (event) => event.preventDefault());
      labels.append(button);
      const entry = { button, position, target };
      warnings.push(entry);
      return entry;
    }

    function clearFault() {
      if (!failure) return;
      failure.button.remove();
      warnings.splice(warnings.indexOf(failure), 1);
      failure = undefined;
      rejected.visible = false;
      request();
    }

    function flagLink(from, to, code, medium) {
      clearFault();
      const a = attachment(from, to, medium);
      const b = from.id === to.id ? a.clone().add(new T.Vector3(0, 7, 0)) : attachment(to, from, medium);
      segment(rejected, a, b);
      rejected.visible = true;
      failure = issueButton({ kind: "fault", code }, a.clone().lerp(b, .5).add(new T.Vector3(0, 3, 0)),
        terrain.diagnostics[code].title);
      failure.button.hidden = false;
      request();
    }

    function drawCable(line, start, finish) {
      const water = line.medium === "water";
      const a = attachment(start, finish, line.medium);
      const b = attachment(finish, start, line.medium);
      const mid = a.clone().lerp(b, 0.5);
      const buried = Boolean(landscape && !water && start.type !== "pole" && finish.type !== "pole");
      if (!water) mid.y = Math.max(elevation(mid.x,mid.z)+1.0, mid.y-Math.min(3.2,a.distanceTo(b)*.038));
      const path = [a];
      if (buried || (landscape && water)) {
        const sections = Math.max(2,Math.ceil(a.distanceTo(b)/3));
        for (let i=1;i<sections;i++) {
          const p=a.clone().lerp(b,i/sections);
          p.y=Math.max(water ? .22 : .36,elevation(p.x,p.z)+(water ? .48 : .36));
          path.push(p);
        }
      } else path.push(mid);
      path.push(b);
      const curve = new T.CatmullRomCurve3(path);
      const tangent = b.clone().sub(a);
      const across = new T.Vector3(-tangent.z, 0, tangent.x).normalize();
      const material = new T.MeshBasicMaterial({ color: 0x849396 });
      for (const offset of water || buried ? [0] : [-1.65, 0, 1.65]) {
        const shift = across.clone().multiplyScalar(offset);
        const wire = offset === 0 ? curve : new T.CatmullRomCurve3(path.map((p)=>p.clone().add(shift)));
        contents.add(new T.Mesh(new T.TubeGeometry(wire, Math.max(24,path.length), water ? .45 : buried ? .20 : .13, water ? 8 : 5, false), material));
      }
      const meter = new T.Mesh(new T.TubeGeometry(curve, 22, 2.0, 5, false), hitMaterial);
      meter.userData.pick = { id: line.id, kind: "cable" };
      contents.add(meter);
      hitObjects.push(meter);
      const arrows = Array.from({ length: Math.max(1, Math.min(6, Math.ceil(a.distanceTo(b) / 25))) }, () => {
        const arrow = new T.Mesh(geometries.arrow, new T.MeshBasicMaterial({ color: water ? 0xb3fffa : 0xe9fcff }));
        contents.add(arrow);
        return arrow;
      });
      cableViews.set(line.id, { curve, material, arrows, direction: 0, water });
      issueButton({ kind: "cable", id: line.id }, curve.getPointAt(.52).add(new T.Vector3(0, 3, 0)), line.name);
    }

    function setWorld(next, recenter = false) {
      world = next;
      const shared = new Set([...Object.values(geometries), lotGeo, shadowGeo]);
      for (const child of contents.children) {
        if (!child.isSprite && !shared.has(child.geometry)) child.geometry?.dispose();
        if (child.material !== hitMaterial && child.material !== shadowMaterial) child.material?.dispose();
        if (child.isInstancedMesh) child.dispose();
      }
      contents.clear();
      clearFault();
      labels.replaceChildren();
      pins.length = 0;
      warnings.length = 0;
      hitObjects.length = 0;
      rotors.length=basins.length=trains.length=lamps.length=vapour.length=0;
      palette.clear();
      cableViews.clear();
      const nodes = new Map(world.nodes.map((node) => [node.id, node]));
      landscape?.clearFootprints(world.nodes, scaleOf);
      for (const node of world.nodes) {
        const scale = scaleOf(node.type);
        const y0=floor(node);
        modelScale = { root: node, scale, floor:y0 };
        const height = draw(node) * scale;
        modelScale = null;
        const radius = terrain.catalog[node.type].radius * scale;
        if (shadowMaterial && node.type !== "water") {
          const shadow = new T.Mesh(shadowGeo, shadowMaterial);
          shadow.position.set(node.x + height * .15, y0+.036, node.z + height * .10);
          shadow.scale.set(radius * 2.15 + height * .36, 1, radius * 1.8 + height * .22);
          contents.add(shadow);
        }
        const hitWidth = node.type === "hospital" ? 32 * scale : radius * 1.85;
        const hitDepth = node.type === "hospital" ? 17 * scale : radius * 1.65;
        hit(node.id, "node", node.x, y0+height / 2, node.z, hitWidth, height + 0.45, hitDepth);
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "world-pin";
        pin.textContent = node.name;
        pin.dataset.node = node.id;
        pin.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          pin.setPointerCapture(event.pointerId);
          preparePress(event, { kind: "node", id: node.id }, false);
        });
        pin.addEventListener("click", () => {
          if (ignoreLabel?.id === node.id && performance.now() < ignoreLabel.until) return;
          select({ kind: "node", id: node.id });
        });
        pin.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          if (!press?.held) context({ kind: "node", id: node.id }, event.clientX, event.clientY);
        });
        labels.append(pin);
        pins.push({ pin, node, position: new T.Vector3(node.x, y0+height + 1.7, node.z) });
        issueButton({ kind: "node", id: node.id }, new T.Vector3(node.x - radius * .36, y0+height + 5.0, node.z), node.name);
      }
      for (const line of world.cables) drawCable(line, nodes.get(line.from), nodes.get(line.to));
      for (const plot of plots) {
        if (nodes.has(plot.id) || (plot.requires && !nodes.has(plot.requires))) continue;
        const y0=elevation(plot.x,plot.z);
        const radius = terrain.catalog[plot.type].radius * 1.12;
        const pad = new T.Mesh(lotGeo, new T.MeshBasicMaterial({ color: 0xe6d6a7, transparent: true, opacity: .7, depthWrite: false }));
        pad.position.set(plot.x, y0+.105, plot.z);
        pad.scale.set(radius, 1, radius);
        contents.add(pad);
        hit(plot.id, "lot", plot.x, y0+.21, plot.z, radius * 1.7, .42, radius * 1.65);
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "world-pin plot-pin";
        pin.textContent = "+";
        pin.title = plot.name;
        pin.setAttribute("aria-label","Emplacement · "+plot.name);
        pin.dataset.lot = plot.id;
        pin.addEventListener("click", () => select({ kind: "lot", id: plot.id }));
        labels.append(pin);
        pins.push({ pin, position: new T.Vector3(plot.x, y0+.50, plot.z) });
      }
      for (const { kind, color, transforms, lit, circuit } of palette.values()) {
        const glass = kind === "glassRoof" || kind === "glassWall";
        const material = new T.MeshLambertMaterial({ color, transparent:glass, opacity:glass ? .35 : 1, depthWrite:!glass,
          side:glass || kind === "openTank" ? T.DoubleSide : T.FrontSide });
        const mesh = new T.InstancedMesh(geometries[kind], material, transforms.length);
        if (lit) lamps.push({id:lit,material,circuit});
        mesh.castShadow = !glass; mesh.receiveShadow = true;
        transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        contents.add(mesh);
      }
      if (recenter) cameraAction("reset");
      renderer.shadowMap.needsUpdate = true;
      request();
    }

    function update(row,last) {
      if (landscape) lightVillage(row,last);
      for (const [id, view] of cableViews) {
        const line = row.cables[id];
        view.direction = line.direction;
        view.material.color.setHex(line.issues.length ? 0xf3494f
          : view.water ? (line.sent > 0.001 ? 0x46deeb : 0x398cb1)
            : (line.sent > 0.001 ? 0x83d8ff : 0x9da5a7));
      }
      for (const { pin, node } of pins) {
        if (!node) continue;
        const meter = row.nodes[node.id];
        pin.classList.toggle("powered", meter.voltage > 0.01 || meter.waterFlow > 0.01);
      }
      for (const { button, target } of warnings) {
        if (target.kind === "fault") continue;
        const reading = target.kind === "cable" ? row.cables[target.id] : row.nodes[target.id];
        button.hidden = !reading?.issues.length;
      }
      request();
    }

    function lightVillage(row,last) {
      const arc=Math.sin((row.hour-6)*Math.PI/12), day=Math.max(0,arc);
      if (lightingHour !== row.hour) {
        lightingHour=row.hour;
        const twilight=1-land.ramp(.0,.55,Math.abs(arc));
        sun.intensity=.23+2.12*day+.42*twilight;
        sun.color.setHex(arc<-.15?0x9bb9df:twilight>.38?0xffc290:0xffe7bb);
        const a=(row.hour-6)*Math.PI/12;
        sun.position.set(-60+Math.cos(a)*240,95+day*195,116+60*Math.sin(a-.4));
        sky.intensity=.59+day*.83+twilight*.20;
        sky.color.setHex(arc<0?0xb4cae6:0xe5f0f4);
        scene.background.setHex(arc<-.15?0x50677a:twilight>.38?0xb7b29c:0xa5bdba);
        scene.fog.color.copy(scene.background);
        landscape.daylight(Math.min(1,day+twilight*.38));
        renderer.shadowMap.needsUpdate=true;
      }
      for (const lamp of lamps) {
        const m=row.nodes[lamp.id];
        const powered=m.voltage>0 && (m.demand===0 || m.received>=m.demand*.65);
        const lit=powered && day<.40 && (lamp.id==="hospital" || (lamp.circuit+Math.floor(row.hour/3))%4!==0);
        lamp.material.emissive.setHex(lit ? (lamp.circuit%2?0xf9c47e:0xeab779) : 0x000000);
        lamp.material.emissiveIntensity=lit?(1-day)*(.48+.065*lamp.circuit):0;
      }
      for (const rotor of rotors) {
        const m=row.nodes[rotor.id];
        rotor.speed=rotor.axis==="x"?Math.min(1.0,m.generated*.17):m.available>0?rotor.factor*row.wind*.11:0;
      }
      for (const basin of basins) {
        const ratio=Math.min(1,Math.max(0,row.nodes[basin.id].soc/basin.capacity));
        basin.group.position.y=basin.base+basin.range*(.08+(basin.upper?ratio:1-ratio));
      }
      landscape.wheelFlow(row.nodes.mill?.generated??0);
      for (const puff of vapour) puff.power=Math.min(1,row.nodes[puff.id].generated/32);
      for (const train of trains) {
        if (train.tick!==row.tick) {
          train.depart=last?.freight>0 && [8,20].includes(row.hour) ? performance.now() : null;
          train.tick=row.tick;
        }
        train.loading=terrain.freightLoading(row.hour);
      }
    }

    function render(now) {
      frame = 0;
      if (!width || !height || lost || document.hidden) return;
      if (!labelsDirty && now - lastDraw < 28) { schedule(); return; }
      const delta=Math.min(.12,Math.max(0,(now-lastDraw)/1000));
      lastDraw = now;
      let moving = Boolean(landscape);
      landscape?.animate(motion.matches ? 0 : now / 1000);
      if (!motion.matches) for (const rotor of rotors) rotor.group.rotation[rotor.axis]+=rotor.speed*delta;
      for (const puff of vapour) {
        const t=((motion.matches?0:now/9000)+puff.phase)%1;
        puff.sprite.visible=puff.power>.005;
        if (!puff.sprite.visible) continue;
        puff.sprite.position.copy(puff.base);
        puff.sprite.position.x+=t*t*8; puff.sprite.position.y+=t*(10+puff.power*8);
        puff.sprite.position.z+=Math.sin(t*4+puff.phase)*1.3;
        puff.sprite.scale.setScalar(3+t*9); puff.sprite.material.opacity=Math.sin(t*Math.PI)*Math.sqrt(puff.power)*.58;
      }
      for (const train of trains) {
        const leaving=Number.isFinite(train.depart) && !motion.matches, progress=leaving?Math.max(0,(now-train.depart)/8500):0;
        train.group.visible=train.loading || (leaving && progress<1);
        if (!train.group.visible) continue;
        const x=train.x-112*progress*progress,z=land.tracksAt(x);
        train.group.position.set(x,land.surface(x,z)+.46,z);
        train.group.rotation.y=-Math.atan2(land.tracksAt(x+1)-z,1);
      }
      for (const view of cableViews.values()) {
        const enabled = view.direction !== 0;
        if (enabled) moving = true;
        view.arrows.forEach((arrow, index) => {
          arrow.visible = enabled;
          if (!enabled) return;
          const offset = motion.matches ? 0.5 : (now / 3800) % 1;
          const phase = 0.065 + 0.87 * ((index / view.arrows.length + offset) % 1);
          const t = view.direction > 0 ? phase : 1 - phase;
          view.curve.getPointAt(t, arrow.position);
          arrow.position.y += 0.65;
          view.curve.getTangentAt(t, arrowDirection).multiplyScalar(view.direction);
          arrow.quaternion.setFromUnitVectors(up, arrowDirection);
        });
      }
      renderer.render(scene, camera);
      if (labelsDirty) layoutLabels();
      if (moving && !motion.matches) schedule();
    }

    function layoutLabels() {
      labelsDirty = false;
      const taken = [];
      for (const { pin, position } of pins) {
        pinPosition.copy(position).project(camera);
        const x = (pinPosition.x + 1) * width / 2;
        const y = (1 - pinPosition.y) * height / 2;
        const onscreen = names && pinPosition.z > -1 && pinPosition.z < 1 && x > 25 && x < width - 25 && y > 48 && y < height - 42;
        const twin = taken.some(([px, py]) => Math.abs(px - x) < 82 && Math.abs(py - y) < 19);
        pin.style.visibility = onscreen && !twin ? "visible" : "hidden";
        if (onscreen && !twin) taken.push([x, y]);
        pin.style.left = x + "px";
        pin.style.top = y + "px";
      }
      for (const { button, position } of warnings) {
        if (button.hidden) continue;
        pinPosition.copy(position).project(camera);
        const x = (pinPosition.x + 1) * width / 2;
        const y = (1 - pinPosition.y) * height / 2;
        button.style.visibility = Math.abs(pinPosition.z) < 1 && x > 15 && x < width - 15 && y > 45 && y < height - 45 ? "visible" : "hidden";
        button.style.left = x + "px";
        button.style.top = y + "px";
      }
    }

    function schedule() {
      if (!frame && !lost && !document.hidden) frame = requestAnimationFrame(render);
    }

    function request() {
      labelsDirty = true;
      schedule();
    }

    function resize() {
      const size = canvas.getBoundingClientRect();
      width = size.width;
      height = size.height;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(1.7, devicePixelRatio || 1));
      renderer.setSize(width, height, false);
      request();
    }

    function cameraAction(action, target) {
      if (action === "focus" && target) {
        const off = camera.position.clone().sub(controls.target);
        off.setLength(Math.min(140, Math.max(45, off.length())));
        controls.target.set(target.x, elevation(target.x,target.z)+3, target.z);
        camera.position.copy(controls.target).add(off);
      } else if ((action === "reset" || action === "plateau") && landscape) {
        const high=action === "plateau", x=high?-183:-21, z=high?12:5;
        const ratio=Math.max(1,1.30/camera.aspect)*(high?1.18:1);
        controls.target.set(x,elevation(x,z)+2.8,z);
        camera.position.set(x+105*ratio,controls.target.y+116*ratio,z+142*ratio);
      } else if (action === "reset") {
        const coords = [...(world?.nodes ?? []), ...plots];
        const x = coords.length ? (Math.max(...coords.map((n) => n.x)) + Math.min(...coords.map((n) => n.x))) / 2 : 0;
        const z = coords.length ? (Math.max(...coords.map((n) => n.z)) + Math.min(...coords.map((n) => n.z))) / 2 : 0;
        const span = Math.max(114, ...coords.map((n) => Math.hypot(n.x - x, n.z - z) * 2 + 50));
        const ratio = Math.max(1, 0.86 / camera.aspect);
        controls.target.set(x, 0, z);
        camera.position.set(x + span * 0.62 * ratio, span * 0.95 * ratio, z + span * 1.11 * ratio);
      } else if (action === "in" || action === "out") {
        const off = camera.position.clone().sub(controls.target);
        off.setLength(Math.max(controls.minDistance, Math.min(controls.maxDistance, off.length() * (action === "in" ? 0.78 : 1.28))));
        camera.position.copy(controls.target).add(off);
      } else {
        const off = new T.Vector3(action === "left" ? -1 : action === "right" ? 1 : 0,
          action === "up" ? 1 : action === "down" ? -1 : 0, 0)
          .multiplyScalar(camera.position.distanceTo(controls.target) * 0.12).applyQuaternion(camera.quaternion);
        off.y = 0;
        camera.position.add(off);
        controls.target.add(off);
      }
      controls.update();
      request();
    }

    function hitAt(event, groundOnly = false, preferNode = false) {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / width * 2 - 1, 1 - (event.clientY - rect.top) / height * 2);
      raycast.setFromCamera(pointer, camera);
      const { origin, direction } = raycast.ray;
      const offset = -origin.y / direction.y;
      const falling = offset > 0 && direction.y < -0.00001;
      const coords = falling ? { x: Math.round(origin.x + direction.x * offset), z: Math.round(origin.z + direction.z * offset) } : null;
      const hits = groundOnly ? [] : raycast.intersectObjects(hitObjects);
      const preferred = preferNode ? hits.find(({ object }) => object.userData.pick.kind === "node") : null;
      const target = (preferred ?? hits[0])?.object.userData.pick;
      return { ...(target ?? { kind: "ground" }), position: coords };
    }

    function setPreview(type) {
      preview = type;
      ghost.visible = false;
      canvas.classList.toggle("placing", Boolean(type));
      request();
    }

    function targetAt(event) {
      const target = hitAt(event, false, Boolean(linkOrigin));
      if (!linkOrigin) return target;
      const pin = document.elementsFromPoint(event.clientX, event.clientY).find((element) => element.matches(".world-pin"));
      return pin ? { ...target, kind: "node", id: pin.dataset.node } : target;
    }

    function updateGuide(event) {
      if (!linkOrigin) return;
      const destination = targetAt(event);
      const node = destination.kind === "node" ? world.nodes.find(({ id }) => id === destination.id) : null;
      const endpoint = node ?? destination.position;
      const medium = linkMedium || (node ? terrain.connectionMedium(world, linkOrigin.id, node.id)
        : linkOrigin.type === "water" ? "water" : "electric");
      const issue = node && terrain.connectionIssue(world, linkOrigin.id, node.id, medium);
      const cost = node && !issue ? terrain.cablePrice(world, linkOrigin.id, node.id, medium) : null;
      if (lastQuote !== cost) {
        lastQuote = cost;
        quote(cost);
      }
      guide.visible = Boolean(endpoint);
      if (endpoint) {
        const start = attachment(linkOrigin, endpoint, medium);
        const end = node ? attachment(node, linkOrigin, medium) : new T.Vector3(endpoint.x, 0.6, endpoint.z);
        guide.visible = start.distanceToSquared(end) > 0.5;
        guide.material.color.setHex(issue ? 0xf35558 : medium === "water" ? 0x46deeb : 0xadf1ff);
        segment(guide, start, end);
      }
      request();
    }

    function previewLink(node, medium) {
      linkOrigin = node;
      linkMedium = medium;
      lastQuote = undefined;
      guide.visible = false;
      canvas.classList.toggle("connecting", Boolean(node));
      request();
    }

    function preparePress(event, target, onCanvas) {
      if (press) clearTimeout(press.timer);
      const intent = {
        id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button,
        source: target.kind === "node" ? target.id : undefined, moved: false, held: false, onCanvas
      };
      press = intent;
      if (event.button !== 0 || !intent.source || preview || linkOrigin) return;
      intent.timer = setTimeout(() => {
        if (press !== intent || intent.moved || !holdStart(intent.source)) return;
        intent.held = true;
        controls.enabled = false;
      }, 360);
    }

    function registerMovement(event) {
      if (!press || press.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 5) return;
      press.moved = true;
      if (!press.held) clearTimeout(press.timer);
      if (press.button === 2) skipContextUntil = performance.now() + 350;
    }

    canvas.addEventListener("pointerdown", (event) => {
      preparePress(event, hitAt(event, Boolean(preview), true), true);
    }, true);
    window.addEventListener("pointermove", (event) => {
      registerMovement(event);
      if (linkOrigin && (event.target === canvas || event.target.closest?.(".world-pin") || press?.held)) updateGuide(event);
    }, true);
    window.addEventListener("pointerup", (event) => {
      if (!press || press.id !== event.pointerId) return;
      registerMovement(event);
      const intent = press;
      press = undefined;
      clearTimeout(intent.timer);
      if (intent.held) {
        controls.enabled = true;
        if (!intent.onCanvas) ignoreLabel = { id: intent.source, until: performance.now() + 350 };
        const target = targetAt(event);
        if (target.kind === "node" && (target.id !== intent.source || intent.moved)) select(target);
      } else if (intent.onCanvas && intent.button === 0 && !intent.moved) {
        select(preview ? hitAt(event, true) : targetAt(event));
      }
    }, true);
    function cancelPress() {
      if (!press) return;
      clearTimeout(press.timer);
      if (press.held) {
        controls.enabled = true;
        holdCancel();
      }
      press = undefined;
    }
    window.addEventListener("pointercancel", cancelPress);
    window.addEventListener("blur", cancelPress);
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!press?.held && performance.now() >= skipContextUntil) context(hitAt(event), event.clientX, event.clientY);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!preview) return;
      const hovered = hitAt(event, true).position;
      ghost.visible = Boolean(hovered);
      if (hovered) {
        ghost.position.set(hovered.x, 0.06, hovered.z);
        const radius = terrain.catalog[preview].radius * scaleOf(preview);
        ghost.scale.set(radius, 1, radius);
      }
      request();
    });
    canvas.addEventListener("pointerleave", () => { ghost.visible = false; if (!press?.held) guide.visible = false; request(); });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      canvas.dispatchEvent(new CustomEvent("terrain-unavailable"));
    });
    new ResizeObserver(resize).observe(canvas);
    controls.addEventListener("change", request);
    document.addEventListener("visibilitychange", request);
    motion.addEventListener("change", request);
    resize();
    return {
      setWorld, update, theme, cameraAction, setPreview, previewLink, flagLink, clearFault,
      pick(mark) {
        ring.visible = Boolean(mark);
        if (mark) {
          const radius = terrain.catalog[mark.type].radius * scaleOf(mark.type) * 0.98;
          ring.position.set(mark.x, 0.07, mark.z);
          ring.scale.set(radius, 1, radius);
        }
        request();
      },
      showNames(visible) { names = visible; request(); }
    };
  }

  globalThis.GridLabGroundScene = { create };
})();
