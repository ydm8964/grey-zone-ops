/* ============================================================
   世界生成：地形 / 建筑 / 掩体 / 物资箱 / 撤离点
   全部程序化生成，无外部模型依赖
============================================================ */
import * as THREE from 'three';

/* 集装箱波纹板纹理（竖向瓦楞 + 结缝线） */
function texCorrugated(base, light, dark){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0,0,64,64);
  for (let i=0;i<8;i++){
    const g = x.createLinearGradient(i*8,0,i*8+8,0);
    g.addColorStop(0, dark); g.addColorStop(.5, light); g.addColorStop(1, dark);
    x.fillStyle = g; x.fillRect(i*8,0,8,64);
  }
  x.fillStyle = dark; x.fillRect(0,30,64,2); x.fillRect(0,60,64,2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 1);
  return t;
}

/* 共享材质缓存：跨局复用，避免每次开局重建纹理造成的内存/GC 压力 */
const MAT = {
  ground: new THREE.MeshLambertMaterial({ map: texGround() }),
  conc:   new THREE.MeshLambertMaterial({ map: texConcrete() }),
  metal:  new THREE.MeshLambertMaterial({ map: texMetal() }),
  rust:   new THREE.MeshLambertMaterial({ map: texRust() }),
  dark:   new THREE.MeshLambertMaterial({ color: 0x3c4238 }),
  wood:   new THREE.MeshLambertMaterial({ color: 0x6a5230 }),
  accent: new THREE.MeshLambertMaterial({ color: 0x8a9a3a }),
  contA:  new THREE.MeshLambertMaterial({ map: texCorrugated('#3f4a35','#57644a','#2c3426') }),
  contB:  new THREE.MeshLambertMaterial({ map: texCorrugated('#5a3428','#734a38','#3c231c') }),
  sand:   new THREE.MeshLambertMaterial({ color: 0x8f7d55 }),
  stripe: new THREE.MeshLambertMaterial({ color: 0xd8ff3e, emissive: 0x334400 }),
  glass:  new THREE.MeshPhongMaterial({ color: 0x1a2630, shininess: 140, specular: 0xaaccee }),
};
/* 标记跨局共享：重开一局时不得 dispose，否则材质失效会导致画面异常 */
Object.values(MAT).forEach(m => { m.userData.shared = true; });
/* 天空按地图 palette 缓存（4 张图最多 4 份） */
const _skyCache = new Map();
function getSky(pal){
  const key = pal.join('|');
  let t = _skyCache.get(key);
  if (!t){ t = texSky(pal); _skyCache.set(key, t); }
  return t;
}

const rnd = (a,b) => a + Math.random()*(b-a);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];

