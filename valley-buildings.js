(() => {
  "use strict";

  function draw(node, kit) {
    const { T, box, piece, beam, building, moving, part, rotors, basins, trains, horizontal } = kit;
    const { x, z, type } = node;
    if (type === "microWind" || type === "windFarm") {
      const small = type === "microWind";
      const height = small ? 9.7 : 20.0, radius = small ? 3.65 : 7.8;
      for (const dx of small ? [0] : [-9.8, 9.8]) {
        const cx = x + dx, cz = z + (small ? 0 : Math.sign(dx)*3.8);
        piece("drum", 0x929486, cx,.18,cz,small?1.22:2.24,.36,small?1.22:2.24);
        piece("mast", 0xd1d7cb, cx,height*.5,cz,small ? .43 : .74,height,small ? .43 : .74);
        box(0xd8dbce,cx,height,cz,small ? .90 : 1.6,small ? .8 : 1.2,small ? 1.8 : 3.1);
        const wheel = moving(node,cx,height,cz+(small?1.0:1.64));
        for (let i=0; i<3; i++) {
          const orient = new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),i*Math.PI*2/3);
          part(wheel,"blade",0xe9e5d6,0,0,0,radius,radius,radius,orient);
        }
        part(wheel,"globe",0xc1c9bd,0,0,.12,radius*.087,radius*.087,radius*.077);
        rotors.push({group:wheel,id:node.id,axis:"z",factor:small?1.4:.78,speed:0});
      }
      if (!small) {
        box(0x879080,x,.15,z,5.3,.3,3.7);
        box(0xaeb1a1,x,1.4,z,4.5,2.5,2.95);
        box(0x596a65,x,2.68,z,4.78,.16,3.23);
      }
      return height + radius;
    }
    if (type === "greenhouse") {
      box(0x8c8166,x,.17,z,16.7,.34,9.0);
      box(0x624c33,x,.35,z,15.8,.17,8.45);
      for (const dz of [-2.8,0,2.8]) {
        box(0x8c714c,x,.56,z+dz,15.0,.46,1.5);
        for (let i=-6;i<=6;i+=1.45) piece("globe",dz===0?0x718b44:0x6d924f,x+i,1.08,z+dz,.64,.67,.56);
      }
      piece("glassRoof",0xa8c6b4,x,1.82,z,16.45,7.32,8.7);
      for (const side of [-1,1]) piece("glassWall",0xa8c6b4,x,1.08,z+4.29*side,16.43,1.55,.08);
      for (let i=-3;i<=3;i++) {
        const cx=x+i*2.68;
        for (const side of [-1,1]) box(0x8e9f95,cx,1.11,z+side*4.32,.12,1.68,.14);
        let previous = [cx,1.86,z+4.33];
        for (let k=1;k<=12;k++) {
          const a=k*Math.PI/12, next=[cx,1.86+3.68*Math.sin(a),z+4.33*Math.cos(a)];
          beam(0x99a59b,previous,next,.13); previous=next;
        }
      }
      box(0x9eaaa0,x,5.55,z,16.52,.16,.18);
      for (const side of [-1,1]) box(0x667e76,x+8.10,1.63,z+side*1.09,.16,2.8,.15);
      box(0x667e76,x+8.10,3.04,z,.16,.18,2.33);
      return 5.65;
    }
    if (type === "station" || type === "dispatch") {
      box(0x858b7f,x,.18,z,17,.36,12);
      building(x-4.7,z,5.3,7.2,3.55,0xb8b9a9,type === "dispatch" ? 0x456878 : 0x647875);
      box(0x798982,x+3,1.56,z,4.8,2.50,3.0);
      if (type === "dispatch") box(0x98b5b5,x+3,2.15,z+1.53,1.95,.49,.10);
      for (let i=-2;i<=2;i++) box(0x536966,x+3+i*.8,1.60,z+1.63,.22,2.15,.77);
      for (const dx of [-.8,7.25]) {
        box(0x6c7a73,x+dx,3.08,z-3.8,.30,5.91,.32);
        beam(0x75837a,[x+dx,4.55,z-3.8],[x+dx+(dx<0?1.34:-1.34),5.98,z-3.8],.17);
      }
      box(0x5e706b,x+3.22,5.97,z-3.8,8.47,.24,.40);
      for (const dx of [.7,3.2,5.7]) for (let i=0;i<4;i++) piece("drum",0x819c91,x+dx,5.82-i*.20,z-3.8,.29,.14,.29);
      return 6.25;
    }
    if (type === "pumped") {
      box(0x8b8b78,x,.14,z,30,.28,24.5);
      const upper = { x:x-5.3, z:z-1.6, radius:6.8, floor:2.64, wall:3.0 };
      const lower = { x:x+7.15, z:z+5.9, radius:4.20, floor:.33, wall:1.82 };
      piece("drum",0x929782,upper.x,1.42,upper.z,7.38,2.55,7.38);
      for (const [i,b] of [upper,lower].entries()) {
        piece("openTank",0xb5b5a3,b.x,b.floor+b.wall*.5,b.z,b.radius,b.wall,b.radius);
        piece("hoop",0xc8c4ae,b.x,b.floor+b.wall,b.z,b.radius,b.radius,b.radius*.27,horizontal);
        const group=moving(node,b.x,b.floor,b.z);
        part(group,"drum",i===0?0x44857e:0x598c83,0,0,0,b.radius*.975,.10,b.radius*.975);
        basins.push({group,base:group.position.y,range:b.wall*group.scale.y*.79,upper:i===0,id:node.id,capacity:node.capacity});
      }
      building(x+7.9,z-5.9,8.1,5.9,3.4,0xb9b19e,0x647477);
      beam(0x577a72,[x+.7,2.91,z-1.6],[x+6.3,1.1,z-3.1],.84);
      beam(0x677f75,[x+8.55,1.12,z-3.1],[x+8.55,1.0,z+2.12],.71);
      return 6.1;
    }
    if (type === "freight") {
      box(0x8a8a7b,x,.25,z,29.8,.50,13.9);
      building(x-1.8,z-1.7,20,8,4.8,0xb69979,null);
      for (const dx of [-6.8,3.2]) piece("roof",0x667575,x+dx,5.79,z-1.7,10.18,1.71,8.62);
      box(0x67756d,x,3.74,z+3.74,25,.24,4.36);
      for (const dx of [-11.6,-4,4,11.6]) box(0x65726b,x+dx,2.06,z+5.48,.21,3.34,.21);
      for (const dx of [-8.9,-3.2,2.5]) box(0x62736b,x+dx,1.82,z+2.35,3.05,2.63,.14);
      for (const dz of [-3.5,.7]) {
        box(0x9a644b,x+10.2,1.38,z+dz,5.3,1.92,2.6);
        for (let i=-2;i<=2;i++) box(0x875943,x+10.2+i*.85,1.4,z+dz+1.31,.11,1.69,.08);
      }
      const train = new T.Group();
      kit.contents.add(train);
      const trackZ=globalThis.GridLabValley.tracksAt(x);
      train.position.set(x, globalThis.GridLabValley.height(x,trackZ)+.46,trackZ);
      for (const dx of [-8.2,1.0,10.2]) {
        const cab=dx<0;
        part(train,"box",0x394846,dx,.78,0,8.4,.52,2.76);
        part(train,"box",cab?0xad6b47:0x537773,dx,2.07,0,7.78,2.22,2.63);
        part(train,"box",0x57635b,dx,3.23,0,7.88,.18,2.72);
        for (const offset of [-2.45,2.45]) part(train,"drum",0x384444,dx+offset,.50,0,.55,2.65,.55,horizontal);
        if (cab) for (const side of [-1,1]) part(train,"box",0x455d62,dx-2.05,2.44,side*1.323,2.1,.71,.055);
      }
      trains.push({group:train,x,id:node.id});
      return 6.68;
    }
    return undefined;
  }

  function greenhouseRoof(T) {
    const vertices=[], faces=[];
    for (let i=0;i<=24;i++) {
      const a=i*Math.PI/24, y=Math.sin(a)*.5, z=Math.cos(a)*.5;
      vertices.push(-.5,y,z,.5,y,z);
      if (i) { const k=i*2; faces.push(k-2,k-1,k,k,k-1,k+1); }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(vertices,3)); geometry.setIndex(faces); geometry.computeVertexNormals();
    return geometry;
  }
  function turbineBlade(T) {
    const stations=[[0,-.033,.033,.030],[.18,-.045,.10,.030],[.52,-.03,.107,.020],[1,.031,.061,.007]];
    const vertices=[], faces=[];
    for (let i=0;i<stations.length;i++) {
      const [y,left,right,t]=stations[i];
      vertices.push(left,y,0,right,y,0,(left+right)*.5,y,t);
      if (i) { const a=(i-1)*3; for (let j=0;j<3;j++) {
        const b=(j+1)%3; faces.push(a+j,a+j+3,a+b,a+b,a+j+3,a+b+3);
      } }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(vertices,3)); geometry.setIndex(faces); geometry.computeVertexNormals();
    return geometry;
  }
  globalThis.GridLabValleyBuildings = { draw, greenhouseRoof, turbineBlade };
})();
