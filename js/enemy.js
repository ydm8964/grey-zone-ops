/* ============================================================
   敌人 AI：阿萨拉卫队 —— 巡逻 / 警戒 / 交战 / 阵亡
============================================================ */
import * as THREE from 'three';
import { querySegment } from './world.js';

const rnd = (a,b)=> a + Math.random()*(b-a);

/* 2D slab 求交，返回进入参数 t∈[0,1]，不相交返回 null */
function slab(ox, dx, min, max){
  if (Math.abs(dx) < 1e-6) return (ox>=min && ox<=max) ? [-Infinity, Infinity] : null;
  let t1=(min-ox)/dx, t2=(max-ox)/dx;
  if (t1>t2){ const t=t1; t1=t2; t2=t; }
  return [t1,t2];
}

/* 线段 vs AABB 遮挡检测（空间网格加速） */
const _scratch = new Int32Array(512);
const _tmpQ1 = /* @__PURE__ */ new THREE.Quaternion();
const _tmpQ2 = /* @__PURE__ */ new THREE.Quaternion();
/* AI 每帧复用，避免 37 个敌人 × 每帧 3 次的 Vector3 分配 */
const _vA = /* @__PURE__ */ new THREE.Vector3();
const _vB = /* @__PURE__ */ new THREE.Vector3();
const _vC = /* @__PURE__ */ new THREE.Vector3();

/* 合并一组（已预乘变换、已非索引化的）几何体为一个 BufferGeometry */
function mergeGeoms(geos){
  let n = 0, hasN = true, hasU = true;
  for (const g of geos){
    n += g.attributes.position.count;
    if (!g.attributes.normal) hasN = false;
    if (!g.attributes.uv) hasU = false;
  }
  const pos = new Float32Array(n*3);
  const nor = new Float32Array(n*3);
  const uv  = new Float32Array(n*2);
  let o3 = 0, o2 = 0;
  for (const g of geos){
    const p = g.attributes.position.array;
    pos.set(p, o3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o3);
    if (g.attributes.uv)      uv.set(g.attributes.uv.array, o2);
    o3 += p.length; o2 += (p.length/3)*2;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal',   new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
  // 若有几何体缺法线/UV 就补齐，避免合并后整片发黑或 UV 错位
  if (!hasN) out.computeVertexNormals();
  if (!hasU) out.deleteAttribute('uv');
  out.computeBoundingSphere();
  return out;
}
export function segmentBlocked(ax,az,ay, bx,bz,by, world){
  const dx=bx-ax, dz=bz-az, dy=by-ay;
  if (Math.hypot(dx,dz) < 0.001) return false;
  // grid 内部持有的是「过滤后」的块数组，必须用同一份，否则下标错位
  const blocks = world.grid ? world.grid.blocks : world.blocks;
  let list;
  if (world.grid){
    const out = [];
    querySegment(world.grid, ax,az,bx,bz, out);
    list = out;
  } else {
    list = [...blocks.keys()];
  }
  for (let k=0;k<list.length;k++){
    const b = typeof list[k]==='number' ? blocks[list[k]] : list[k];
    if (!b || b.h < 0.9) continue;
    const sx = slab(ax, dx, b.x-b.w/2, b.x+b.w/2);
    if (!sx) continue;
    const sz = slab(az, dz, b.z-b.d/2, b.z+b.d/2);
    if (!sz) continue;
    const t0 = Math.max(sx[0], sz[0], 0);
    const t1 = Math.min(sx[1], sz[1], 1);
    if (t0 > t1) continue;
    // 线段在该盒体内的高度是否低于盒顶（被挡住）
    const yAt = ay + dy*Math.max(0,t0);
    const yEnd = ay + dy*t1;
    if (Math.min(yAt, yEnd) < b.y + b.h - 0.25) return true;
  }
  return false;
}

/* 血条 */
function makeBar(){
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.0,.11),
    new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:.62, depthTest:false}));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(.96,.07),
    new THREE.MeshBasicMaterial({color:0xff4757, depthTest:false}));
  fg.position.z = .01;
  g.add(bg, fg);
  g.renderOrder = 999;
  g.visible = false;
  return { group:g, fg };
}

