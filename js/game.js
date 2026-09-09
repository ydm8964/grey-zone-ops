/* ============================================================
   战斗核心：移动 / 射击 / 武器 / 搜刮 / 撤离 / 结算
============================================================ */
import * as THREE from 'three';
import { WEAPONS, ITEMS, RARITY, itemIcon } from './config.js';
import { buildWorld } from './world.js';
import { Enemy, collides, segmentBlocked } from './enemy.js';
import { Audio2 } from './audio.js';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rnd = (a,b)=> a+Math.random()*(b-a);
const lerp = (a,b,t)=> a+(b-a)*t;

const ENEMY_NAMES = ['阿萨拉卫队士兵','阿萨拉卫队精锐','阿萨拉卫队队长','阿萨拉卫队狙击手','阿萨拉重装兵'];
const LOOT_TABLE = [
  ['ammo556',30],['ammo762',18],['ammo9',22],['ifak',14],['painkiller',12],
  ['armorplate',10],['tourniquet',9],['medkit',7],['surgery',3],
  ['cigar',10],['vase',7],['dogtag',12],['fuel',5],['gpu',4],
  ['bitcoin',2],['goldcup',1],
];

function rollLoot(mul, tierBonus=0){
  const n = 1 + Math.floor(Math.random()*3) + (Math.random()<0.25*mul?1:0) + tierBonus;
  const out = [];
  for (let i=0;i<n;i++){
    const total = LOOT_TABLE.reduce((s,x)=>s+x[1],0);
    let r = Math.random()*total;
    for (const [id,w] of LOOT_TABLE){
      r -= w;
      if (r<=0){ out.push(id); break; }
    }
  }
  return out;
}

export class Game {
  constructor(canvas, hud){
    this.canvas = canvas; this.hud = hud;
    this.running = false; this.paused = false; this.uiMode = null;
    this.keys = {}; this.mouse = { left:false, right:false };
    this.enemies = []; this.grenades = []; this.decals = []; this.bloods = []; this.smokes = [];
    this.fpsT = 0; this.fpsC = 0; this.fps = 60; this.ping = 18;
    this.time = 0; this.clock = new THREE.Clock();
    this._initRenderer();
    this._bindInput();
  }

