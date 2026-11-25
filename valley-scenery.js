(() => {
  "use strict";

  const land = globalThis.GridLabValley;
  const fields = [[12, -78, 22, 10], [44, -88, 8, 14], [94, 55, 15, 19]];
  const inField = (x, z) => fields.some(([cx, cz, w, d]) => Math.abs(x - cx) < w + 1 && Math.abs(z - cz) < d + 1);
  const railway = (x, z) => x >= -342 && x <= -126 && Math.abs(z - land.tracksAt(x)) < 3.2;

  function create(T, scene, sites) {
    const up = new T.Vector3(0, 1, 0);
    const origin = new T.Vector3(), size = new T.Vector3(), rotation = new T.Quaternion();
    const shape = {
      box: new T.BoxGeometry(1, 1, 1), trunk: new T.CylinderGeometry(.70, 1, 1, 8),
      crown: new T.IcosahedronGeometry(1, 1), rock: new T.IcosahedronGeometry(1, 0), pine: new T.ConeGeometry(1, 1, 9)
    };
    const batches = new Map();
    function put(kind, color, x, y, z, w, h, d, yaw = 0) {
      if (!batches.has(kind)) batches.set(kind, []);
      rotation.setFromAxisAngle(up, yaw);
      batches.get(kind).push([new T.Matrix4().compose(origin.set(x, y, z), rotation, size.set(w, h, d)), color]);
    }
    let seed = 716341;
    function random() { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; }

    function ribbon(points, w, material, sampleY) {
      const positions = [], faces = [];
      const sampled = [];
      for (let i = 1; i < points.length; i++) {
        const [a, b] = [points[i - 1], points[i]];
        const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let j = 0; j < count; j++) sampled.push([a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count]);
      }
      sampled.push(points[points.length - 1]);
      for (let i = 0; i < sampled.length; i++) {
        const [x, z] = sampled[i];
        const [a, b] = [sampled[Math.max(0, i - 1)], sampled[Math.min(sampled.length - 1, i + 1)]];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const nx = (b[1] - a[1]) / length, nz = (a[0] - b[0]) / length;
        for (const sign of [-1, 1]) {
          const px = x + sign * w * nx / 2, pz = z + sign * w * nz / 2;
          positions.push(px, sampleY(px, pz), pz);
        }
        if (i) { const k = i * 2; faces.push(k - 2, k, k - 1, k, k + 1, k - 1); }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(faces);
      geometry.computeVertexNormals();
      const mesh = new T.Mesh(geometry, material);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    const bridge = land.bridge;
    const deckHeight = (x, z) => {
      const y = land.surface(x, z);
      const blend = Math.min(land.ramp(bridge.from - 15, bridge.from, x), 1 - land.ramp(bridge.to, bridge.to + 13, x));
      return y + (bridge.deck - y) * blend;
    };
    const paved = new T.MeshLambertMaterial({ color: 0x75766e, side: T.DoubleSide });
    function layRoad(road,order) {
      const curve=new T.CatmullRomCurve3(road.points.map(([x,z])=>new T.Vector3(x,0,z)));
      const segments=Math.ceil(curve.getLength()/1.32), points=curve.getSpacedPoints(segments);
      const across=[-road.width*.5-.53,-road.width*.5,-.085,.085,road.width*.5,road.width*.5+.53];
      const positions=[], colors=[];
      const gravel=new T.Color(0xb2a383), surface=new T.Color(road.main?0x787a71:0xb6a785), paint=new T.Color(0xc1bba0);
      let previous;
      for (let i=0;i<=segments;i++) {
        const p=points[i], a=points[Math.max(0,i-1)], b=points[Math.min(segments,i+1)];
        const dx=b.x-a.x, dz=b.z-a.z, length=Math.hypot(dx,dz);
        const section=across.map((d)=>{
          const x=p.x+d*dz/length, z=p.z-d*dx/length;
          const y=road.main?deckHeight(x,z):land.surface(x,z);
          return [x,y+(road.main ? .32 : .17),z];
        });
        if (previous) for (let k=0;k<across.length-1;k++) {
          const base=k===0 || k===4?gravel:k===2 && road.main && i%9<3?paint:surface;
          const shade=.97+.035*Math.sin(i*.38);
          for (const v of [previous[k],section[k],previous[k+1],section[k],section[k+1],previous[k+1]]) {
            positions.push(...v); colors.push(base.r*shade,base.g*shade,base.b*shade);
          }
        }
        previous=section;
      }
      const geometry=new T.BufferGeometry();
      geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
      geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3)); geometry.computeVertexNormals();
      const mesh=new T.Mesh(geometry,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-order-1}));
      mesh.receiveShadow=true; scene.add(mesh);
    }
    land.roads.forEach(layRoad);

    // Les voussoirs et l’intrados suivent la même arche sous le tablier.
    const walls = [], triangles = [];
    const span = (bridge.to - bridge.from) / 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 16; j++) {
        const section = (k) => {
          const u = k / 16;
          return [bridge.from + span * (i + u), -.45 + 3.18 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))];
        };
        const [ax, ay] = section(j), [bx, by] = section(j + 1);
        const i0 = walls.length / 3;
        for (const z of [bridge.z - 3.25, bridge.z + 3.25]) walls.push(ax, ay, z, bx, by, z, bx, bridge.deck + .08, z, ax, bridge.deck + .08, z);
        for (const k of [0, 4]) triangles.push(i0+k, i0+k+1, i0+k+2, i0+k, i0+k+2, i0+k+3);
        triangles.push(i0, i0+4, i0+5, i0, i0+5, i0+1);
      }
    }
    const wallGeometry = new T.BufferGeometry();
    wallGeometry.setAttribute("position", new T.Float32BufferAttribute(walls, 3));
    wallGeometry.setIndex(triangles);
    wallGeometry.computeVertexNormals();
    const masonry = new T.Mesh(wallGeometry, new T.MeshLambertMaterial({ color: 0xaba48e, side: T.DoubleSide }));
    masonry.castShadow = masonry.receiveShadow = true;
    scene.add(masonry);
    for (const side of [-1, 1]) {
      const z = bridge.z + 3.12 * side;
      put("box", 0xb4ac93, (bridge.to + bridge.from)/2, bridge.deck + .43, z, span * 3 + .3, .85, .47);
      put("box", 0xd0c6aa, (bridge.to + bridge.from)/2, bridge.deck + .92, z, span * 3 + .6, .17, .65);
      for (let i = 0; i <= 6; i++) put("box", 0x9c9580, bridge.from + i * span / 2, bridge.deck + .57, z, .78, 1.17, .79);
    }

    const track = [];
    for (let x = -342; x <= -126; x += 2) {
      const z = land.tracksAt(x), y = land.surface(x, z);
      track.push([x,z]);
      put("box", 0x766752, x, y + .22, z, .30, .16, 3.65);
    }
    ribbon(track, 5.0, new T.MeshLambertMaterial({ color: 0x878275, side: T.DoubleSide }), (x,z) => land.surface(x,z) + .14);
    for (const side of [-1, 1]) ribbon(track.map(([x,z]) => [x, z + side * .94]), .15, paved, (x,z) => land.surface(x,z) + .36);

    function tree(x, z, h, pine) {
      const y = land.height(x, z), yaw = random() * 6.283;
      put("trunk", pine ? 0x625444 : 0x796047, x, y + h*.28, z, h*.043, h*.56, h*.043, yaw);
      if (pine) {
        const tone = random() < .5 ? 0x456746 : 0x365e48;
        put("pine", tone, x, y + h*.48, z, h*.27, h*.62, h*.27, yaw);
        put("pine", 0x527756, x, y + h*.67, z, h*.22, h*.55, h*.22, yaw + .31);
        put("pine", 0x658461, x, y + h*.84, z, h*.15, h*.40, h*.15, yaw);
      } else {
        const tone = [0x7b9357,0x65844d,0x8a9c62,0x648868][Math.floor(random()*4)];
        put("crown", tone, x, y+h*.69, z, h*.33, h*.33, h*.30, yaw);
        put("crown", tone, x+h*.19, y+h*.61, z-h*.09, h*.23, h*.25, h*.23, yaw*.8);
        put("crown", tone, x-h*.15, y+h*.63, z+h*.13, h*.24, h*.26, h*.25, yaw+.5);
      }
    }
    const clear = sites.map((site) => ({ ...site, radius: (globalThis.GridLabTerrain.catalog[site.type].radius + 2) * 1.45 }));
    const canPlant = (x,z) => Math.abs(x - land.riverX(z)) > land.riverWidth(z) + 2.8 && !inField(x,z) && !railway(x,z)
      && !clear.some((s) => Math.hypot(s.x-x, s.z-z) < s.radius) && land.distanceToRoad(x,z) > 2.6;
    const groves = [[-77,-114,32,52],[-117,-54,18,32],[-132,37,14,22],[99,-67,27,39],[121,45,35,41],
      [-16,138,43,57],[48,118,25,29],[-281,-54,38,61],[-222,124,34,57],[-275,22,29,39],
      [-16,-144,48,61],[128,-144,34,54],[197,92,44,58],[-177,-139,40,60],[-73,191,55,66]];
    for (const [cx,cz,r,n] of groves) for (let i=0; i<n; i++) {
      const a=random()*Math.PI*2, d=r*Math.sqrt(random());
      const x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d;
      if (canPlant(x,z)) tree(x,z,4.3+random()*9, x < -117 || Math.abs(z)>110 ? random()<.8 : random()<.24);
    }
    for (const [x,z] of [[-48,-29],[-26,26],[8,23],[11,33],[30,36],[70,31],[57,11],[33,-54],[-60,52],[-52,48],[-82,19],[-71,-52]]) {
      if (canPlant(x,z)) tree(x,z,4.8+random()*3,false);
    }
    for (const [x,z,w,d] of fields) {
      ribbon([[x-w,z],[x+w,z]], d*2, new T.MeshLambertMaterial({color:0x927753,side:T.DoubleSide}), (px,pz)=>land.height(px,pz)+.10);
      for (let dz=-d+1.4;dz<d;dz+=2.4) {
        const row = [[x-w+1,z+dz],[x+w-1,z+dz]];
        ribbon(row, .91, new T.MeshLambertMaterial({color:0x927f54,side:T.DoubleSide}), (px,pz)=>land.height(px,pz)+.19);
        for (let px=x-w+1.1;px<x+w-1;px+=1.12) {
          const pz=z+dz+(random()-.5)*.19;
          put("crown",random()<.5?0xa0ac66:0x87984d,px,land.height(px,pz)+.35,pz,.55,.34+random()*.21,.59,random()*6.28);
        }
      }
      for (let px=x-w;px<=x+w;px+=4) put("box",0x887753,px,land.height(px,z-d)+.67,z-d,.19,1.34,.19);
      put("box",0x9a8764,x,land.height(x,z-d)+.92,z-d,w*2,.18,.14);
    }
    for (let i=0;i<195;i++) {
      const z=-213+random()*437;
      const x=land.riverX(z)+(random()<.5?-1:1)*(land.riverWidth(z)+random()*3.4-1.25);
      if (Math.abs(z-bridge.z)<5 || !clear.every((s)=>Math.hypot(s.x-x,s.z-z)>s.radius*.67)) continue;
      const s=.38+random()*1.45;
      put("rock",random()<.5?0x908b75:0x757c70,x,land.height(x,z)+s*.25,z,s*1.32,s*.70,s,random()*6.28);
    }
    for (const [kind, items] of batches) {
      const mesh = new T.InstancedMesh(shape[kind], new T.MeshLambertMaterial({ flatShading: kind === "crown" || kind === "rock" }),items.length);
      const color = new T.Color();
      items.forEach(([matrix,tone],i) => { mesh.setMatrixAt(i,matrix); mesh.setColorAt(i,color.setHex(tone)); });
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  globalThis.GridLabScenery = { create, inField, railway };
})();