/* 伤害飘字 */
const dmgTexCache = new Map();
function dmgSprite(text, crit){
  const key = text + (crit?'!':'');
  if (dmgTexCache.has(key)) return dmgTexCache.get(key).clone();
  const c = document.createElement('canvas'); c.width=128; c.height=64;
  const x = c.getContext('2d');
  x.font = crit ? 'bold 46px sans-serif' : 'bold 36px sans-serif';
  x.textAlign='center'; x.textBaseline='middle';
  x.lineWidth=6; x.strokeStyle='rgba(0,0,0,.9)';
  x.strokeText(text,64,32);
  x.fillStyle = crit ? '#ffd24d' : '#ffffff';
  x.fillText(text,64,32);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.SpriteMaterial({ map:t, transparent:true, depthTest:false });
  dmgTexCache.set(key, s);
  return s;
}

export class Enemy {
  constructor(scene, x, z, tier=0){
    this.scene = scene;
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.yaw = rnd(0, Math.PI*2);
    this.hp = 100; this.maxHp = 100;
    this.armor = tier>0 ? 50 : 0;
    this.alive = true; this.dead = false;
    this.marked = false;
    this.tier = tier;                     // 0 普通 / 1 精锐 / 2 首领
    this.state = 'patrol';
    this.alertLevel = 0;
    this.fireCd = rnd(.8, 2.0);
    this.burst = 0; this.burstCd = 0;
    this.strafeDir = Math.random()<.5 ? 1 : -1;
    this.strafeTimer = rnd(1,3);
    this.target = new THREE.Vector3(x,0,z);
    this.waypoint = null;
    this.speed = tier===2 ? 3.4 : (tier===1 ? 3.0 : 2.5);
    this.accuracy = tier===2 ? .72 : (tier===1 ? .55 : .38);
    this.damage = tier===2 ? 22 : (tier===1 ? 16 : 11);
    this.killedBy = null;
    this.lastSeen = 0;
    this.dmgSprites = [];
    this.hitFlash = 0;
    this.deathT = 0;
    this._walk = 0; this._walkPhase = 0;
    this._build();
  }

  /* ---------- 建模：低模拟真士兵（分段躯干/战术头盔/背心弹匣袋/持枪姿态） ---------- */
  _build(){
    const g = new THREE.Group();
    // 兵种配色：杂兵土褐 / 精锐灰绿 / 王牌深灰+红色标识
    const suitCol = this.tier===2 ? 0x3d4148 : (this.tier===1 ? 0x46523f : 0x5c5238);
    const vestCol = this.tier===2 ? 0x23262c : (this.tier===1 ? 0x2c2f27 : 0x36332a);
    const helmCol = this.tier===2 ? 0x2e3238 : (this.tier===1 ? 0x363b34 : 0x454a3b);
    const M = {
      suit: new THREE.MeshLambertMaterial({ color: suitCol }),
      vest: new THREE.MeshLambertMaterial({ color: vestCol }),
      helm: new THREE.MeshLambertMaterial({ color: helmCol }),
      dark: new THREE.MeshLambertMaterial({ color: 0x1d1f1a }),
      boot: new THREE.MeshLambertMaterial({ color: 0x27251f }),
      skin: new THREE.MeshLambertMaterial({ color: 0x99734f }),
      gun : new THREE.MeshLambertMaterial({ color: 0x24261f }),
      acc : new THREE.MeshLambertMaterial({ color: this.tier===2 ? 0xb02820 : 0x8a3030 }),
      lens: new THREE.MeshPhongMaterial({ color: 0x161a1e, shininess: 110, specular: 0x9db8c8 }),
    };
    const mk = (geo, mat, x,y,z, rx=0,ry=0,rz=0, sh=true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x,y,z); m.rotation.set(rx,ry,rz); m.castShadow = sh;
      return m;
    };