/* 程序化纹理 */
function texGround(){
  const c = document.createElement('canvas'); c.width=c.height=256;
  const x = c.getContext('2d');
  x.fillStyle='#3b4232'; x.fillRect(0,0,256,256);
  for(let i=0;i<2600;i++){
    const g = 40+Math.random()*70;
    x.fillStyle=`rgba(${g+18},${g+24},${g},${.18+Math.random()*.32})`;
    x.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*3, 1+Math.random()*3);
  }
  for(let i=0;i<40;i++){
    x.strokeStyle=`rgba(30,36,24,${.05+Math.random()*.1})`; x.lineWidth=1+Math.random()*2;
    x.beginPath(); x.moveTo(Math.random()*256,Math.random()*256);
    x.lineTo(Math.random()*256,Math.random()*256); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(60,60);
  return t;
}
function texConcrete(){
  const c = document.createElement('canvas'); c.width=c.height=128;
  const x = c.getContext('2d');
  x.fillStyle='#7c7c70'; x.fillRect(0,0,128,128);
  for(let i=0;i<900;i++){
    const g=90+Math.random()*70;
    x.fillStyle=`rgba(${g},${g},${g-4},${.14+Math.random()*.25})`;
    x.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*2,1+Math.random()*2);
  }
  for(let i=0;i<7;i++){
    x.strokeStyle=`rgba(60,60,54,${.18+Math.random()*.2})`; x.lineWidth=1;
    x.beginPath(); x.moveTo(Math.random()*128,0); x.lineTo(Math.random()*128,128); x.stroke();
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2);
  return t;
}
function texMetal(){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,128);
  g.addColorStop(0,'#6a6a62'); g.addColorStop(.5,'#565650'); g.addColorStop(1,'#494942');
  x.fillStyle=g; x.fillRect(0,0,128,128);
  for(let i=0;i<128;i+=8){
    x.fillStyle='rgba(0,0,0,.16)'; x.fillRect(0,i,128,2);
    x.fillStyle='rgba(255,255,255,.05)'; x.fillRect(0,i+2,128,1);
  }
  for(let i=0;i<300;i++){
    x.fillStyle=`rgba(${120+Math.random()*40},${70+Math.random()*25},${30+Math.random()*18},${.1+Math.random()*.28})`;
    x.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*4,1+Math.random()*3);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,1);
  return t;
}
function texRust(){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#7a4a2c'; x.fillRect(0,0,128,128);
  for(let i=0;i<600;i++){
    x.fillStyle=`rgba(${90+Math.random()*70},${40+Math.random()*40},${20+Math.random()*25},${.2+Math.random()*.4})`;
    x.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*6,1+Math.random()*4);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,1);
  return t;
}
function texSky(palette){
  const c=document.createElement('canvas'); c.width=8; c.height=256;
  const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0, palette[2]); g.addColorStop(.45, palette[1]); g.addColorStop(.72, palette[0]);
  g.addColorStop(1,'#20241c');
  x.fillStyle=g; x.fillRect(0,0,8,256);
  const t=new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/* 空间网格：加速射线/碰撞查询 */
export class Grid {
  constructor(blocks, size=14, ext=112){
    this.size=size; this.ext=ext; this.cells=new Map(); this.blocks=blocks;
    blocks.forEach((b,i)=>{
      const x0=this._c(b.x-b.w/2), x1=this._c(b.x+b.w/2);
      const z0=this._c(b.z-b.d/2), z1=this._c(b.z+b.d/2);
      for(let cx=x0;cx<=x1;cx++) for(let cz=z0;cz<=z1;cz++){
        const k=cx*4096+cz;
        let a=this.cells.get(k); if(!a){a=[];this.cells.set(k,a);} a.push(i);
      }
    });
  }
  _c(v){ return Math.floor((v+this.ext)/this.size); }
  at(x,z){ return this.cells.get(this._c(x)*4096+this._c(z)) || null; }
  /* 查询半径 r 圆覆盖的所有块下标（含跨单元，供碰撞检测使用） */
  atRect(x, z, r, out=[]){
    out.length = 0;
    const x0=this._c(x-r), x1=this._c(x+r), z0=this._c(z-r), z1=this._c(z+r);
    for(let cx=x0;cx<=x1;cx++) for(let cz=z0;cz<=z1;cz++){
      const a=this.cells.get(cx*4096+cz);
      if(a) for(let j=0;j<a.length;j++){ if(out.indexOf(a[j])===-1) out.push(a[j]); }
    }
    return out;
  }
}

/* 线段采样查询：返回可能相交的 block 列表 */
export function querySegment(grid, ax,az, bx,bz, out){
  const len = Math.hypot(bx-ax, bz-az);
  const steps = Math.max(1, Math.min(24, Math.ceil(len/4)));
  out.length = 0;
  let last = -1;
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    const k = grid._c(ax+(bx-ax)*t)*4096 + grid._c(az+(bz-az)*t);
    if (k===last) continue;
    last = k;
    const a = grid.cells.get(k);
    if (a) for(let j=0;j<a.length;j++){
      const idx=a[j];
      if (out.indexOf(idx)===-1) out.push(idx);
    }
  }
  return out;
}

