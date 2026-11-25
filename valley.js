(() => {
  "use strict";

  const ramp = (lo, hi, value) => {
    const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  };
  const riverX = (z) => -111 + 22 * Math.exp(-(((z + 28) / 113) ** 2)) - z * .045 + 6 * Math.sin(z * .011);
  const riverWidth = (z) => 14.5 + 1.7 * Math.sin(z * .037) + .8 * Math.sin(z * .096);
  const bridge = { z: 10, from: -119, to: -65, deck: 3.6 };
  const tracksAt = (x) => 91 + 7 * Math.sin((x + 165) * .008);
  const roads = [
    { width: 5.6, main: true, points: [[-327, 22], [-243, -16], [-196, -17], [-156, 3], [-129, 10], [-119, 10], [-65, 10], [-51, 8], [-20, -12], [5, -12], [32, -1], [44, 4], [73, 5], [111, 14], [175, 38], [256, 49]] },
    { width: 3.1, points: [[-53, 8], [-52, -8], [-55, -27], [-49, -44], [-38, -54], [-33, -66], [-32, -95]] },
    { width: 3.3, points: [[-35, -3], [-32, 19], [-40, 36], [-49, 46], [-50, 64], [-54, 81], [-39, 98], [-13, 99]] },
    { width: 3.5, points: [[42, 4], [37, 18], [37, 35], [35, 55], [20, 69], [11, 76]] },
    { width: 3.1, points: [[45, 4], [38, -17], [40, -33], [43, -45], [52, -39], [67, -39]] },
    { width: 2.7, points: [[-1, -13], [3, -23], [10, -28], [24, -27]] },
    { width: 3.4, points: [[-188, -14], [-184, -37], [-186, -55], [-195, -70]] },
    { width: 3.5, points: [[-179, -9], [-188, 16], [-196, 37], [-195, 56], [-178, 67], [-161, 66], [-144, 73]] }
  ];
  const terraces = [
    [-163, -16, 13, 11, 15], [-215, -62, 27, 18, 23], [-226, 45, 21, 20, 21], [-154, 79, 24, 16, 11]
  ];
  function height(x, z) {
    const river = riverX(z);
    const edge = Math.abs(x - river) - riverWidth(z);
    const floodplain = -1.85 + 2.85 * ramp(-5, 3, edge);
    const west = ramp(4, 94, river - riverWidth(z) - x);
    const rim = ramp(93, 251, Math.abs(z - 12)) + ramp(97, 242, x) + ramp(260, 480, -x);
    const far = ramp(4, 50, edge) * rim * (19 + 13 * Math.sin(z * .023 + x * .015) + 9 * Math.cos(x * .037 - z * .019));
    let y = floodplain + west * (18 + 3 * Math.sin(z * .033) + 2.3 * Math.cos(x * .04)) + far;
    for (const [cx, cz, w, d, level] of terraces) {
      const outside = Math.max(Math.abs(cx - x) - w, Math.abs(cz - z) - d);
      if (outside < 11) y += (level - y) * (1 - ramp(-1, 11, outside));
    }
    if (x>-358 && x<-118) {
      const track=Math.abs(z-tracksAt(x));
      const shoulder=(1-ramp(3.8,13,track))*ramp(-358,-342,x)*(1-ramp(-128,-118,x));
      y+=(11+(-154-x)*.022-y)*shoulder;
    }
    return y;
  }
  // Même diagonale et même pas que le maillage de la zone jouable.
  function surface(x,z) {
    if (Math.abs(x)>=350 || Math.abs(z)>=350) return height(x,z);
    const ix=Math.floor((x+350)/3.5)*3.5-350, iz=Math.floor((z+350)/3.5)*3.5-350;
    const u=(x-ix)/3.5, v=(z-iz)/3.5;
    const east=height(ix+3.5,iz), south=height(ix,iz+3.5);
    if (u+v<=1) return (1-u-v)*height(ix,iz)+u*east+v*south;
    return (u+v-1)*height(ix+3.5,iz+3.5)+(1-u)*south+(1-v)*east;
  }
  function distanceToRoad(x, z) {
    let nearest = Infinity;
    for (const road of roads) for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1];
      const [bx, bz] = road.points[i];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      nearest = Math.min(nearest, Math.hypot(x - ax - dx * t, z - az - dz * t) - road.width * .5);
    }
    return nearest;
  }
  const api = { ramp, riverX, riverWidth, bridge, roads, height, surface, tracksAt, distanceToRoad };
  if (typeof module === "object") module.exports = api;
  else globalThis.GridLabValley = api;
})();