    // ---- 躯干：腰带 / 腹部 / 胸部（分段） ----
    g.add(mk(new THREE.BoxGeometry(.40,.15,.26), M.dark, 0,.94,0));
    g.add(mk(new THREE.CapsuleGeometry(.21,.15,4,10), M.suit, 0,1.07,0));
    g.add(mk(new THREE.CapsuleGeometry(.27,.25,4,10), M.suit, 0,1.33,0));
    // ---- 战术背心：主板 + 前弹匣袋 ×3 ----
    g.add(mk(new THREE.BoxGeometry(.52,.40,.33), M.vest, 0,1.31,.02));
    g.add(mk(new THREE.BoxGeometry(.095,.15,.06), M.dark, -.115,1.25,.20, 0,0,0, false));
    g.add(mk(new THREE.BoxGeometry(.095,.15,.06), M.dark,    0,1.25,.21, 0,0,0, false));
    g.add(mk(new THREE.BoxGeometry(.095,.15,.06), M.dark,  .115,1.25,.20, 0,0,0, false));
    // 肩部护甲
    g.add(mk(new THREE.BoxGeometry(.16,.10,.24), M.vest, -.30,1.47,0));
    g.add(mk(new THREE.BoxGeometry(.16,.10,.24), M.vest,  .30,1.47,0));
    // ---- 头部：脸 / 巴拉克拉法帽罩（前脸开口）/ 战术头盔 / 盔沿 ----
    g.add(mk(new THREE.SphereGeometry(.148,12,10), M.skin, 0,1.70,0));
    g.add(mk(new THREE.SphereGeometry(.162,14,11, 2.17,5.08), M.suit, 0,1.705,0));
    g.add(mk(new THREE.SphereGeometry(.188,14,10, 0,Math.PI*2, 0,Math.PI*.56), M.helm, 0,1.725,0));
    g.add(mk(new THREE.BoxGeometry(.33,.035,.13), M.helm, 0,1.755,.13));
    // 护目镜：黑带 + 高光镜片
    g.add(mk(new THREE.BoxGeometry(.26,.06,.07), M.dark, 0,1.712,.125, 0,0,0, false));
    g.add(mk(new THREE.BoxGeometry(.21,.045,.02), M.lens, 0,1.712,.162, 0,0,0, false));
    // 王牌：盔顶红条 + 左臂红章（tier 识别）
    if (this.tier===2){
      g.add(mk(new THREE.BoxGeometry(.022,.02,.26), M.acc, 0,1.905,0, 0,0,0, false));
      g.add(mk(new THREE.BoxGeometry(.02,.07,.09), M.acc, -.395,1.42,.02, 0,0,0, false));
    }
    // ---- 背包 + 顶部卷毯 ----
    g.add(mk(new THREE.BoxGeometry(.31,.38,.15), M.vest, 0,1.27,-.27));
    g.add(mk(new THREE.CylinderGeometry(.052,.052,.27,8), M.suit, 0,1.495,-.25, 0,0,Math.PI/2, false));

    // ---- 持枪手臂（固定姿态）：上臂 / 前臂 / 手套 ----
    g.add(mk(new THREE.CapsuleGeometry(.075,.19,4,8), M.suit, -.315,1.335,.075, -.9,0,-.12));
    g.add(mk(new THREE.CapsuleGeometry(.065,.18,4,8), M.suit, -.185,1.19,.30, -1.30,0,0, false));
    g.add(mk(new THREE.CapsuleGeometry(.075,.19,4,8), M.suit,  .315,1.335,.075, -.9,0,.12));
    g.add(mk(new THREE.CapsuleGeometry(.065,.18,4,8), M.suit,  .235,1.16,.40, -1.30,0,0, false));
    g.add(mk(new THREE.BoxGeometry(.075,.085,.095), M.dark, -.135,1.115,.365, 0,0,0, false));
    g.add(mk(new THREE.BoxGeometry(.075,.085,.095), M.dark,  .255,1.095,.455, 0,0,0, false));

