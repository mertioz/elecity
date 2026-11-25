(() => {
  "use strict";

  const land = globalThis.GridLabValley;
  const center = land.riverX;
  const width = land.riverWidth;
  const hash = (x, z) => {
    const n = Math.imul(x, 1597334677) ^ Math.imul(z, 3812015801);
    return ((Math.imul(n ^ (n >>> 16), 0x45d9f3b) ^ (n >>> 13)) >>> 0) / 4294967296;
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  function noise(x, z) {
    const a = Math.floor(x);
    const b = Math.floor(z);
    const s = smooth(x - a);
    const t = smooth(z - b);
    return mix(mix(hash(a, b), hash(a + 1, b), s), mix(hash(a, b + 1), hash(a + 1, b + 1), s), t);
  }

  function groundMap(T, renderer) {
    const tile = document.createElement("canvas");
    const size = tile.width = tile.height = 512;
    const ctx = tile.getContext("2d");
    const pixels = ctx.createImageData(size, size);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      const patch = noise(x / 33, z / 33) * 21 + noise(x / 7, z / 7) * 10 + hash(x, z) * 16;
      pixels.data.set([88 + patch, 112 + patch, 60 + patch * .69, 255], (z * size + x) * 4);
    }
    ctx.putImageData(pixels, 0, 0);
    const texture = new T.CanvasTexture(tile);
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(44, 44);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function river(T) {
    const vertices = [];
    const uv = [];
    const faces = [];
    for (let row = 0; row <= 800; row++) {
      const z = row * 4 - 1600;
      const half = width(z) + 2.55;
      const origin = center(z);
      vertices.push(origin - half, .14, z, origin + half, .14, z);
      uv.push(0, z, 1, z);
      if (row) {
        const i = row * 2;
        faces.push(i - 2, i, i - 1, i - 1, i, i + 1);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(faces);
    const material = new T.ShaderMaterial({
      uniforms: { flowTime: { value: 0 }, daylight: { value: 1 }, wheelFlow: { value: 0 } },
      vertexShader: `
        varying vec2 bank;
        varying vec3 world;
        void main() {
          bank = uv;
          world = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: `
        uniform float flowTime;
        uniform float daylight;
        uniform float wheelFlow;
        varying vec2 bank;
        varying vec3 world;
        float rand(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 q) {
          vec2 p = floor(q), f = fract(q);
          vec2 v = f * f * (3.0 - 2.0 * f);
          return mix(mix(rand(p), rand(p + vec2(1., 0.)), v.x), mix(rand(p + vec2(0., 1.)), rand(p + 1.), v.x), v.y);
        }
        void main() {
          vec2 p = world.xz;
          float distanceToEdge = 1.0 - abs(bank.x * 2.0 - 1.0);
          float irregular = noise(p * .38) * .046 + noise(p * .12) * .042;
          float depth = smoothstep(.12, .67, distanceToEdge + irregular);
          vec2 current = p - vec2(.0, flowTime * 1.9);
          float w1 = dot(p, vec2(.84, .42)) - flowTime * 1.42 + noise(current * .08) * 3.1;
          float w2 = dot(p, vec2(-1.23, .63)) - flowTime * 1.91 + noise(current * .19) * 2.0;
          float w3 = dot(current, vec2(2.24, .86));
          vec2 slope = vec2(.056, .037) * cos(w1) + vec2(-.038, .044) * cos(w2) + vec2(.026, .018) * cos(w3);
          vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
          vec3 view = normalize(cameraPosition - world);
          vec3 sun = normalize(vec3(-.48, .76, .30));
          float reflection = .035 + pow(1.0 - max(0., dot(normal, view)), 3.25) * .83;
          float specular = pow(max(dot(normal, normalize(view + sun)), 0.), 80.0);
          float ripple = noise(vec2(current.x * .29, current.y * .84) + slope * 4.);
          float stones = noise(p * 2.6 + slope * 3.);
          vec3 shallows = vec3(.118, .175, .125) + stones * vec3(.058, .064, .041);
          vec3 pool = vec3(.020, .120, .135) + ripple * vec3(.017, .041, .039);
          vec3 color = mix(shallows, pool, depth);
          color = mix(color, vec3(.38, .54, .59), reflection) + specular * vec3(.65, .57, .37);
          float flecks = smoothstep(.74, .93, ripple) * (.7 + .3 * sin(w1));
          color += flecks * vec3(.080, .149, .142) * (.23 + .56 * depth);
          float pierWake = exp(-.28 * min(abs(p.x+101.),abs(p.x+83.))) * exp(-.095 * max(0.,p.y-10.)) * smoothstep(8.,13.,p.y);
          float millWake = exp(-.22*abs(p.x+78.)) * exp(-.14*abs(p.y+19.)) * wheelFlow;
          color += (pierWake+millWake)*smoothstep(.42,.80,ripple)*vec3(.23,.29,.24);
          float sand = noise(p * 1.95) * .060 + noise(p * .38) * .036;
          vec3 bankColor = vec3(.151, .139, .080) + sand;
          float wetEdge = smoothstep(.073, .15, distanceToEdge + irregular);
          color = mix(bankColor, color, wetEdge);
          float fog = smoothstep(320., 2200., length(cameraPosition - world));
          color *= mix(vec3(.24,.38,.58),vec3(1.),daylight);
          gl_FragColor = vec4(mix(color, mix(vec3(.035,.065,.10),vec3(.38,.49,.47),daylight), fog), 1.0);
          #include <colorspace_fragment>
        }
      `
    });
    return new T.Mesh(geometry, material);
  }

  function tuft(T) {
    const shape = [];
    const colors = [];
    const ends = [];
    for (let blade = 0; blade < 4; blade++) {
      const id = shape.length / 3;
      const angle = blade * 2.39996;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      const h = .72 + hash(31, blade) * .5;
      shape.push(x * .06 - z * .09, 0, z * .06 + x * .09, x * .06 + z * .09, 0, z * .06 - x * .09,
        x * .21 - z * .05, h * .64, z * .21 + x * .05, x * .21 + z * .05, h * .64, z * .21 - x * .05,
        x * .57, h, z * .57);
      colors.push(.48, .56, .39, .49, .57, .37, .72, .83, .58, .73, .85, .59, .96, 1, .74);
      ends.push(id, id + 1, id + 2, id + 1, id + 3, id + 2, id + 2, id + 3, id + 4);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(shape, 3));
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(ends);
    geometry.computeVertexNormals();
    return geometry;
  }

  function terrainMesh(T, renderer) {
    const axis = [-2200,-1300,-920,-715,-565,-477,-415,-373];
    for (let i=-350; i<=350; i+=3.5) axis.push(i);
    axis.push(373,415,477,565,715,920,1300,2200);
    const positions = [], colors = [], uv = [], faces = [];
    for (let iz=0; iz<axis.length; iz++) for (let ix=0; ix<axis.length; ix++) {
      const x=axis[ix], z=axis[iz], y=land.height(x,z), i=positions.length/3;
      positions.push(x,y,z); uv.push(x/4400+.5,z/4400+.5);
      const shore = Math.abs(x-center(z))-width(z);
      const grain = noise(x*.043,z*.043)*.15 + noise(x*.013,z*.013)*.12;
      const high = land.ramp(10,49,y);
      const wet = 1-land.ramp(.5,6,shore);
      colors.push(.83+grain+high*.16+wet*.15, .86+grain-high*.04-wet*.13, .74+grain-high*.03-wet*.11);
      if (ix && iz) faces.push(i-axis.length-1, i-1, i-axis.length, i-axis.length, i-1, i);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions,3));
    geo.setAttribute("color", new T.Float32BufferAttribute(colors,3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv,2));
    geo.setIndex(faces); geo.computeVertexNormals();
    const ground = new T.Mesh(geo, new T.MeshLambertMaterial({ map: groundMap(T,renderer), vertexColors: true }));
    ground.receiveShadow = true;
    return ground;
  }

  function create(T, scene, renderer, plots) {
    const ground = terrainMesh(T, renderer);
    const water = river(T);
    const scenery = globalThis.GridLabScenery;
    scenery.create(T, scene, [...plots, {type:"substation",x:-7,z:1}, {type:"water",x:-101,z:77}]);
    const blades = [];
    for (let z = -385; z <= 410; z += 2.6) for (let x = -410; x <= 375; x += 2.6) {
      const a = Math.round(x * 10);
      const b = Math.round(z * 10);
      const rim = Math.hypot((x + 17) / 387, (z - 22) / 394) + (noise(x * .022, z * .022) - .5) * .23;
      const fade = 1 - smooth(Math.min(1, Math.max(0, (rim - .66) / .30)));
      if (hash(a + 29, b) > (.76 + .21 * noise(x * .068, z * .068)) * fade) continue;
      const dx = x + hash(a, b) * 2.55;
      const dz = z + hash(b + 1, a) * 2.55;
      const edge = Math.abs(dx - center(dz)) - width(dz);
      if (edge < 1.15 || (edge < 3.0 && hash(a, b + 12) < .58)) continue;
      if (scenery.inField(dx,dz) || scenery.railway(dx,dz) || land.distanceToRoad(dx,dz) < .65) continue;
      blades.push({ x: dx, y: land.height(dx,dz)+.014, z: dz, variation: hash(a + 33, b + 14), angle: hash(a - 8, b) * 6.283,
        height: (.62 + hash(a + 12, b - 79) * .89) * (edge < 7 ? 1.4 : 1) });
    }
    const grass = new T.InstancedMesh(tuft(T), new T.MeshLambertMaterial({ side: T.DoubleSide, vertexColors: true }), blades.length);
    const rotation = new T.Quaternion();
    const vertical = new T.Vector3(0, 1, 0);
    const point = new T.Vector3();
    const scale = new T.Vector3();
    const transform = new T.Matrix4();
    const colors = [0x7b9952, 0x97af64, 0x719357, 0x98ab69, 0x658b53].map((value) => new T.Color(value));
    const plinth = { house: [5.2, 4.7], starter: [5.4, 4.5], mill: [8.6, 6.3], water: [2.4, 2.4],
      pump: [5.65, 4.9], substation: [6.3, 5.9], apartment: [7.4, 7.6], battery: [7.4, 7.2],
      solar: [12.8, 9.5], nuclear: [15.7, 13.1], hospital: [16.5, 9.5], greenhouse:[9.5,5.5],
      freight:[16,8], windFarm:[15,8], microWind:[2.4,2.4], station:[9,6.6], dispatch:[9,6.6], pumped:[15.6,13.8], pole:[1,1] };
    scene.add(ground, water, grass);

    return {
      animate(seconds) { water.material.uniforms.flowTime.value = seconds; },
      daylight(value) { water.material.uniforms.daylight.value = value; },
      wheelFlow(power) { water.material.uniforms.wheelFlow.value = Math.min(1,power/12); },
      clearFootprints(nodes, sizeOf) {
        const footprints = nodes.map(({ x, z, type }) => {
          const [w, d] = plinth[type] ?? [7, 7];
          const scale = sizeOf(type);
          return { x, z, w: w * scale, d: d * scale };
        });
        let index = 0;
        for (const blade of blades) {
          if (footprints.some(({ x, z, w, d }) => Math.abs(blade.x - x) < w && Math.abs(blade.z - z) < d)) continue;
          point.set(blade.x, blade.y, blade.z);
          scale.set(.91, blade.height, .91);
          rotation.setFromAxisAngle(vertical, blade.angle);
          grass.setMatrixAt(index, transform.compose(point, rotation, scale));
          grass.setColorAt(index, colors[Math.floor(blade.variation * colors.length)]);
          index++;
        }
        grass.count = index;
        grass.instanceMatrix.needsUpdate = true;
        grass.instanceColor.needsUpdate = true;
      }
    };
  }

  globalThis.GridLabLandscape = { create };
})();