/* 盒体生成 + 登记碰撞 */
class Builder {
  constructor(scene){ this.scene=scene; this.blocks=[]; this.mini=[]; }
  box(x,y,z,w,h,d,mat,opt={}){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y+h/2,z);
    if (opt.rot) m.rotation.y = opt.rot;
    m.castShadow = opt.shadow!==false; m.receiveShadow = true;
    this.scene.add(m);
    if (opt.solid!==false){
      // 旋转块用外接 AABB 近似登记碰撞（略大于实际，可接受）
      const rr = opt.rot || 0;
      const c = Math.abs(Math.cos(rr)), s = Math.abs(Math.sin(rr));
      this.blocks.push({x, z, w: w*c + d*s, d: w*s + d*c, h, y, top: y+h});
    }
    if (opt.mini!==false){
      this.mini.push({x, z, w, d, rot:opt.rot||0});
    }
    return m;
  }
}

export function buildWorld(scene, mapDef, diff){
  const B = new Builder(scene);
  const pal = mapDef.palette;

  // ---- 光照 ----
  scene.background = getSky(pal);
  scene.fog = new THREE.FogExp2(0x2a3324, 0.0075);

  const hemi = new THREE.HemisphereLight(0x9aa88a, 0x2a3020, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe9c4, 1.35);
  sun.position.set(60, 110, 40);
  sun.castShadow = true;
  // 阴影相机跟随玩家（见 game._updateSun），所以范围只需覆盖身边区域：
  // 相比原先整图 ±110，参与阴影渲染的物体约减少到 1/4，且阴影更清晰
  sun.shadow.mapSize.set(1024,1024);
  const S = 58;
  sun.shadow.camera.left=-S; sun.shadow.camera.right=S;
  sun.shadow.camera.top=S; sun.shadow.camera.bottom=-S;
  sun.shadow.camera.near=1; sun.shadow.camera.far=320;
  sun.shadow.bias = -0.0009;
  scene.add(sun);
  scene.add(sun.target);          // target 必须入场景，矩阵才会更新
  scene.add(new THREE.AmbientLight(0x40483a, .55));

  // ---- 地面 ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400), MAT.ground);
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
  scene.add(ground);

  // ---- 边界墙 ----
  const HH = 14, T = 4;
  [[0,-110,220,T],[0,110,220,T],[-110,0,T,220],[110,0,T,220]].forEach(([x,z,w,d])=>{
    B.box(x,0,z,w,HH,d, MAT.conc, {mini:false});
  });

  // ---- 中央大坝主体（地图标志性建筑）----
  B.box(0,0,-6, 86, 20, 14, MAT.conc);
  B.box(0,20,-6, 86, 1.6, 16, MAT.dark);          // 坝顶
  // 坝顶护栏
  for(let i=-40;i<=40;i+=8) B.box(i,21.6,-6, .5, 1.2, .5, MAT.metal,{shadow:false,mini:false});
  // 泄洪闸门
  for(let i=-30;i<=30;i+=15){
    B.box(i,0,1.2, 8, 9, 1.2, MAT.metal,{mini:false});
    B.box(i,9,1.2, 8, .8, 1.6, MAT.rust,{mini:false});
  }
  // 坝体塔楼
  [[-38,1,0],[38,1,0]].forEach(([x,y,z])=>{
    B.box(x,0,z, 9, 26, 9, MAT.conc);
    B.box(x,26,z, 10, 1.2, 10, MAT.dark);
    for(let i=0;i<3;i++) B.box(x, 8+i*6, z+4.6, 2.4, 2.2, .4, MAT.dark,{shadow:false,mini:false});
  });
  // 坝内通道（可穿行的门洞：用两块墙夹出通道）
  B.box(-14,0,-14, 10, 8, 4, MAT.conc,{mini:false});
  B.box( 14,0,-14, 10, 8, 4, MAT.conc,{mini:false});

  // ---- 副建筑群 ----
  const buildings = [
    [-46, 40, 22, 9, 16], [ 40, 46, 18, 7, 14], [-52, -46, 20, 11, 18],
    [ 52, -40, 16, 8, 16], [ 8, 62, 26, 6, 12], [-30, 70, 14, 5, 14],
    [ 70, 8, 14, 12, 22], [-72, -6, 16, 10, 20], [ 26, -66, 20, 7, 14],
    [-18, -74, 24, 6, 12],
  ];
  buildings.forEach(([x,z,w,h,d])=>{
    B.box(x,0,z, w,h,d, MAT.conc);
    B.box(x,h,z, w+1.2, .8, d+1.2, MAT.dark);
    // 窗（高光玻璃 + 混凝土窗框线）
    const n = Math.max(2, Math.floor(w/5));
    for(let i=0;i<n;i++){
      const wx = x - w/2 + (i+1)*(w/(n+1));
      B.box(wx, h*0.42, z+d/2+.15, 2.2, 2.4, .3, MAT.glass,{shadow:false,mini:false});
      B.box(wx, h*0.42, z-d/2-.15, 2.2, 2.4, .3, MAT.glass,{shadow:false,mini:false});
      B.box(wx, h*0.42-1.32, z+d/2+.18, 2.6,.14,.36, MAT.dark,{shadow:false,mini:false});
      B.box(wx, h*0.42-1.32, z-d/2-.18, 2.6,.14,.36, MAT.dark,{shadow:false,mini:false});
    }
    // 门
    B.box(x, 0, z+d/2+.2, 3, 3.4, .4, MAT.wood,{shadow:false,mini:false});
  });

  // ---- 集装箱群（可攀爬的战术掩体）----
  const cpos = [
    [-24,30,0],[ -18,30,0],[ -24,36,0],[ 12,34,90],[ 18,34,90],[ 24,34,90],
    [ -40,10,0],[ -40,16,0],[ 44,-16,0],[ 44,-22,0],[ 50,-16,0],
    [ 4,-40,0],[ 10,-40,0],[ -60,26,45],[ -66,32,45],[ 62,52,0],
    [ 30,60,0],[ -8,-24,0],[ -14,-24,0],[ 66,-56,30],
  ];
  cpos.forEach(([x,z,r],i)=>{
    const mat = i%2 ? MAT.contA : MAT.contB;
    const rot = r ? r*Math.PI/180 : 0;
    const box = B.box(x,0,z, 6.2, 2.7, 2.6, mat, {rot, solid:false});
    // 正面门缝 + 顶部结缝压条（挂在箱体下随旋转）
    const seam = new THREE.Mesh(new THREE.BoxGeometry(.07,2.5,.06), MAT.dark);
    seam.position.set(0,1.36,1.32); box.add(seam);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.1,.1,.1), MAT.dark);
    rail.position.set(0,2.72,1.29); box.add(rail);
    // 碰撞用无旋转近似（旋转 90° 时交换 w/d）
    const swap = Math.abs(Math.sin(rot)) > .5;
    B.blocks.push({x, z, w: swap?2.6:6.2, d: swap?6.2:2.6, h:2.7, y:0, top:2.7});
  });

  // ---- 矮掩体墙 ----
  const walls = [
    [-30,60,14,.6],[-30,64,14,.6], [34,20,12,.7], [34,26,12,.7],
    [-56,-20,16,.7], [20,-52,14,.6], [58,30,12,.7], [-10,44,10,.6],
    [46,60,14,.7], [-64,60,12,.6], [0,-56,18,.8], [72,-24,12,.7],
  ];
  walls.forEach(([x,z,w,r])=>{
    B.box(x,0,z, w, 1.5, .7, MAT.conc, {rot:r});
  });

  // ---- 出生点（提前定义：随机物体需避开，避免出生即卡在模型内部）----
  const spawnPoints = [
    { x: 92, z: -92 }, { x: -92, z: 88 }, { x: 92, z: 92 }, { x: -92, z: -88 }, { x: 0, z: 96 },
  ];
  const nearSpawn = (x,z) => spawnPoints.some(s => Math.abs(s.x-x) < 3.5 && Math.abs(s.z-z) < 3.5);

  // ---- 沙袋掩体（InstancedMesh 单批绘制；圆润胶囊错位堆叠） ----
  const bagGeo = new THREE.CapsuleGeometry(.23,.46,4,8);
  bagGeo.rotateZ(Math.PI/2);                    // 几何体预横放，实例只绕 Y 旋转
  const bagData = [];
  for(let i=0;i<26;i++){
    const x = rnd(-95,95), z = rnd(-95,95);
    if (Math.abs(x)<24 && Math.abs(z+6)<20) continue;   // 避开大坝主体
    if (nearSpawn(x,z)) continue;                        // 避开出生点
    const per = [3,2,2];
    for(let k=0;k<3;k++){
      for(let j=0;j<per[k];j++){
        bagData.push([ x + (j-(per[k]-1)/2)*.80 + rnd(-.05,.05),
                       .20 + k*.33,
                       z + (k-1)*.09 + rnd(-.05,.05), rnd(-.12,.12) ]);
      }
    }
    B.blocks.push({x, z, w:2.8, d:1.2, h:1.7, y:0, top:1.7});
  }
  if (bagData.length){
    const bags = new THREE.InstancedMesh(bagGeo, MAT.sand, bagData.length);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), EU = new THREE.Euler(),
          V3 = new THREE.Vector3(), ONE = new THREE.Vector3(1,1,1);
    bagData.forEach(([x,y,z,ry],i)=>{
      EU.set(0,ry,0); Q.setFromEuler(EU); V3.set(x,y,z);
      bags.setMatrixAt(i, M4.compose(V3,Q,ONE));
    });
    bags.instanceMatrix.needsUpdate = true;
    bags.castShadow = true; bags.receiveShadow = true;
    scene.add(bags);
  }

  // ---- 油桶（InstancedMesh：双色桶身 + 环箍×2 + 顶盖口） ----
  const drumGeo = new THREE.CylinderGeometry(.55,.55,1.7,14);
  const hoopGeo = new THREE.CylinderGeometry(.585,.585,.09,14);
  const capGeo  = new THREE.CylinderGeometry(.16,.16,.07,10);
  const drumA = [], drumB = [], hoops = [], caps = [];
  for(let i=0;i<30;i++){
    const x=rnd(-95,95), z=rnd(-95,95);
    if (nearSpawn(x,z)) continue;
    (i%2 ? drumB : drumA).push([x,.85,z]);
    hoops.push([x,.46,z],[x,1.24,z]);
    caps.push([x,1.73,z]);
    B.mini.push({x,z,w:1.2,d:1.2,rot:0});
    B.blocks.push({x,z,w:1.3,d:1.3,h:1.7,y:0,top:1.7});
  }
  const _inst = (geo, mat, list) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(),
          vv = new THREE.Vector3(), oo = new THREE.Vector3(1,1,1);
    list.forEach(([x,y,z],i)=>{ vv.set(x,y,z); im.setMatrixAt(i, m4.compose(vv,qq,oo)); });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
  };
  _inst(drumGeo, MAT.rust,  drumA);
  _inst(drumGeo, MAT.accent, drumB);
  _inst(hoopGeo, MAT.dark,  hoops);
  _inst(capGeo,  MAT.dark,  caps);

  // ---- 塔架（立柱 / 平台 / 护栏 / 爬梯） ----
  [[-80,80],[80,-80],[-84,-80],[84,76]].forEach(([x,z])=>{
    for(const [ox,oz] of [[-2,-2],[2,-2],[-2,2],[2,2]]){
      B.box(x+ox,0,z+oz, .5, 16, .5, MAT.metal,{mini:false});
    }
    B.box(x,16,z, 6, .5, 6, MAT.metal,{mini:false});
    B.box(x,16.5,z, 4.4, 2.4, 4.4, MAT.dark);
    // 平台四角护栏立柱 + 顶部横杆
    for(const [ox,oz] of [[-2.85,-2.85],[2.85,-2.85],[-2.85,2.85],[2.85,2.85]]){
      B.box(x+ox,19,z+oz, .12, 1.2, .12, MAT.metal,{shadow:false,mini:false});
    }
    for(const [ox,oz,w,d] of [[0,-2.85,5.9,.1],[0,2.85,5.9,.1],[-2.85,0,.1,5.9],[2.85,0,.1,5.9]]){
      B.box(x+ox,20.1,z+oz, w, .1, d, MAT.metal,{shadow:false,mini:false});
    }
    // 一侧爬梯：双竖轨 + 横档
    B.box(x+3.15,0,z-.3, .1, 16, .1, MAT.metal,{shadow:false,mini:false});
    B.box(x+3.15,0,z+.3, .1, 16, .1, MAT.metal,{shadow:false,mini:false});
    for(let hgt=1; hgt<15.8; hgt+=1.6)
      B.box(x+3.15, hgt, z, .08, .08, .72, MAT.dark,{shadow:false,mini:false});
  });

  // ---- 物资箱 ----
  const lootSpots = [
    [-46,40],[40,46],[-52,-46],[52,-40],[8,62],[-30,70],[70,8],[-72,-6],
    [26,-66],[-18,-74],[-24,33],[18,37],[44,-19],[-40,13],[4,-43],[62,-56],
    [0,-13],[-14,-13],[14,-13],[30,60],[-66,29],[58,30],[46,60],[0,44],
  ];
  const lootboxes = lootSpots.map(([x,z],i)=>{
    const g = new THREE.Group();
    // 木托盘底
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.72,.14,1.22), MAT.wood);
    pallet.position.y=.07; pallet.castShadow=true; pallet.receiveShadow=true;
    // 军绿箱体
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.04,1.0), MAT.accent);
    base.position.y=.66; base.castShadow=true; base.receiveShadow=true;
    // 金属包边（箱口沿）
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.6,.13,1.1), MAT.metal);
    rim.position.y=1.17; rim.castShadow=true;
    // 盖子（开箱动画目标：绕中心翻开 + 抬升）
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5,.15,1.0), MAT.accent);
    lid.position.y=1.2; lid.castShadow=true;
    // 双锁扣 + 荧光警示条
    const lockL = new THREE.Mesh(new THREE.BoxGeometry(.18,.26,.12), MAT.rust);
    lockL.position.set(-.46,.98,.53);
    const lockR = lockL.clone(); lockR.position.x=.46;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.14,.15,.02), MAT.stripe);
    stripe.position.set(0,.68,.51);
    g.add(pallet,base,rim,lid,lockL,lockR,stripe);
    g.position.set(x,0,z);
    g.rotation.y = rnd(0,Math.PI*2);
    scene.add(g);
    B.blocks.push({x, z, w:1.6, d:1.2, h:1.3, y:0, top:1.3});
    return { x, z, mesh:g, lid, opened:false, id:i };
  });

  // ---- 撤离点 ----
  const extractSpots = [
    { name:'西侧闸口', x:-96, z:0 },
    { name:'北侧山路', x:0, z:-96 },
    { name:'东南码头', x:88, z:88 },
  ];
  const extracts = extractSpots.map(e=>{
    const g = new THREE.Group();
    // 地面光圈
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 5.4, 40),
      new THREE.MeshBasicMaterial({ color:0x5dff6a, transparent:true, opacity:.42, side:THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI/2; ring.position.y = .06;
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 2.0, 30),
      new THREE.MeshBasicMaterial({ color:0x5dff6a, transparent:true, opacity:.28, side:THREE.DoubleSide })
    );
    ring2.rotation.x = -Math.PI/2; ring2.position.y = .07;
    // 光柱
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6,4.6,26,24,1,true),
      new THREE.MeshBasicMaterial({ color:0x5dff6a, transparent:true, opacity:.10, side:THREE.DoubleSide, depthWrite:false })
    );
    beam.position.y = 13;
    // 标识牌
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.4,1.6,.2), 
      new THREE.MeshBasicMaterial({ color:0x0e1a0e }));
    sign.position.set(0,3.4,0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.0,.3,.05), 
      new THREE.MeshBasicMaterial({ color:0x5dff6a }));
    bar.position.set(0,3.4,.13);
    g.add(ring,ring2,beam,sign,bar);
    g.position.set(e.x, 0, e.z);
    scene.add(g);
    return { ...e, mesh:g, beam, ring, radius:8, active:true, progress:0 };
  });

  // ---- 敌人巡逻点 ----
  const patrols = [];
  for(let i=0;i<14;i++){
    patrols.push({ x: rnd(-88,88), z: rnd(-88,88) });
  }

  const grid = new Grid(B.blocks.filter(b=>b.h>0.9));

  return {
    blocks: B.blocks, minimapBlocks: B.mini, grid,
    extracts, lootboxes, spawnPoints, patrols, materials: MAT, sun,
    bounds: 108,
  };
}