    // ---- 步枪（双手位）：机匣/护木/斜插弹匣/握把/枪托/枪口/瞄具 ----
    const gun = new THREE.Group();
    gun.add(mk(new THREE.BoxGeometry(.062,.095,.46), M.gun, 0,0,0));
    gun.add(mk(new THREE.BoxGeometry(.052,.062,.24), M.gun, 0,-.004,.325, 0,0,0, false));
    gun.add(mk(new THREE.BoxGeometry(.052,.165,.082), M.gun, 0,-.12,.095, .24,0,0, false));
    gun.add(mk(new THREE.BoxGeometry(.048,.105,.052), M.gun, 0,-.10,-.125, .18,0,0, false));
    gun.add(mk(new THREE.BoxGeometry(.044,.072,.21), M.gun, 0,-.018,-.315, 0,0,0, false));
    gun.add(mk(new THREE.CylinderGeometry(.020,.020,.13,8), M.gun, 0,.008,.515, Math.PI/2,0,0, false));
    if (this.tier===2)
      gun.add(mk(new THREE.BoxGeometry(.046,.052,.14), M.gun, 0,.075,.01, 0,0,0, false));  // 瞄准镜
    else
      gun.add(mk(new THREE.BoxGeometry(.04,.034,.09), M.gun, 0,.066,-.02, 0,0,0, false));  // 提把
    gun.position.set(.15, 1.155, .31);
    gun.rotation.y = -.09;
    g.add(gun);
    this.gun = gun;

    // ---- 腿：髋部枢轴（驱动走路摆动）大腿/小腿/护膝/军靴 ----
    const mkLeg = side => {
      const hip = new THREE.Group();
      hip.position.set(.135*side, .90, 0);
      hip.add(mk(new THREE.CapsuleGeometry(.122,.25,4,8), M.suit, 0,-.235,0));
      hip.add(mk(new THREE.CapsuleGeometry(.098,.25,4,8), M.suit, 0,-.60,0));
      hip.add(mk(new THREE.BoxGeometry(.105,.095,.055), M.dark, 0,-.415,.095, 0,0,0, false));
      hip.add(mk(new THREE.BoxGeometry(.148,.11,.29), M.boot, 0,-.845,.05));
      g.add(hip);
      return hip;
    };
    this.hipL = mkLeg(-1); this.hipR = mkLeg(1);

    g.position.set(this.pos.x, 0, this.pos.z);
    this.mesh = g;

    /* 部件合并：42~44 个独立 Mesh 按「材质 + 细节/主体」合并成十几个。
       敌人身上的材质只有 9 种，合批后 draw call 从 ~44 降到 ~12，
       37 个同屏敌人可从 ~1630 降到 ~450，这是流畅度的关键一步。
       髋部 hipL/hipR 单独成组，走路摆动动画不受影响。 */
    this.detail = [];
    this._mergeInto(g);
    this._mergeInto(this.hipL);
    this._mergeInto(this.hipR);

    // 命中盒（用于射线检测，比模型略大）
    const hit = new THREE.Mesh(new THREE.BoxGeometry(.9,1.9,.7),
      new THREE.MeshBasicMaterial({visible:false}));
    hit.position.y = .95;
    hit.userData.enemy = this;
    g.add(hit);
    this.hitbox = hit;