  /* ================= 初始化 ================= */
  _initRenderer(){
    try {
      // antialias:false —— 高画质档位本来就是 1.5 倍超采样（等效 SSAA），
      // 再叠 4x MSAA 是双重抗锯齿：观感提升有限，带宽开销巨大，集显上这是最大的单项帧率杀手
      this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:false, powerPreference:'high-performance' });
    } catch(err){
      this.noWebgl = true;
      console.warn('WebGL 不可用：', err.message);
      return;
    }
    // 渲染精度上限 1.5：高 DPI 屏用 2.0 等于 4 倍像素填充，是集显掉帧主因
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;   // 比 PCFSoft 便宜，观感接近
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    // far 350：FogExp2 0.0075 在 330m 处已几乎全雾，600 只会浪费深度精度与裁剪开销
    this.camera = new THREE.PerspectiveCamera(90, innerWidth/innerHeight, 0.05, 350);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    addEventListener('resize', ()=>{
      this.camera.aspect = innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  _bindInput(){
    addEventListener('keydown', e=>{
      if (e.code==='Tab') e.preventDefault();
      if (this.keys[e.code]) return;
      this.keys[e.code] = true;
      this._onKey(e.code, true);
    });
    addEventListener('keyup', e=>{
      this.keys[e.code]=false;
      if (e.code==='Tab' && this.running) this._showBoard(false);   // 松开 Tab 收起计分板
      this._onKey(e.code, false);
    });
    addEventListener('mousedown', e=>{
      if (!document.pointerLockElement) return;
      if (e.button===0) this.mouse.left = true;
      if (e.button===2) this.mouse.right = true;
    });
    addEventListener('mouseup', e=>{
      if (e.button===0) this.mouse.left = false;
      if (e.button===2) this.mouse.right = false;
    });
    addEventListener('contextmenu', e=>e.preventDefault());
    addEventListener('mousemove', e=>{
      if (!document.pointerLockElement || !this.running || this.uiMode) return;
      // 开镜灵敏度取自设置（adsSensScale），狙击镜再按比例进一步放慢
      const ads = this.adsSensScale ?? .8;
      const s = this.sensitivity * (this.p.ads ? (this.p.weapon.scope>2 ? ads*0.44 : ads*0.78) : 1);
      this.p.yaw   -= e.movementX * 0.0022 * s;
      this.p.pitch -= e.movementY * 0.0022 * s * (this.cfg?.settings?.invertY ? -1 : 1);
      this.p.pitch = clamp(this.p.pitch, -Math.PI/2+0.02, Math.PI/2-0.02);
    });
    document.addEventListener('pointerlockchange', ()=>{
      if (!this.running) return;
      if (!document.pointerLockElement && !this.uiMode && !this.ended){
        this.paused = true; this.hud.showPause(true); this.mouse.left=this.mouse.right=false;
      }
    });
    this.canvas.addEventListener('click', ()=>{
      if (this.running && !this.uiMode && !this.ended) this.canvas.requestPointerLock();
    });
    // UI 按钮
    document.getElementById('btnResume').onclick = ()=>{
      this.paused=false; this.hud.showPause(false); this.canvas.requestPointerLock();
    };
    document.getElementById('btnAbandon').onclick = ()=>{ this.end(false,'主动放弃行动'); };
    document.getElementById('btnAgain').onclick = ()=>{
      this.hud.hideResult(); this.start(this.cfg);
    };
    document.getElementById('btnBackLobby').onclick = ()=>{
      this.hud.hideResult(); this.stop(); this.onExit && this.onExit();
    };
    document.getElementById('bpClose').onclick = ()=>{ this._closeBag(); };
  }

  _onKey(code, down){
    if (!this.running || !down) return;
    if (code!=='Escape' && (this.paused || this.uiMode)) return;  // 暂停/背包中屏蔽其余按键
    const p = this.p;
    switch(code){
      case 'Digit1': this._switchWeapon(1); break;
      case 'Digit2': this._switchWeapon(2); break;
      case 'Digit3': this._useQuick(0); break;
      case 'Digit4': this._useQuick(1); break;
      case 'Digit5': this._useQuick(2); break;
      case 'Digit6': this._useQuick(3); break;
      case 'Digit7': this._useQuick(4); break;
      case 'KeyR': this._reload(); break;
      case 'KeyF': this._tryInteract(); break;
      case 'KeyG': this._throwGrenade(); break;
      case 'KeyH': this._quickHeal(); break;
      case 'KeyB': this._toggleBag(); break;
      case 'Tab': this._showBoard(true); break;
      case 'KeyM': this.hud.toast('战术地图（开发中）','#ff9d2e'); break;
      case 'KeyV': this._switchFireMode(); break;
      case 'Escape':
        if (this.uiMode==='bag'){ this._closeBag(); }
        else if (!this.uiMode){ this.paused=true; this.hud.showPause(true); }
        break;
    }
  }

  /* ================= 开局 ================= */
  start(cfg){
    if (this.noWebgl){
      this.hud.toast('当前浏览器不支持 WebGL，无法进入战斗', '#ff4757');
      return false;
    }
    this.cfg = cfg;
    const S = cfg.settings;
    this.sensitivity = S.sens ?? 1.0;
    this.adsSensScale = S.adsSens ?? .8;
    this.camera.fov = S.fov ?? 90;
    this.camera.updateProjectionMatrix();
    // 画质预设：此前 settings.quality 只是存了却从未生效，选「流畅」等于没选
    const q = S.quality || 'high';
    if (q === 'low'){
      // 流畅：降渲染分辨率 + 关实时阴影（最影响帧率的两项）
      this.renderer.setPixelRatio(0.8);
      this.renderer.shadowMap.enabled = false;
      this._qLevel = 1;                    // 阴影已关，自适应只需再降分辨率
    } else if (q === 'medium'){
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.0));
      this.renderer.shadowMap.enabled = S.shadow !== false;
      this._qLevel = 0;
    } else {
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = S.shadow !== false;
      this._qLevel = 0;
    }
    this.renderer.setSize(innerWidth, innerHeight);

    // 清空场景：释放上一局 geometry 与独享材质；
    // MAT 共享材质（userData.shared）与飘字 sprite 材质必须跳过，否则下局材质失效
    this.scene.traverse(o=>{
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) if (m && !m.userData?.shared && !m.isSpriteMaterial) m.dispose();
    });
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
    this.scene.add(this.camera);
    this.enemies = []; this.grenades = []; this.decals = []; this.bloods = []; this.smokes = [];
    // 上局残留：按住 W / 左键 / 使用回调未复位 → 重开会自动前进、自动开火
    this.keys = {}; this.mouse.left = this.mouse.right = false;
    this._useDone = null; this._firedThisClick = false; this._burstLeft = 0;
    this.ended = false; this.uiMode = null; this.paused = false;
    this._enemyDirty = false;
    // 画质自适应计时复位（等级由上面的预设决定，不要在这里清零后又被自动降级重复处理）
    this._lowT = 0;

    this.world = buildWorld(this.scene, cfg.map, cfg.diff);
    this._initFxPool();

    // 玩家
    const sp = this.world.spawnPoints[Math.floor(Math.random()*this.world.spawnPoints.length)];
    this.p = {
      pos: new THREE.Vector3(sp.x, 0, sp.z),
      vel: new THREE.Vector3(), yaw: 0, pitch: 0,
      hp:100, maxHp:100, armor:100, maxArmor:100, stamina:100,
      body:{head:100,chest:100,larm:100,rarm:100,lleg:100,rleg:100},
      bleeding:0, onGround:true, crouch:false, sprint:false, eyeH:1.62,
      inv:['m4a1','g17'], wIdx:0, weapon: WEAPONS.m4a1, wKey:'m4a1', mode:'auto',
      mag: WEAPONS.m4a1.mag, reserve: WEAPONS.m4a1.reserve,
      reloading:false, reloadT:0, fireT:0, ads:false, adsT:0, spread:0,
      recoilP:0, recoilY:0, kick:0, bob:0, stepT:0,
      grenades:2, grenadeCd:0,
      quick:[ {id:'medkit',qty:2}, {id:'ifak',qty:3}, {id:'tourniquet',qty:1},
              {id:'armorplate',qty:2}, {id:'painkiller',qty:2} ],
      bag:new Array(20).fill(null), bagCap:20, selIdx:null,
      using:null, usingT:0,
      kills:0, dmgDealt:0, lootValue:0, looted:0,
      justShot:false, lastShotTime:0,
      extractT:0, extracted:false,
    };
    this.p.mag = this.p.weapon.mag;
    this.p.reserve = this.p.weapon.reserve;
    // 初始背包装些东西
    this.p.bag[0] = {id:'ammo556', qty:60};
    this.p.bag[1] = {id:'ifak', qty:1};

    // 视角朝向地图中心
    this.p.yaw = Math.atan2(-sp.x, -sp.z);
    this.p.pitch = 0;

    this._buildGun();
    this._spawnEnemies();

    // 计时
    this.timeLeft = parseInt(cfg.map.time) * 60;
    this.totalTime = this.timeLeft;
    this.ended = false; this.paused = false; this.uiMode = null;
    this.running = true;
    this.hud.hideResult();
    this.hud.showPause(false);
    this.hud.showBackpack(false);
    this.hud.showExtract(false);
    this.hud.setMission('搜索物资并前往撤离点');
    this._updateObjectives();
    this.hud.renderQuickbar(this.p.quick.map(q=>({...ITEMS[q.id], qty:q.qty})), -1);
    this.hud.banner(cfg.map.name);
    this.hud.toast(`难度 ${cfg.diff.n} · 干员 ${cfg.operator.name}`, '#d8ff3e');

    if (!this._loopStarted){
      this._loopStarted = true;
      this.clock.start();
      this._loop();
    }
  }

  stop(){
    this.running = false;
    document.exitPointerLock?.();
  }

  _spawnEnemies(){
    const D = this.cfg.diff;
    const base = 22;
    const count = Math.round(base * D.enemyMul);
    const spawn = this.world.spawnPoints[0];
    for (let i=0;i<count;i++){
      let x, z, tries=0;
      do {
        x = rnd(-100,100); z = rnd(-100,100); tries++;
      } while (tries<40 && (
        Math.hypot(x-this.p.pos.x, z-this.p.pos.z) < 45 || collides(x,z,1.0,this.world)
      ));
      const tierRoll = Math.random();
      const tier = tierRoll < .06*D.enemyMul ? 2 : (tierRoll < .30*D.enemyMul ? 1 : 0);
      const e = new Enemy(this.scene, x, z, tier);
      e.name = ENEMY_NAMES[tier===2?2:(tier===1?1:0)] + ' #' + String(i+1).padStart(2,'0');
      e.loot = rollLoot(D.lootMul, tier);
      this.enemies.push(e);
    }
  }

  /* ================= 武器视图模型 ================= */
  _buildGun(){
    if (this.gunGroup) this.camera.remove(this.gunGroup);
    const g = new THREE.Group();
    const w = this.p.weapon;
    const dark = new THREE.MeshLambertMaterial({color:0x23231f});
    const body = new THREE.MeshLambertMaterial({color:0x3a3a34});
    const metal = new THREE.MeshLambertMaterial({color:0x2b2b28});
    const sleeve = new THREE.MeshLambertMaterial({color:0x4d5440});  // 作战服袖
    const glove  = new THREE.MeshLambertMaterial({color:0x262219});  // 战术手套

    const isSniper = w.scope >= 3;
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(.085,.115,.46), body);
    const barrel   = new THREE.Mesh(new THREE.BoxGeometry(.042,.042, isSniper?.62:.34), metal);
    barrel.position.set(0,.012, isSniper ? -.52 : -.34);
    // 枪口制退器
    const brake = new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.10,10), metal);
    brake.rotation.x = Math.PI/2; brake.position.set(0,.012, isSniper?-.82:-.50);
    // 弹匣（微前倾）
    const mag      = new THREE.Mesh(new THREE.BoxGeometry(.062,.20,.10), dark);
    mag.position.set(0,-.15,.02); mag.rotation.x = .12;
    const stock    = new THREE.Mesh(new THREE.BoxGeometry(.07,.095,.22), body);
    stock.position.set(0,-.01,.32);
    const grip     = new THREE.Mesh(new THREE.BoxGeometry(.055,.15,.07), dark);
    grip.position.set(0,-.12,.20); grip.rotation.x = -.22;
    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(.05,.10,.06), dark);
    foregrip.position.set(0,-.085,-.18);
    const rail     = new THREE.Mesh(new THREE.BoxGeometry(.05,.022,.30), dark);
    rail.position.set(0,.072,-.02);
    const sight    = new THREE.Mesh(new THREE.BoxGeometry(.036,.05,.09), dark);
    sight.position.set(0,.10,-.14);
    // 准星
    const fsight = new THREE.Mesh(new THREE.BoxGeometry(.012,.048,.012), metal);
    fsight.position.set(0,.098,-.285);
    // ---- 第一人称双手 + 前臂 ----
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(.078,.11,.11), glove);
    rHand.position.set(.005,-.115,.205); rHand.rotation.x = -.22;     // 握把
    const rArm  = new THREE.Mesh(new THREE.BoxGeometry(.092,.092,.30), sleeve);
    rArm.position.set(.055,-.215,.385); rArm.rotation.set(.55,-.15,0); // 伸向画面右下
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(.075,.10,.13), glove);
    lHand.position.set(0,-.075,-.17);                                  // 托护木
    const lArm  = new THREE.Mesh(new THREE.BoxGeometry(.092,.092,.34), sleeve);
    lArm.position.set(-.075,-.245,.075); lArm.rotation.set(.95,.30,0); // 伸向画面左下
    if (isSniper){
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.30,12), dark);
      scope.rotation.x = Math.PI/2; scope.position.set(0,.11,-.02);
      g.add(scope);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.038,12),
        new THREE.MeshBasicMaterial({color:0x1a3a1a}));
      lens.position.set(0,.11,-.17); lens.rotation.y=Math.PI;
      g.add(lens);
    }
    // 枪口火焰
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(.34,.34),
      new THREE.MeshBasicMaterial({ color:0xffdd66, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
    flash.position.set(0,.012, isSniper ? -.85 : -.53);
    g.add(flash);

    g.add(receiver,barrel,brake,mag,stock,grip,foregrip,rail,sight,fsight,rHand,rArm,lHand,lArm,flash);
    g.position.set(.20,-.175,-.34);
    g.rotation.set(0,.06,0);
    g.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    this.gunGroup = g; this.gunFlash = flash;
    this.gunBase = new THREE.Vector3(.20,-.175,-.34);
    this.gunAds  = new THREE.Vector3(0,-.108,-.24);
    this.camera.add(g);

    // 枪口光源
    if (this.muzzleLight) this.camera.remove(this.muzzleLight);
    const ml = new THREE.PointLight(0xffcc66, 0, 8, 2);
    ml.position.set(0,0,-.6);
    this.camera.add(ml); this.muzzleLight = ml;
  }

  _switchWeapon(i){
    if (this.p.reloading || this.p.using) return;
    const key = this.p.inv[i-1]; if (!key) return;
    if (this.p.wIdx === i-1) return;
    this.p.wIdx = i-1; this.p.wKey = key; this.p.weapon = WEAPONS[key];
    // 切换不补弹：保留当前携带量，mag 不超过新武器上限；reserve 不凭空恢复
    this.p.mag = Math.min(this.p.mag, this.p.weapon.mag);
    this.p.mode = this.p.weapon.modes[0];
    this.p.reloading = false; this.p.reloadT = 0; this.p.ads = false;
    this._buildGun(); Audio2.ui('click');
    this.hud.toast(this.p.weapon.cn, '#d8ff3e');
  }
  _switchFireMode(){
    const m = this.p.weapon.modes;
    if (m.length<2) return;
    this.p.mode = m[(m.indexOf(this.p.mode)+1)%m.length];
    Audio2.ui('click');
  }
  _reload(){
    const p = this.p;
    if (p.reloading || p.mag >= p.weapon.mag || p.reserve <= 0 || p.using) return;
    p.reloading = true; p.reloadT = p.weapon.reload;
    Audio2.reload();
    this.hud.toast('换弹中…','#ff9d2e');
  }
  _finishReload(){
    const p = this.p, w = p.weapon;
    const need = w.mag - p.mag;
    const take = Math.min(need, p.reserve);
    p.mag += take; p.reserve -= take;
    p.reloading = false;
  }

  /* ================= 射击 ================= */
  _shoot(){
    const p = this.p, w = p.weapon;
    if (p.reloading || p.using || p.fireT > 0) return;
    if (p.mag <= 0){ Audio2.dryFire(); p.fireT = .25; this._reload(); return; }

    p.mag--; p.fireT = 60/w.rpm;
    p.justShot = true; p.lastShotTime = performance.now();

    // 扩散
    const baseSpread = p.ads ? w.adsSpread : (p.crouch ? w.spread*.6 : w.spread);
    const moveSpread = (this._moveAmt) * (p.ads?1.2:2.2);
    p.spread = Math.min(baseSpread + moveSpread + p.spread*.35, 9);

    // 后坐力
    const rc = w.recoil;
    p.recoilP += rc.y * (p.ads?.65:1) * rnd(.75,1.25) * 0.011;
    p.recoilY += rc.x * rnd(-1,1) * 0.011;
    p.kick = Math.min(p.kick + .035, .09);

    // 音效 / 火焰
    const cal = w.scope>=3?'sniper':(w.pellets?'shotgun':(w.rpm>900?'smg':(w.name==='G17'?'pistol':'rifle')));
    Audio2.shot(cal, 0);
    this.gunFlash.material.opacity = 1;
    this.gunFlash.rotation.z = rnd(0,Math.PI);
    this.gunFlash.scale.setScalar(rnd(.8,1.4));
    this.muzzleLight.intensity = 3.2;   // 衰减在 _updateWeapon 主循环里做，不再每发开 setTimeout

    // 射线
    const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    const spreadRad = p.spread * 0.0022;
    dir.x += rnd(-spreadRad,spreadRad);
    dir.y += rnd(-spreadRad,spreadRad) + p.recoilP*0.06;
    dir.z += rnd(-spreadRad,spreadRad);
    dir.normalize();

    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const pellets = w.pellets || 1;
    let anyHit = false, anyKill = false;
    for (let i=0;i<pellets;i++){
      const d = dir.clone();
      if (pellets>1){
        d.x += rnd(-.035,.035); d.y += rnd(-.035,.035); d.z += rnd(-.035,.035); d.normalize();
      }
      const r = this._castRay(origin, d, w.range);
      if (r.hitEnemy){
        anyHit = true;
        const res = r.enemy.takeDamage(r.head? w.dmg*1.0 : w.dmg, r.part, d, this.scene);
        p.dmgDealt += res.dmg;
        this.hud.hitmark(res.dead);
        Audio2[r.head?'headshot':'hit']();
        this._spawnBloodFx(r.point);
        if (res.dead){
          anyKill = true;
          this._enemyDirty = true;
          p.kills++;
          Audio2.kill();
          this.hud.banner('已 击 毙');
          this.hud.addKill('你', r.enemy.name, w.name, r.head, true);
          this._dropLoot(r.enemy);
        }
      } else if (r.point){
        this._spawnDecal(r.point, d);
      }
    }
    if (anyKill) this._updateObjectives();
  }

  _castRay(origin, dir, maxDist){
    // 1) 敌人（AABB）
    let best = null, bestT = maxDist;
    for (const e of this.enemies){
      if (!e.alive) continue;
      const t = rayAABB(origin, dir, e.pos.x-.46, e.pos.y, e.pos.z-.38,
                                      e.pos.x+.46, e.pos.y+1.55, e.pos.z+.38);
      if (t!==null && t<bestT){ bestT = t; best = {enemy:e, head:false}; }
      const th = rayAABB(origin, dir, e.pos.x-.24, e.pos.y+1.52, e.pos.z-.24,
                                       e.pos.x+.24, e.pos.y+1.96, e.pos.z+.24);
      if (th!==null && th<bestT){ bestT = th; best = {enemy:e, head:true}; }
    }
    // 2) 墙
    const wallT = this._rayWall(origin, dir, maxDist);
    if (best && (!wallT || bestT < wallT)){
      const point = origin.clone().addScaledVector(dir, bestT);
      const part = best.head ? 'head'
        : (point.y - best.enemy.pos.y > 1.0 ? 'chest'
        : (point.y - best.enemy.pos.y > .55 ? (Math.random()<.5?'lleg':'rleg')
        : 'lleg'));
      return { hitEnemy:true, enemy:best.enemy, head:best.head, part, point, t:bestT };
    }
    if (wallT){
      return { hitEnemy:false, point: origin.clone().addScaledVector(dir, wallT), t:wallT };
    }
    return { hitEnemy:false, point:null };
  }

  _rayWall(origin, dir, maxDist){
    const step = .55;
    const p = new THREE.Vector3();
    let prevBlocked = false;
    for (let d=0.25; d<maxDist; d+=step){
      p.copy(origin).addScaledVector(dir, d);
      if (p.y < 0) return d;
      const blocked = collides(p.x, p.z, .10, this.world, p.y)
        || Math.abs(p.x)>this.world.bounds || Math.abs(p.z)>this.world.bounds;
      if (blocked){
        // 回退细化
        let a = d-step, b = d;
        for (let k=0;k<6;k++){
          const m=(a+b)/2;
          p.copy(origin).addScaledVector(dir, m);
          if (collides(p.x,p.z,.10,this.world, p.y)) b=m; else a=m;
        }
        return a;
      }
    }
    return null;
  }

  _spawnDecal(point, dir){
    // 弹孔走对象池：46 个轮换，超出后抢占最早的位置，战斗中零分配
    const P = this.fxPool.decal;
    const m = P.list[P.i]; P.i = (P.i + 1) % P.list.length;
    m.position.copy(point).addScaledVector(dir, .02);
    m.lookAt(this._fxV.copy(point).sub(dir));
    m.scale.setScalar(rnd(.7, 1.3));
    if (!m.visible) m.visible = true;
    // 火花：同样池化，用 life 在主循环里熄灭（不再每次 setTimeout 新建对象）
    const S = this.fxPool.spark;
    const sp = S.list[S.i]; S.i = (S.i + 1) % S.list.length;
    sp.position.copy(point); sp.userData.v = null;
    sp.userData.life = .06;
    if (!sp.visible) sp.visible = true;
    const idx = this.bloods.indexOf(sp);
    if (idx >= 0) this.bloods.splice(idx, 1);
    this.bloods.push(sp);
  }
  _spawnBloodFx(point){
    const B = this.fxPool.blood;
    for (let i=0;i<5;i++){
      const m = B.list[B.i]; B.i = (B.i + 1) % B.list.length;
      m.position.copy(point);
      m.scale.setScalar(rnd(.6,1.4));
      m.userData.v.set(rnd(-2,2), rnd(0,3), rnd(-2,2));
      m.userData.life = .5;
      m.material.opacity = .9;
      if (!m.visible) m.visible = true;
      const idx = this.bloods.indexOf(m);
      if (idx >= 0) this.bloods.splice(idx, 1);
      this.bloods.push(m);
    }
  }
  /* 开火特效对象池：弹孔/火花共享几何与材质，血点需要独立透明度所以每实例克隆材质。
     池只在本局开始时建一次，对枪时不再分配任何 geometry / material / Vector3。 */
  _initFxPool(){
    const mk = (geo, mat, n) => {
      const arr = [];
      for (let i=0;i<n;i++){
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        m.userData.life = 0; m.userData.v = null;
        this.scene.add(m); arr.push(m);
      }
      return { list: arr, i: 0 };
    };
    this.fxPool = {
      decal: mk(new THREE.CircleGeometry(.07, 8),
        new THREE.MeshBasicMaterial({color:0x111111, transparent:true, opacity:.85, depthWrite:false}), 46),
      spark: mk(new THREE.SphereGeometry(.05, 6, 5),
        new THREE.MeshBasicMaterial({color:0xffcc66}), 24),
      blood: null,
    };
    // 血点：每实例克隆材质（透明度各自衰减）
    const bGeo = new THREE.SphereGeometry(.05, 5, 4);
    const bArr = [];
    for (let i=0;i<60;i++){
      const m = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({color:0xaa1420, transparent:true, opacity:.9}));
      m.visible = false;
      m.userData.life = 0; m.userData.v = new THREE.Vector3();
      this.scene.add(m); bArr.push(m);
    }
    this.fxPool.blood = { list: bArr, i: 0 };
    this._fxV = new THREE.Vector3();
  }

  _dropLoot(e){
    // 击杀掉落：直接标记为可拾取尸体（简化为就地生成一个物资堆）
    const pos = e.pos.clone();
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(.8,.4,.6),
      new THREE.MeshLambertMaterial({color:0x4a3a24}));
    box.position.y=.2; box.castShadow=true;
    g.add(box); g.position.copy(pos); this.scene.add(g);
    this.world.lootboxes.push({ x:pos.x, z:pos.z, mesh:g, lid:box, opened:false, id:9000+Math.random()*1000, loot:e.loot||rollLoot(this.cfg.diff.lootMul, e.tier), isBody:true });
    this.world.minimapBlocks.push({x:pos.x, z:pos.z, w:.9, d:.8, rot:0});
  }

  /* ================= 投掷物 ================= */
  _throwGrenade(){
    const p = this.p;
    if (p.grenades<=0 || p.grenadeCd>0 || p.using) return;
    p.grenades--; p.grenadeCd = 1.0;
    const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    const g = new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),
      new THREE.MeshLambertMaterial({color:0x3a4a2a}));
    g.position.copy(this.camera.getWorldPosition(new THREE.Vector3())).addScaledVector(dir,.6);
    g.castShadow = true;
    this.scene.add(g);
    this.grenades.push({ mesh:g, vel: dir.multiplyScalar(24).add(new THREE.Vector3(0,4,0)), fuse:2.6, hit:false });
    Audio2.ui('click');
  }
  _explode(pos){
    Audio2.explosion();
    // 视觉
    const f = new THREE.Mesh(new THREE.SphereGeometry(1.4,12,10),
      new THREE.MeshBasicMaterial({color:0xffaa33, transparent:true, opacity:.75}));
    f.position.copy(pos); this.scene.add(f);
    const light = new THREE.PointLight(0xff8833, 8, 22, 2);
    light.position.copy(pos); this.scene.add(light);
    let t=0;
    const anim = setInterval(()=>{
      t+=.05; f.scale.setScalar(1+t*3.2);
      f.material.opacity = Math.max(0, .75-t*1.6);
      light.intensity = Math.max(0, 8-t*18);
      if (t>.5){ clearInterval(anim); this.scene.remove(f); this.scene.remove(light); }
    }, 40);
    // 伤害
    for (const e of this.enemies){
      if (!e.alive) continue;
      const d = e.pos.distanceTo(pos);
      if (d < 7){
        const dmg = Math.round(120 * (1 - d/7));
        const r = e.takeDamage(dmg, 'chest', null, this.scene);
        this.p.dmgDealt += r.dmg;
        this.hud.hitmark(r.dead);
        if (r.dead){
          this._enemyDirty = true;
          this.p.kills++; Audio2.kill();
          this.hud.addKill('你', e.name, '手雷', false, true);
          this._dropLoot(e);
        }
      }
    }
    const dp = this.p.pos.distanceTo(pos);
    if (dp < 6 && dp > 0){
      this._takeDamage(Math.round(70*(1-dp/6)), 'chest', pos);
    }
  }

  /* ================= 受伤 ================= */
  _takeDamage(amount, part, fromPos){
    const p = this.p;
    if (this.ended) return;
    let dmg = amount;
    if (p.armor > 0){
      const absorb = Math.min(p.armor, dmg*.55);
      p.armor -= absorb; dmg -= absorb;
    }
    const mul = {head:2.4,chest:1,larm:.7,rarm:.7,lleg:.55,rleg:.55}[part]||1;
    dmg *= mul;
    const target = part==='head' ? 'head' : (part==='chest' ? 'chest' : part);
    p.body[target] -= dmg * (part==='head'?55:(part==='chest'?70:60)) / 70;
    p.hp -= dmg;
    Audio2.pain();
    this.hud.flash();
    // 方向指示（CSS rotate 顺时针为正，0 = 正前方）。
    // 世界方位角 ang = atan2(dx,dz)；yaw 为正表示玩家逆时针转，世界相对玩家顺时针偏 yaw。
    // 屏幕角 = π + yaw - ang。原写法是 π - ang - yaw，差 2yaw：不转身碰巧正确，转身后前后颠倒。
    if (fromPos){
      const ang = Math.atan2(fromPos.x-p.pos.x, fromPos.z-p.pos.z);
      this.hud.damageFrom(Math.PI + p.yaw - ang);
    }
    // 出血
    if (p.body[target] <= 0 && !p.bleeding && Math.random()<.5){
      p.bleeding = 1; this.hud.toast('大出血！需要止血带','#ff4757');
    }
    if (p.hp <= 0){
      p.hp = 0;
      this.end(false, `被 ${part==='head'?'爆头':'火力'}击倒`);
    }
  }

  /* ================= 背包 / 物品 ================= */
  _toggleBag(){
    if (this.uiMode==='bag'){ this._closeBag(); return; }
    // 读条使用中禁止开背包：否则可在读条途中丢弃正在使用的格子
    if (this.uiMode || this.ended || this.p.using) return;
    this.uiMode = 'bag';
    this.paused = true;
    document.exitPointerLock?.();
    this.hud.showBackpack(true);
    this._renderBag();
  }
  _closeBag(){
    this.uiMode = null; this.paused = false;
    this.hud.showBackpack(false);
    this.canvas.requestPointerLock();
  }
  _renderBag(){
    const p = this.p;
    this.hud.renderBackpack({
      bag:p.bag, bagCap:p.bagCap, selIdx:p.selIdx,
      equip:{
        weapon1:{ def:{n:p.weapon.cn, rare:'blue', ic:'rifle'}, info:p.weapon.cal },
        weapon2:{ def:{n:WEAPONS.g17.cn, rare:'white', ic:'rifle'}, info:'9×19mm' },
        helmet:{ def:{n:'三级战术头盔', rare:'blue', ic:'helmet'}, info:'耐久 60/60' },
        armor:{ def:{n:'三级战术背心', rare:'blue', ic:'plate'}, info:`耐久 ${Math.ceil(p.armor)}/100` },
        bag:{ def:{n:'20格突击包', rare:'green', ic:'backpack'}, info:'负重 30kg' },
      }
    }, i=>{
      this.p.selIdx = (this.p.selIdx===i ? null : i);
      this._renderBag();
      Audio2.ui('click');
    });
    this.hud.renderDetail(p.selIdx, this.p, (act, idx)=>{
      if (act==='use') this._useBagItem(idx);
      if (act==='drop'){ this.p.bag[idx]=null; this.p.selIdx=null; this._renderBag(); Audio2.ui('back'); }
    });
  }
  _useBagItem(idx){
    const it = this.p.bag[idx]; if (!it) return;
    const def = ITEMS[it.id];
    if (def.cat!=='medic' && def.cat!=='armor'){ this.hud.toast('该物品不可使用','#ff4757'); return; }
    this._closeBag();
    this._startUse(def, ()=>{
      // 读条期间该格可能已被丢弃，必须重新校验
      const it2 = this.p.bag[idx];
      if (!it2) return;
      it2.qty--;
      if (it2.qty<=0) this.p.bag[idx]=null;
      this._renderBag();
    });
  }
  _useQuick(i){
    const q = this.p.quick[i];
    if (!q || q.qty<=0){ Audio2.ui('error'); return; }
    const def = ITEMS[q.id];
    if (this.p.using) return;
    this.hud.quickUse(i);
    this._startUse(def, ()=>{ q.qty--; });
  }
  _quickHeal(){
    const p = this.p;
    if (p.hp >= p.maxHp && !p.bleeding){ this.hud.toast('生命值已满','#ff9d2e'); return; }
    const order = p.bleeding ? ['tourniquet','medkit','ifak','painkiller'] : ['ifak','medkit','painkiller'];
    for (const id of order){
      const i = p.quick.findIndex(q=>q.id===id && q.qty>0);
      if (i>=0){ this._useQuick(i); return; }
    }
    Audio2.ui('error'); this.hud.toast('没有可用的医疗物品','#ff4757');
  }
  _startUse(def, onDone){
    this.p.using = def; this.p.usingT = def.use || 3;
    Audio2.heal();
    this.hud.toast(`使用 ${def.n}…`, '#d8ff3e');
    this._useDone = onDone;
  }
  _finishUse(){
    const p = this.p, def = p.using;
    if (def.heal){
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + def.heal);
      // 部位恢复
      for (const k in p.body) p.body[k] = Math.min(100, p.body[k] + def.heal*.6);
      this.hud.toast(`+${Math.round(p.hp-before)} 生命`, '#4ade80');
    }
    if (def.id==='tourniquet' || def.n==='止血带'){
      p.bleeding = 0; this.hud.toast('出血已止住','#4ade80');
    }
    if (def.armor){
      const before = p.armor;
      p.armor = Math.min(p.maxArmor, p.armor + def.armor);
      this.hud.toast(`+${Math.round(p.armor-before)} 护甲`, '#5ac8ff');
    }
    if (def.id==='surgery' || def.n==='手术包'){
      for (const k in p.body) p.body[k] = Math.max(p.body[k], 55);
      p.bleeding = 0; this.hud.toast('伤势已处理','#4ade80');
    }
    if (def.id==='painkiller' || def.n==='止痛药'){
      p.painT = 30; this.hud.toast('镇痛生效 30s','#4ade80');
    }
    if (def.ammo){
      this.p.reserve += def.ammo;
      this.hud.toast(`+${def.ammo} 发备弹`, '#d8ff3e');
    }
    this._useDone && this._useDone();
    p.using = null;
  }

  /* ================= 交互 / 搜刮 ================= */
  _nearestLoot(){
    let best=null, bd=3.2;
    for (const b of this.world.lootboxes){
      if (b.opened) continue;
      const d = Math.hypot(b.x-this.p.pos.x, b.z-this.p.pos.z);
      if (d<bd){ bd=d; best=b; }
    }
    return best;
  }
  _tryInteract(){
    if (this.p.using || this.p.reloading) return;
    const b = this._nearestLoot();
    if (b){ this._openLoot(b); return; }
    Audio2.ui('error');
  }
  _openLoot(b){
    b.opened = true;
    this.p.looted++;
    Audio2.pickup();
    // 开盖动画
    if (b.lid){
      const lid = b.lid;
      let t=0;
      const anim = setInterval(()=>{
        t+=.06;
        lid.rotation.x = -Math.min(1.5, t*4);
        lid.position.y = (b.isBody?.2:1.2) + Math.min(.5,t*1.4);
        if (t>.4) clearInterval(anim);
      }, 25);
    }
    const items = b.loot || rollLoot(this.cfg.diff.lootMul, 0);
    let added = 0;
    for (const id of items){
      const def = ITEMS[id];
      // 弹药直接进备弹
      if (def.ammo){ this.p.reserve += def.ammo; this.hud.addLoot(def.n, def.ammo, def.rare); continue; }
      // 进快捷栏
      const qi = this.p.quick.findIndex(q=>q.id===id);
      if (qi>=0 && def.cat!=='valuable'){ this.p.quick[qi].qty++; this.hud.addLoot(def.n,1,def.rare); added++; continue; }
      // 进背包
      const slot = this.p.bag.findIndex(s=>s && s.id===id);
      if (slot>=0){ this.p.bag[slot].qty++; }
      else {
        const empty = this.p.bag.indexOf(null);
        if (empty>=0) this.p.bag[empty] = {id, qty:1};
        else { this.hud.toast('背包已满','#ff4757'); continue; }
      }
      this.p.lootValue += def.val;
      this.hud.addLoot(def.n, 1, def.rare);
      added++;
    }
    this.hud.renderQuickbar(this.p.quick.map(q=>({...ITEMS[q.id], qty:q.qty})), -1);
    if (added===0 && items.length) this.hud.toast('已获取物资','#d8ff3e');
    this._updateObjectives();
  }

  _updateObjectives(){
    const p = this.p;
    this.hud.setObjectives([
      { t:`搜刮物资箱 (${p.looted}/8)`, done: p.looted>=8 },
      { t:`击毙敌对目标 (${p.kills}/10)`, done: p.kills>=10 },
      { t:'前往撤离点并成功撤离', done: p.extracted },
    ]);
  }

  /* ================= 撤离 ================= */
  _updateExtract(dt){
    const p = this.p;
    let inside = null;
    for (const e of this.world.extracts){
      if (Math.hypot(p.pos.x-e.x, p.pos.z-e.z) < e.radius && e.active){ inside = e; break; }
    }
    if (inside){
      const moving = this._moveAmt > .35;
      if (!moving){
        p.extractT += dt;
        this.hud.showExtract(true, inside.name, Math.max(0, 15-p.extractT), 15);
        if (p.extractT >= 15){
          p.extracted = true;
          this.end(true, `从 ${inside.name} 成功撤离`);
        }
      } else {
        p.extractT = Math.max(0, p.extractT - dt*2);
        this.hud.showExtract(true, inside.name, Math.max(0,15-p.extractT), 15);
        // 节流：否则每帧刷新提示文字，会持续闪烁
        this._extractToastT = (this._extractToastT||0) - dt;
        if (this._extractToastT <= 0){ this._extractToastT = 1.4; this.hud.toast('撤离中断：请勿移动','#ff9d2e'); }
      }
    } else {
      if (p.extractT>0){ p.extractT = Math.max(0, p.extractT - dt*3); }
      this.hud.showExtract(false);
    }
    // 撤离点脉冲动画
    for (const e of this.world.extracts){
      e.ring.material.opacity = .32 + Math.sin(performance.now()/380)*.16;
    }
  }

  /* ================= 结算 ================= */
  end(win, reason){
    if (this.ended) return;
    this.ended = true; this.running = false;
    this.paused = true;
    if (this.uiMode==='bag'){ this.uiMode=null; this.hud.showBackpack(false); }  // 背包中阵亡须关背包
    document.exitPointerLock?.();
    this.hud.showExtract(false); this.hud.showPause(false);
    const p = this.p;
    const survived = win;
    const value = win ? p.lootValue : 0;
    this.hud.showResult(win, reason, [
      { k:'击杀', v:p.kills }, { k:'伤害', v:Math.round(p.dmgDealt) },
      { k:'搜刮', v:p.looted }, { k:'收益', v:'₵'+(value/1000).toFixed(0)+'K' },
    ], win ? p.bag.filter(Boolean).map(s=>({ n:ITEMS[s.id].n, q:s.qty })) : []);
    Audio2[win?'kill':'alarm']();
  }

  /* 按住 Tab 查看战术计分板 */
  _showBoard(on){
    if (!on){ this.hud.showScoreboard(false); return; }
    const p = this.p;
    this.hud.renderScoreboard([
      { name:`你 · ${this.cfg?.operator?.name || '干员'}`, kills:p.kills,
        dmg:Math.round(p.dmgDealt||0), loot:Math.round(p.lootValue||0),
        status: this.ended ? 'dead' : 'ok', self:true },
    ], this.cfg?.map?.name || '');
    this.hud.showScoreboard(true);
  }

  /* ================= 主循环 ================= */
  _loop(){
    requestAnimationFrame(()=>this._loop());
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    // FPS
    this.fpsC++; this.fpsT += dt;
    if (this.fpsT>=.5){ this.fps = Math.round(this.fpsC/this.fpsT); this.fpsC=0; this.fpsT=0;
      this.ping = 15 + Math.floor(Math.random()*9); }
    this._autoQuality(dt);

    const active = !this.paused && !this.uiMode && !this.ended;
    if (active){
      this._updateMove(dt);
      this._updateWeapon(dt);
      this._updateEnemies(dt);
      this._updateGrenades(dt);
      this._updateExtract(dt);
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.end(false, '撤离时间已耗尽');
    }
    this._updateCamera(dt);
    this._updateHUD(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /* 自适应画质：持续低帧时逐级降级（关阴影 → 0.75 分辨率 → 0.6 分辨率），避免弱机卡成幻灯片 */
  _autoQuality(dt){
    if (this._qLevel == null) this._qLevel = 0;
    if (this._lowT == null) this._lowT = 0;
    if (this._qLevel >= 3) return;
    if (this.fps > 0 && this.fps < 45) this._lowT += dt;
    else this._lowT = Math.max(0, this._lowT - dt*0.6);
    if (this._lowT < 2.5) return;
    this._lowT = 0; this._qLevel++;
    // 关阴影后需让材质重新编译，否则画面不更新
    const refresh = ()=> this.scene.traverse(o=>{
      if (!o.material) return;
      (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if (m) m.needsUpdate = true; });
    });
    if (this._qLevel === 1){
      this.renderer.shadowMap.enabled = false;
      refresh();
      this.hud.toast('性能模式：已关闭实时阴影', '#ff9d2e');
    } else if (this._qLevel === 2){
      this.renderer.setPixelRatio(0.75);
      this.hud.toast('性能模式：已降低渲染分辨率', '#ff9d2e');
    } else {
      this.renderer.setPixelRatio(0.6);
      this.hud.toast('性能模式：已进一步降低分辨率', '#ff9d2e');
    }
  }

  _updateMove(dt){
    const p = this.p, k = this.keys;
    // 输入方向
    let ix = 0, iz = 0;
    if (k['KeyW']) iz += 1;
    if (k['KeyS']) iz -= 1;
    if (k['KeyA']) ix -= 1;
    if (k['KeyD']) ix += 1;
    const mag = Math.hypot(ix,iz);
    if (mag>0){ ix/=mag; iz/=mag; }
    this._moveAmt = mag;

    // 姿态
    p.sprint = !!k['ShiftLeft'] && iz>0 && p.stamina>0 && !p.ads && !p.crouch && !p.using;
    const wantCrouch = !!k['ControlLeft'] || !!k['KeyC'];
    p.crouch = wantCrouch;
    p.eyeH = lerp(p.eyeH, p.crouch ? 1.12 : 1.62, dt*10);

    let speed = p.crouch ? 1.9 : (p.ads ? 2.7 : 5.4);
    if (p.sprint) speed = 8.2;
    if (p.using) speed = 1.6;
    if (p.reloading) speed *= .88;

    // 体力
    if (p.sprint) p.stamina = Math.max(0, p.stamina - dt*17);
    else if (p.stamina<100) p.stamina = Math.min(100, p.stamina + dt*(mag>0?9:17));
    if (p.stamina<=0) p.sprint = false;

    // 移动（相机 yaw 空间）
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const wx = ix*cos - iz*sin;
    const wz = -ix*sin - iz*cos;
    const step = speed*dt;
    const nx = p.pos.x + wx*step, nz = p.pos.z + wz*step;
    if (!collides(nx, p.pos.z, .34, this.world, p.pos.y)) p.pos.x = nx;
    if (!collides(p.pos.x, nz, .34, this.world, p.pos.y)) p.pos.z = nz;
    p.pos.x = clamp(p.pos.x, -this.world.bounds+1, this.world.bounds-1);
    p.pos.z = clamp(p.pos.z, -this.world.bounds+1, this.world.bounds-1);

    // 重力 / 跳跃 / 台阶
    const groundY = this._groundAt(p.pos.x, p.pos.z, p.pos.y);
    p.vel.y -= 24*dt;
    p.pos.y += p.vel.y*dt;
    if (p.pos.y <= groundY){
      p.pos.y = groundY; p.vel.y = 0; p.onGround = true;
      // v=8.2 / g=24 → 跳跃高度约 1.40m，配合 0.9 台阶容差可登上 ≤2.3m 的台面
      // （物资箱 1.3 / 油桶 1.7 / 沙袋 1.7 / 矮墙 1.5 可攀爬；集装箱 2.7 作为硬掩体）
      if (k['Space'] && !p.using){ p.vel.y = 8.2; p.onGround = false; p.stamina = Math.max(0,p.stamina-8); }
    } else p.onGround = false;

    // 脚步声
    if (p.onGround && mag>0){
      p.stepT -= dt * (p.sprint?1.85:(p.crouch?.6:1));
      if (p.stepT<=0){ p.stepT = .42; Audio2.footstep(p.sprint); }
    }
    // 头部摆动
    p.bob += dt * speed * (p.sprint?1.7:1.25);
  }
  _groundAt(x,z,feetY){
    let g = 0;
    for (const b of this.world.blocks){
      if (x > b.x-b.w/2 && x < b.x+b.w/2 && z > b.z-b.d/2 && z < b.z+b.d/2){
        if (b.top <= feetY + 0.9 && b.top > g) g = b.top;
      }
    }
    return g;
  }

  _updateWeapon(dt){
    const p = this.p;
    p.fireT -= dt;
    p.grenadeCd -= dt;

    // 开镜
    const wantAds = this.mouse.right && !p.reloading && !p.sprint;
    p.ads = !!wantAds && !p.using;
    p.adsT = lerp(p.adsT, p.ads?1:0, dt*14);
    const w = p.weapon;
    const targetFov = (this.cfg?.settings?.fov ?? 90) / (1 + (w.scope-1)*p.adsT*0.62);
    if (Math.abs(this.camera.fov - targetFov) > .05){
      this.camera.fov = targetFov; this.camera.updateProjectionMatrix();
    }
    this.hud.scope(p.adsT > .82 && w.scope >= 3);
    this.hud.ads(p.adsT > .5 && w.scope < 3);

    // 射击
    if (this.mouse.left){
      if (p.mode==='auto' || !this._firedThisClick){
        this._shoot();
        if (p.mode!=='auto') this._firedThisClick = true;
        if (p.mode==='burst') this._burstLeft = 2;      // 三连发：本次点击还剩 2 发
      }
    } else { this._firedThisClick = false; this._burstLeft = 0; }
    // 三连发余弹按射速打完，不再强制松开鼠标
    if (this._burstLeft > 0 && p.fireT <= 0){ this._shoot(); this._burstLeft--; }

    // 换弹
    if (p.reloading){
      p.reloadT -= dt;
      if (p.reloadT<=0) this._finishReload();
    }
    // 使用物品
    if (p.using){
      p.usingT -= dt;
      if (p.usingT<=0) this._finishUse();
    }
    // 扩散恢复
    p.spread = Math.max(0, p.spread - dt*3.2);
    // 后坐力恢复
    p.recoilP = lerp(p.recoilP, 0, dt*7);
    p.recoilY = lerp(p.recoilY, 0, dt*7);
    p.kick = lerp(p.kick, 0, dt*9);

    // 枪身动画
    if (this.gunGroup){
      const g = this.gunGroup;
      const base = this.gunBase, ads = this.gunAds;
      const tx = lerp(base.x, ads.x, p.adsT);
      const ty = lerp(base.y, ads.y, p.adsT);
      const tz = lerp(base.z, ads.z, p.adsT);
      // 摇摆
      const bobAmt = this._moveAmt * (p.ads?.0035:.011);
      const bx = Math.sin(p.bob) * bobAmt;
      const by = Math.abs(Math.cos(p.bob)) * bobAmt * .8;
      // 换弹动作
      let rx=0, ry=0, rz=0, ay=0;
      if (p.reloading){
        const t = 1 - p.reloadT/w.reload;
        const s = Math.sin(Math.min(1,t*1.6)*Math.PI);
        ay = -s*.28; rx = s*.75; rz = s*.35;
      }
      if (p.using){ const s = Math.sin(Math.min(1,(1-p.usingT/(p.using.use||3))*3)*Math.PI); ay = -s*.2; rx = s*.5; }
      g.position.set(tx+bx+(1-p.adsT)*0, ty+by+ay, tz + p.kick*2.2);
      g.rotation.set(rx + p.recoilP*1.6, .06*(1-p.adsT) + p.recoilY, rz + p.kick*1.4);
      // 开镜时枪身回正
      g.rotation.y = lerp(g.rotation.y, 0, p.adsT);
    }
    // 枪口火焰衰减
    if (this.gunFlash.material.opacity>0)
      this.gunFlash.material.opacity = Math.max(0, this.gunFlash.material.opacity - dt*14);
    if (this.muzzleLight && this.muzzleLight.intensity>0)
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt*75);
  }

  _updateEnemies(dt){
    const p = this.p;
    for (const e of this.enemies){
      e.update(dt, { pos:p.pos, camQuat:this.camera.quaternion, justShot:p.justShot, lastShotTime:p.lastShotTime },
        this.world, (enemy, dmg, dist)=>{
          if (!this.running || this.ended) return;
          if (dist < 60) Audio2.shot('rifle', dist/9);   // 60m 外音量已衰减到近乎为零，跳过整链音频节点
          if (dmg>0 && Math.random() < .78){
            this._takeDamage(dmg * this.cfg.diff.aiDmg, Math.random()<.13?'head':'chest', enemy.pos);
          } else if (Math.random()<.4){
            // 跳弹：附近弹着
            Audio2.hit();
          }
        });
    }
    p.justShot = false;
    // 清理已消失的敌人（仅在有尸体到期时才过滤，不再每帧重建数组）
    if (this._enemyDirty){
      this._enemyDirty = false;
      this.enemies = this.enemies.filter(e=> e.alive || e.deathT < 3.5);
    }
  }

  _updateGrenades(dt){
    for (let i=this.grenades.length-1;i>=0;i--){
      const g = this.grenades[i];
      g.vel.y -= 22*dt;
      const nx = g.mesh.position.x + g.vel.x*dt;
      const ny = g.mesh.position.y + g.vel.y*dt;
      const nz = g.mesh.position.z + g.vel.z*dt;
      const gy = this._groundAt(nx,nz, ny+1);
      if (ny <= gy + .12){
        g.mesh.position.set(nx, gy+.12, nz);
        g.vel.multiplyScalar(.42); g.vel.y = Math.abs(g.vel.y)*.42;
        if (Math.abs(g.vel.y) < .6) g.vel.y = 0;
      } else {
        if (collides(nx, nz, .2, this.world, g.mesh.position.y, .3)){ g.vel.x*=-.4; g.vel.z*=-.4; }
        else { g.mesh.position.set(nx, ny, nz); }
      }
      g.fuse -= dt;
      if (g.fuse<=0){
        this._explode(g.mesh.position.clone());
        this.scene.remove(g.mesh);
        this.grenades.splice(i,1);
      }
    }
    // 特效粒子（火花/血点）：全部来自对象池，熄灭只关 visible，不 remove / dispose
    for (let i=this.bloods.length-1;i>=0;i--){
      const d = this.bloods[i];
      d.userData.life -= dt;
      if (d.userData.v){
        d.userData.v.y -= 9*dt;
        d.position.addScaledVector(d.userData.v, dt);
        d.material.opacity = Math.max(0, d.userData.life*2);
      }
      if (d.userData.life<=0){ d.visible = false; this.bloods.splice(i,1); }
    }
  }

  /* 阴影相机跟随玩家：只渲染身边的投影体，帧率与阴影清晰度同时受益 */
  _updateSun(){
    const sun = this.world && this.world.sun;
    if (!sun) return;
    const x = this.p.pos.x, z = this.p.pos.z;
    sun.position.set(x+60, 110, z+40);
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();
  }

  _updateCamera(dt){
    this._updateSun();
    const p = this.p;
    const bobY = Math.sin(p.bob*2) * this._moveAmt * (p.sprint?.030:.016);
    const bobX = Math.cos(p.bob) * this._moveAmt * (p.sprint?.014:.008);
    this.camera.rotation.set(p.pitch + p.recoilP, p.yaw + p.recoilY, bobX*.4);
    this.camera.position.set(p.pos.x + bobX, p.pos.y + p.eyeH + bobY, p.pos.z);
  }

  _updateHUD(dt){
    const p = this.p;
    this.hud.setVitals(p.hp, p.maxHp, p.armor, p.maxArmor, p.stamina);
    this.hud.setBody(p.body);
    this.hud.setWeapon(p.weapon.name, p.mag, p.reserve, p.weapon.mag, p.mode, p.grenades);
    this.hud.setSpread(4 + p.spread*2.6 + this._moveAmt*3);
    this.hud.setClock(this.timeLeft);
    this.hud.setPerf(this.fps, this.ping);
    // 濒死血雾由 hud.setVitals 统一负责，这里不再重复写 opacity
    // 小地图（内部已限流 ~30fps + 静态图层预渲染）
    this.hud.drawMinimap(p.pos.x, p.pos.z, p.yaw, {
      minimapBlocks: this.world.minimapBlocks, extracts: this.world.extracts,
      lootboxes: this.world.lootboxes, enemies: this.enemies, mates: [],
    });
    // 准星命中提示（敌人是否在准星上）
    const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    let hostile = false;
    for (const e of this.enemies){
      if (!e.alive) continue;
      const t = rayAABB(origin, dir, e.pos.x-.46, e.pos.y, e.pos.z-.38,
                                      e.pos.x+.46, e.pos.y+1.96, e.pos.z+.38);
      if (t!==null && t<90){ hostile = true; break; }
    }
    this.hud.hostile(hostile);

    // 交互提示
    const loot = this._nearestLoot();
    if (loot && !this.ended) this.hud.showInteract(loot.isBody?'搜刮阵亡者':'搜刮物资箱', 'F', 0);
    else if (p.using) this.hud.showInteract(`使用 ${p.using.n}`, '', 1 - p.usingT/(p.using.use||3));
    else this.hud.showInteract(null);

    // 使用进度（长按 F 持续搜刮）
    if (p.using) this.hud.showInteract(`使用 ${p.using.n}…`, '', 1 - p.usingT/(p.using.use||3));
    // 出血掉血（暂停/背包时不该继续掉血致死）
    if (p.bleeding && !this.ended && !this.paused && !this.uiMode){
      p.hp -= dt*1.6;
      if (p.hp<=0){ p.hp=0; this.end(false,'失血过多'); }
    }
    // 止血带计时
    if (p.painT>0){
      p.painT -= dt;
      p.hp = Math.min(p.maxHp, p.hp + dt*2.2);
    }
    // 快捷栏
    if (this._qbT === undefined || this._qbT<=0){
      this._qbT = .35;
      this.hud.renderQuickbar(p.quick.map(q=>({...ITEMS[q.id], qty:q.qty})), -1);
    }
    this._qbT -= dt;
  }
}

/* 射线 vs AABB（slab） */
function rayAABB(o, d, minx,miny,minz, maxx,maxy,maxz){
  let tmin = 0, tmax = Infinity;
  const axes = [['x',o.x,d.x,minx,maxx],['y',o.y,d.y,miny,maxy],['z',o.z,d.z,minz,maxz]];
  for (const [,oo,dd,mn,mx] of axes){
    if (Math.abs(dd) < 1e-8){
      if (oo < mn || oo > mx) return null;
    } else {
      let t1 = (mn-oo)/dd, t2 = (mx-oo)/dd;
      if (t1>t2){ const t=t1; t1=t2; t2=t; }
      tmin = Math.max(tmin,t1); tmax = Math.min(tmax,t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