    // 头部命中盒
    const hh = new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),
      new THREE.MeshBasicMaterial({visible:false}));
    hh.position.y = 1.72;
    hh.userData.enemy = this; hh.userData.head = true;
    g.add(hh);
    this.headbox = hh;

    // 血条
    const bar = makeBar();
    bar.group.position.y = 2.16;
    g.add(bar.group);
    this.bar = bar;

    this.scene.add(g);
  }

  /**
   * 把 target 下所有 Mesh 按材质合并（几何体预乘相对变换后拼成一个 BufferGeometry）。
   * 细节件（小体积且不在头部）单独成批，供远距离 LOD 整批隐藏。
   */
  _mergeInto(target){
    target.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(target.matrixWorld).invert();
    const m4  = new THREE.Matrix4();
    const buckets = new Map();
    const doomed = [];
    target.traverse(o=>{
      if (o === target || !o.isMesh || o.isSprite) return;
      doomed.push(o);
    });
    for (const o of doomed){
      o.geometry.computeBoundingSphere();
      // 头部区域（y>1.6）永远算主体，避免远景掉脑袋
      const isDet = !(o.position.y > 1.6) && o.geometry.boundingSphere.radius < .15;
      const key = o.material.uuid + (isDet ? '|d' : '|c');
      let b = buckets.get(key);
      if (!b){ b = { mat:o.material, det:isDet, geos:[], shadow:false }; buckets.set(key, b); }
      if (o.castShadow) b.shadow = true;
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geo.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
      b.geos.push(geo);
    }
    for (const o of doomed){ o.parent.remove(o); o.geometry.dispose(); }
    for (const b of buckets.values()){
      const mesh = new THREE.Mesh(mergeGeoms(b.geos), b.mat);
      mesh.castShadow = b.shadow;
      if (b.det) this.detail.push(mesh);
      target.add(mesh);
    }
  }

  /* ---------- 受伤 ---------- */
  takeDamage(amount, part, fromDir, scene){
    if (!this.alive) return { dead:false, dmg:0 };
    let dmg = amount;
    // 护甲减伤
    if (this.armor > 0){
      const absorbed = Math.min(this.armor, dmg*0.55);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    // 部位倍率
    const mul = { head:2.6, chest:1.0, larm:.72, rarm:.72, lleg:.6, rleg:.6 }[part] || 1;
    dmg *= mul;
    this.hp -= dmg;
    this.alertLevel = 1;
    this.state = 'combat';
    this.lastSeen = performance.now();
    this.marked = true;
    this.hitFlash = .12;

    // 飘字
    const s = new THREE.Sprite(dmgSprite(String(Math.round(dmg)), part==='head'));
    s.position.set(this.pos.x + rnd(-.3,.3), 1.9, this.pos.z + rnd(-.3,.3));
    s.scale.set(1.0,.5,1);
    s.userData.life = 1.0;
    scene.add(s);
    this.dmgSprites.push(s);

    if (this.hp <= 0){ this.die(); return { dead:true, dmg:Math.round(dmg) }; }
    return { dead:false, dmg:Math.round(dmg) };
  }

  die(){
    this.alive = false; this.dead = true; this.state = 'dead';
    this.deathT = 0;
    this.bar.group.visible = false;
    this.hitbox.userData.enemy = null;
    this.headbox.userData.enemy = null;
    // 清理伤害飘字：update 在 dead 分支会提前 return，否则它们会永久悬停并泄漏
    for (const s of this.dmgSprites){
      this.scene.remove(s);
      if (s.material?.map) s.material.map.dispose();
      if (s.material) s.material.dispose();
    }
    this.dmgSprites.length = 0;
  }

  /* ---------- AI ---------- */
  update(dt, player, world, onShoot){
    if (this.dead){
      this.deathT += dt;
      const t = Math.min(1, this.deathT/0.7);
      this.mesh.rotation.x = -Math.PI/2 * t;
      this.mesh.position.y = -0.35 * t;
      if (this.deathT > 3.2 && this.mesh.parent){
        this.scene.remove(this.mesh);
        this.mesh.traverse(o=>{
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
            if (m.map) m.map.dispose();
            m.dispose();
          });
        });
      }
      return;
    }

    const dist = this.pos.distanceTo(player.pos);
    // 远处敌人降频：AI 决策与寻路不需要 60Hz，70m 外每 3 帧算一次（用 3 倍 dt 补偿）。
    // 绝密难度 37 个敌人时，这一项能省掉约 2/3 的 AI 开销。
    if (dist > 70){
      this._skip = (this._skip || 0) + 1;
      if (this._skip % 3 !== 0) return;
      dt *= 3;
    }
    // 超出能见距离整体隐藏：雾里已经基本看不见，整只跳过可省下全部 draw call
    const vis = dist < 160;
    if (this._vis !== vis){ this._vis = vis; this.mesh.visible = vis; }
    // LOD：45m 外隐藏细节件，绝密难度 37 敌时可省下约 1/3 的绘制对象
    const far = dist > 45;
    if (far !== this._lodFar){
      this._lodFar = far;
      for (const d of this.detail) d.visible = !far;
    }
    const eyeY = 1.62, playerY = player.pos.y + 1.6;
    // 视线检测降频（0.10~0.22s），避免每帧数十万次 AABB 运算
    this.losTimer = (this.losTimer||0) - dt;
    if (this.losTimer <= 0){
      this.losTimer = 0.10 + Math.random()*0.12;
      this.canSee = dist < 85 && !segmentBlocked(
        this.pos.x,this.pos.z,eyeY, player.pos.x,player.pos.z,playerY, world);
    }
    const canSee = !!this.canSee && dist < 85;

    // 玩家开枪会暴露位置
    if (player.justShot && dist < 70 && performance.now() - player.lastShotTime < 260){
      this.alertLevel = Math.max(this.alertLevel, .8);
      this.lastSeen = performance.now();
      this.target.set(player.pos.x, 0, player.pos.z);
    }

    if (canSee){
      this.alertLevel = 1;
      this.lastSeen = performance.now();
      this.target.set(player.pos.x, 0, player.pos.z);
      this.marked = true;
    } else if (performance.now() - this.lastSeen > 5200){
      this.alertLevel = Math.max(0, this.alertLevel - dt*0.35);
      if (this.alertLevel <= 0) { this.state='patrol'; this.marked = false; }
    }

    this.state = this.alertLevel > .05 ? 'combat' : 'patrol';

    // ---- 移动（复用临时向量，避免每敌每帧新建 2~3 个 Vector3）----
    const desired = _vA.set(0,0,0);
    if (this.state === 'patrol'){
      if (!this.waypoint || this.pos.distanceTo(this.waypoint) < 3){
        const wp = world.patrols[Math.floor(Math.random()*world.patrols.length)];
        this.waypoint = new THREE.Vector3(wp.x, 0, wp.z);
      }
      desired.copy(this.waypoint).sub(this.pos);
      this._move(desired, dt, world, this.speed*0.55);
    } else {
      const toP = _vB.copy(this.target).sub(this.pos);
      const d = toP.length();
      toP.normalize();
      // 交战：保持理想交战距离并侧移
      const ideal = this.tier===2 ? 18 : 13;
      const mv = _vC.set(0,0,0);
      if (d > ideal + 4) mv.copy(toP);
      else if (d < ideal - 5) mv.copy(toP).negate();
      // 侧移
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0){ this.strafeDir *= -1; this.strafeTimer = rnd(1.2,3.0); }
      mv.x += -toP.z * this.strafeDir * .85;
      mv.z +=  toP.x * this.strafeDir * .85;
      this._move(mv, dt, world, this.speed * (canSee ? 1 : .7));
      // 朝向玩家
      const want = Math.atan2(toP.x, toP.z);
      this.yaw = lerpAngle(this.yaw, want, dt*6);
    }
    this.mesh.position.set(this.pos.x, this.mesh.position.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    // 走路摆腿：_move 累计相位与强度，静止后收敛归零
    if (this._walk > 0) this._walk = Math.max(0, this._walk - dt*2.4);
    const amp = .55 * Math.min(1, this._walk);
    if (this.hipL){
      this.hipL.rotation.x =  Math.sin(this._walkPhase||0) * amp;
      this.hipR.rotation.x = -Math.sin(this._walkPhase||0) * amp;
    }

    // ---- 射击 ----
    this.fireCd -= dt;
    this.burstCd -= dt;
    if (this.state==='combat' && canSee && dist < 70){
      const aimErr = (1 - this.accuracy) * (0.5 + dist/55);
      if (this.fireCd <= 0){
        this.burst = 2 + Math.floor(Math.random()*3) + (this.tier===2?2:0);
        this.fireCd = rnd(1.1, 2.6) / (this.tier===2?1.6:1);
        this.burstCd = 0;
      }
      if (this.burst > 0 && this.burstCd <= 0){
        this.burst--; this.burstCd = rnd(.10,.17);
        const hit = Math.random() < this.accuracy * (1 - dist/110);
        onShoot(this, hit ? this.damage : 0, dist, aimErr);
      }
    }

    // ---- 血条 ----
    const showBar = this.hp < this.maxHp || this.alertLevel > .05;
    this.bar.group.visible = showBar;
    if (showBar){
      const p = Math.max(0, this.hp/this.maxHp);
      this.bar.fg.scale.x = p;
      this.bar.fg.position.x = -(1-p)*0.48;
      this.bar.fg.material.color.setHex(this.armor>0 ? 0x5ac8ff : (p>.5?0x4ade80:(p>.25?0xffd84d:0xff4757)));
      // billboard：血条挂在敌人 mesh 下，须先抵消父节点旋转（敌人转身不会带着血条乱转）
      this.mesh.updateWorldMatrix(true, false);
      _tmpQ1.setFromRotationMatrix(this.mesh.matrixWorld).invert();
      this.bar.group.quaternion.copy(_tmpQ2.copy(player.camQuat).premultiply(_tmpQ1));
    }
    // 受击闪红：只在状态翻转时遍历一次。
    // 原实现 else 分支每帧 traverse 全部部件并重写 emissive，37 敌时约 1600 次/帧
    const flashOn = this.hitFlash > 0;
    if (flashOn) this.hitFlash -= dt;
    if (flashOn !== this._flashOn){
      this._flashOn = flashOn;
      const hex = flashOn ? 0x551111 : 0x000000;
      this.mesh.traverse(o=>{ if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(hex); });
    }

    // 飘字动画
    for (let i=this.dmgSprites.length-1;i>=0;i--){
      const s = this.dmgSprites[i];
      s.userData.life -= dt;
      s.position.y += dt*0.9;
      s.material.opacity = Math.max(0, s.userData.life);
      if (s.userData.life <= 0){ this.scene.remove(s); this.dmgSprites.splice(i,1); }
    }
  }

  _move(dir, dt, world, speed){
    if (dir.lengthSq() < .0001) return;
    dir.y = 0; dir.normalize();
    const step = speed * dt;
    const nx = this.pos.x + dir.x*step, nz = this.pos.z + dir.z*step;
    if (!collides(nx, this.pos.z, .42, world, this.pos.y)) this.pos.x = nx;
    if (!collides(this.pos.x, nz, .42, world, this.pos.y)) this.pos.z = nz;
    this.pos.x = Math.max(-106, Math.min(106, this.pos.x));
    this.pos.z = Math.max(-106, Math.min(106, this.pos.z));
    // 走路动画相位（速度越快摆越快）
    this._walk = Math.min((this._walk||0) + dt*6, 1);
    this._walkPhase = (this._walkPhase||0) + step * 2.7;
    // 朝向
    if (this.state === 'patrol') this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), dt*3);
  }
}

/**
 * 圆柱体（半径 r，脚下 feetY，身高 H）与地图方块的水平碰撞。
 * 必须做高度判定：坝顶/楼顶悬板/塔架平台是悬空块，
 * 若只看平面投影会在其正下方形成「隐形墙」。
 * 优先走空间网格（atRect），把全表 ~270 块降到单元内几块。
 */
const _colIdx = [];
export function collides(x, z, r, world, feetY=0, H=1.75){
  if (Math.abs(x) > world.bounds-2 || Math.abs(z) > world.bounds-2) return true;
  const lo = feetY + 0.25;          // 膝盖以上才算阻挡（可跨过矮台阶）
  const hi = feetY + H;
  if (world.grid){
    const blocks = world.grid.blocks;
    const list = world.grid.atRect(x, z, r, _colIdx);
    for (let i=0;i<list.length;i++){
      const b = blocks[list[i]];
      if (b.y >= hi || b.y + b.h <= lo) continue;
      if (x > b.x-b.w/2-r && x < b.x+b.w/2+r && z > b.z-b.d/2-r && z < b.z+b.d/2+r) return true;
    }
    return false;
  }
  for (const b of world.blocks){
    if (b.y >= hi || b.y + b.h <= lo) continue;   // 高度不相交
    if (x > b.x-b.w/2-r && x < b.x+b.w/2+r && z > b.z-b.d/2-r && z < b.z+b.d/2+r) return true;
  }
  return false;
}

function lerpAngle(a, b, t){
  let d = ((b-a+Math.PI)%(Math.PI*2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI*2;
  return a + d*t;
}
