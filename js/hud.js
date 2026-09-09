/* ============================================================
   HUD 控制器：血条 / 弹药 / 小地图 / 播报 / 背包 / 结算
============================================================ */
import { RARITY, ITEMS, itemIcon } from './config.js';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

export class HUD {
  constructor(){
    this.el = {
      hpNum:$('hpNum'), hpBar:$('hpBar'), armorBar:$('armorBar'), armorNum:$('armorNum'),
      stamina:$('staminaBar'), bodymap:$('bodymap'),
      wpName:$('wpName'), ammoMag:$('ammoMag'), ammoReserve:$('ammoReserve'),
      wpMag:$('wpMag'), fireMode:$('fireMode'), grenadeNum:$('grenadeNum'),
      killfeed:$('killfeed'), lootStream:$('lootStream'), dmgInd:$('dmgIndicators'),
      crosshair:$('crosshair'), hitmarker:$('hitmarker'), missionClock:$('missionClock'),
      missionText:$('missionText'), objectiveList:$('objectiveList'),
      interactPrompt:$('interactPrompt'), ipFill:$('ipFill'), ipText:$('ipText'), ipKey:$('ipKey'),
      blood:$('bloodOverlay'), hitFlash:$('hitFlash'), ade:$('adeOverlay'), scope:$('scopeOverlay'),
      toast:$('centerToast'), banner:$('killBanner'), quickbar:$('quickbar'),
      minimap:$('minimap'), mmHeading:$('mmHeading'), mmCoord:$('mmCoord'),
      ping:$('pingVal'), fps:$('fpsVal'),
      scoreboard:$('scoreboard'), sbBody:$('sbBody'), sbMap:$('sbMap'), sbTime:$('sbTime'),
      backpack:$('backpack'), bpGrid:$('bpGrid'), bpEquip:$('bpEquip'), bpDetail:$('bpDetail'), bpCap:$('bpCap'),
      extract:$('extractPrompt'), epName:$('epName'), epCount:$('epCount'), epCircle:$('epCircle'),
      result:$('resultScreen'), resBanner:$('resBanner'), resSub:$('resSub'), resStats:$('resStats'), resLoot:$('resLoot'),
      pause:$('pauseMenu'), deploy:$('deployOverlay'), dpCount:$('dpCount'), dpMapName:$('dpMapName'),
    };
    this.mmCtx = this.el.minimap.getContext('2d');
    this.mmScan = 0;
    this.feedTimers = [];
    this.lastHp = 100;
  }

  /* ---------- 生命 / 护甲 / 体力 ----------
     每帧都写 DOM 会造成大量 layout/样式重算，这里全部做脏值比较：
     数值没变就一次都不写。 */
  setVitals(hp, maxHp, armor, maxArmor, stam){
    const H = Math.ceil(hp), A = Math.ceil(armor), S = Math.round(stam);
    const c = this._v || (this._v = {});
    if (c.hp !== H){
      c.hp = H;
      this.el.hpNum.textContent = H;
      const p = clamp(hp/maxHp*100,0,100);
      this.el.hpBar.style.width = p+'%';
      this.el.hpBar.parentElement.classList.toggle('low', p<=30);
      // 受伤血雾（只在这里写，避免与其他地方重复赋值互相打架）
      this.el.blood.style.opacity = hp/maxHp < .55 ? String((.55 - hp/maxHp)*1.5).slice(0,4) : '0';
    }
    if (c.armor !== A){
      c.armor = A;
      const ap = clamp(armor/maxArmor*100,0,100);
      this.el.armorBar.style.width = ap+'%';
      this.el.armorNum.textContent = armor>0 ? A : '';
      this.el.armorNum.style.display = armor>0?'':'none';
    }
    if (c.stam !== S){ c.stam = S; this.el.stamina.style.width = clamp(stam,0,100)+'%'; }
  }
  setBody(parts){
    const map = this._bodyEls || (this._bodyEls = {});
    const st  = this._bodySt  || (this._bodySt  = {});
    for (const k in parts){
      let d = map[k];
      if (d === undefined) d = map[k] = this.el.bodymap.querySelector(`[data-part="${k}"]`) || null;
      if (!d) continue;
      const v = parts[k];
      const s = v<=0 ? 'broken' : v<=25 ? 'crit' : v<=60 ? 'hurt' : 'ok';
      if (st[k] === s) continue;           // 状态没变 → 不动 DOM
      st[k] = s;
      d.classList.toggle('hurt',   s==='hurt');
      d.classList.toggle('crit',   s==='crit');
      d.classList.toggle('broken', s==='broken');
    }
  }
  /* ---------- 武器 ---------- */
  setWeapon(shortName, mag, reserve, maxMag, mode, grenade){
    const c = this._w || (this._w = {});
    if (c.name !== shortName){ c.name = shortName; this.el.wpName.textContent = shortName; }
    if (c.mag !== mag){
      c.mag = mag;
      this.el.ammoMag.textContent = mag;
      this.el.ammoMag.parentElement.classList.toggle('empty', mag===0);
      const cells = this.el.wpMag.children;
      for (let i=0;i<cells.length;i++) cells[i].classList.toggle('used', i >= Math.min(mag,cells.length));
    }
    if (c.res !== reserve){ c.res = reserve; this.el.ammoReserve.textContent = '/ '+reserve; }
    if (c.mode !== mode){
      c.mode = mode;
      this.el.fireMode.textContent = mode==='auto'?'全自动':mode==='burst'?'三连发':'单发';
    }
    if (c.gr !== grenade){ c.gr = grenade; this.el.grenadeNum.textContent = grenade; }
    if (this._magCount !== maxMag || this._lastMag === undefined){
      this.el.wpMag.innerHTML = Array.from({length:Math.min(maxMag,30)},()=>'<i></i>').join('');
      this._magCount = maxMag;
      c.mag = undefined;   // 弹匣格重建后需重新着色
      const cells = this.el.wpMag.children;
      for (let i=0;i<cells.length;i++) cells[i].classList.toggle('used', i >= Math.min(mag,cells.length));
    }
  }
  setSpread(px){
    const v = Math.round(px*2)/2;               // 量化到 .5px，避免每帧写样式
    if (this._spread === v) return;
    this._spread = v;
    this.el.crosshair.style.setProperty('--sp', v+'px');
  }
  hostile(bool){
    if (this._hostile === bool) return;
    this._hostile = bool;
    this.el.crosshair.classList.toggle('hostile', bool);
  }
  hitmark(kill){
    const h = this.el.hitmarker;
    h.classList.remove('show'); void h.offsetWidth;
    h.classList.toggle('kill', !!kill);
    h.classList.add('show');
  }
  ads(on){ this.el.ade.classList.toggle('on', on); }
  scope(on){ this.el.scope.classList.toggle('on', on); }
  flash(){ const f=this.el.hitFlash; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

  /* ---------- 播报 / 提示 ---------- */
  addKill(a, b, weapon, headshot, self){
    const row = document.createElement('div');
    row.className = 'kf-row' + (self?' self':'');
    row.innerHTML = `<span class="kf-a">${a}</span>
      <span class="kf-w">${weapon}${headshot?' ⌖':''}</span>
      <span class="kf-b">${b}</span>`;
    this.el.killfeed.prepend(row);
    if (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(()=>{ row.style.transition='opacity .4s'; row.style.opacity='0';
      setTimeout(()=>row.remove(), 400); }, 7000);
  }
  addLoot(name, qty, rare){
    const row = document.createElement('div');
    row.className = 'ls-row r-'+(rare||'white');
    row.innerHTML = `<b>${name}</b>${qty>1?`<span>×${qty}</span>`:''}`;
    this.el.lootStream.prepend(row);
    if (this.el.lootStream.children.length > 6) this.el.lootStream.lastChild.remove();
    setTimeout(()=>{ row.classList.add('out'); setTimeout(()=>row.remove(),300); }, 3800);
  }
  toast(text, color){
    const t = this.el.toast;
    t.textContent = text;
    t.style.color = color || 'var(--accent)';
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  }
  banner(text){
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  showInteract(text, key='F', progress){
    const p = this.el.interactPrompt;
    if (text === null){
      if (this._ip !== null){ this._ip = null; p.style.display='none'; }
      return;
    }
    if (p.style.display !== 'block') p.style.display = 'block';
    if (this._ip !== text){ this._ip = text; this.el.ipText.textContent = text; }
    if (this._ipKey !== key){ this._ipKey = key; this.el.ipKey.textContent = key; }
    const w = (clamp(progress||0,0,1)*100).toFixed(1)+'%';
    if (this._ipFill !== w){ this._ipFill = w; this.el.ipFill.style.width = w; }
  }
  damageFrom(angle){
    const d = document.createElement('div');
    d.className = 'dmg-ind';
    d.style.transform = `rotate(${angle}rad)`;
    this.el.dmgInd.appendChild(d);
    setTimeout(()=>d.remove(), 1500);
  }

  /* ---------- 任务 / 计时 ---------- */
  setClock(sec){
    const m = Math.floor(Math.max(0,sec)/60), s = Math.floor(Math.max(0,sec)%60);
    const t = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (this._clock === t) return;          // 秒变了才写
    this._clock = t;
    this.el.missionClock.textContent = t;
    this.el.sbTime.textContent = t;
    this.el.missionClock.parentElement.classList.toggle('urgent', sec<=180);
  }
  setMission(text){ this.el.missionText.textContent = text; }
  setObjectives(list){
    this.el.objectiveList.innerHTML = list.map(o=>
      `<div class="obj-item${o.done?' done':''}">${o.done?'✓ ':'▸ '}${o.t}</div>`).join('');
  }

  /* ---------- 小地图 ---------- */
  /* 小地图底图（底/同心圆/十字/视野扇形）不随视角变化 → 预渲染一次 */
  _mmBase(S, R){
    if (this._mmBaseCv) return this._mmBaseCv;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    c.translate(R, R);
    const g = c.createRadialGradient(0,0,0,0,0,R);
    g.addColorStop(0,'rgba(16,26,16,.92)'); g.addColorStop(1,'rgba(4,7,4,.96)');
    c.fillStyle=g; c.beginPath(); c.arc(0,0,R,0,7); c.fill();
    c.strokeStyle='rgba(216,255,62,.13)'; c.lineWidth=1;
    for(let i=1;i<=3;i++){ c.beginPath(); c.arc(0,0,R*i/3.2,0,7); c.stroke(); }
    c.beginPath(); c.moveTo(-R,0); c.lineTo(R,0); c.moveTo(0,-R); c.lineTo(0,R); c.stroke();
    const fov = 1.25;
    c.fillStyle='rgba(216,255,62,.07)';
    c.beginPath(); c.moveTo(0,0);
    c.arc(0,0,R,-Math.PI/2-fov/2, -Math.PI/2+fov/2); c.closePath(); c.fill();
    this._mmBaseCv = cv;
    return cv;
  }
  /* 建筑/掩体层：整幅世界俯视图预渲染一次，之后每帧只做一次 drawImage。
     原实现每帧对上百个方块做 save/translate/rotate/fill/stroke，是主线程主要开销 */
  _mmWorld(world, S, scale){
    const list = (world && world.minimapBlocks) || [];
    // 缓存键：世界对象 + 方块数量（击杀掉落会往里 push，需要能自动失效）
    if (this._mmWorldCv && this._mmWorldKey === world && this._mmWorldN === list.length)
      return this._mmWorldCv;
    // 画布尺寸按实际范围算，避免大地图被裁掉
    let ext = 130;
    for (const b of list) ext = Math.max(ext, Math.abs(b.x)+b.w, Math.abs(b.z)+b.d);
    const W = Math.min(1400, Math.ceil(ext*2*scale));
    const cv = document.createElement('canvas'); cv.width = cv.height = W;
    const c = cv.getContext('2d');
    c.translate(W/2, W/2);
    for (const b of list){
      c.save();
      c.translate(b.x*scale, b.z*scale);
      c.rotate(-b.rot || 0);
      c.fillStyle='rgba(150,160,140,.30)';
      c.fillRect(-b.w*scale/2, -b.d*scale/2, b.w*scale, b.d*scale);
      c.strokeStyle='rgba(200,210,190,.35)'; c.lineWidth=1;
      c.strokeRect(-b.w*scale/2, -b.d*scale/2, b.w*scale, b.d*scale);
      c.restore();
    }
    this._mmWorldCv = cv; this._mmWorldKey = world; this._mmWorldN = list.length;
    return cv;
  }
  invalidateMinimap(){ this._mmWorldCv = null; this._mmWorldKey = null; this._mmWorldN = -1; }
  drawMinimap(px, pz, yaw, world){
    // 小地图限流到 ~30fps：它是 2D 画布重绘，没必要跟渲染帧同速
    const now = performance.now();
    if (this._mmT !== undefined && now - this._mmT < 33) return;
    this._mmT = now;
    const c = this.mmCtx, S = 460, R = S/2, scale = 1.9;
    c.clearRect(0,0,S,S);
    c.drawImage(this._mmBase(S, R), 0, 0);

    // 世界旋转（玩家始终朝上）
    c.save(); c.translate(R,R);
    c.rotate(yaw);
    // 预渲染的世界层：世界原点需落在 (-px*scale, -pz*scale)
    const wc = this._mmWorld(world, S, scale);
    c.drawImage(wc, -wc.width/2 - px*scale, -wc.height/2 - pz*scale);

    // 撤离点
    if (world && world.extracts){
      for (const e of world.extracts){
        const dx=(e.x-px)*scale, dz=(e.z-pz)*scale;
        if (Math.hypot(dx,dz) > R-6) continue;
        c.fillStyle = e.active ? '#5dff6a' : 'rgba(93,255,106,.35)';
        c.beginPath(); c.moveTo(dx, dz-9); c.lineTo(dx+8, dz+6); c.lineTo(dx-8, dz+6); c.closePath(); c.fill();
        if (e.active){ c.strokeStyle='rgba(93,255,106,.6)'; c.lineWidth=2;
          c.beginPath(); c.arc(dx,dz,13,0,7); c.stroke(); }
      }
    }
    // 物资箱
    if (world && world.lootboxes){
      c.fillStyle='rgba(255,194,62,.75)';
      for (const b of world.lootboxes){
        if (b.opened) continue;
        const dx=(b.x-px)*scale, dz=(b.z-pz)*scale;
        if (Math.hypot(dx,dz) > R-6) continue;
        c.fillRect(dx-2.5, dz-2.5, 5, 5);
      }
    }
    // 敌人（仅标记已知目标）
    if (world && world.enemies){
      for (const e of world.enemies){
        if (!e.alive || !e.marked) continue;
        const dx=(e.pos.x-px)*scale, dz=(e.pos.z-pz)*scale;
        if (Math.hypot(dx,dz) > R-6) continue;
        c.fillStyle='#ff4757';
        c.beginPath(); c.arc(dx,dz,6,0,7); c.fill();
        c.strokeStyle='rgba(255,71,87,.55)'; c.lineWidth=2;
        c.beginPath(); c.arc(dx,dz,10 + Math.sin(performance.now()/220)*2,0,7); c.stroke();
      }
    }
    // 队友
    if (world && world.mates){
      c.fillStyle='#4db5ff';
      for (const m of world.mates){
        const dx=(m.x-px)*scale, dz=(m.z-pz)*scale;
        if (Math.hypot(dx,dz) > R-6) continue;
        c.beginPath(); c.arc(dx,dz,5,0,7); c.fill();
      }
    }
    c.restore();

    // 玩家箭头
    c.save(); c.translate(R,R);
    c.fillStyle='#d8ff3e';
    c.beginPath(); c.moveTo(0,-11); c.lineTo(7,8); c.lineTo(0,4); c.lineTo(-7,8); c.closePath(); c.fill();
    c.restore();

    // 扫描线
    this.mmScan = (this.mmScan + 1.6) % 360;
    const rad = this.mmScan*Math.PI/180;
    c.save(); c.translate(R,R); c.rotate(rad);
    const lg = c.createLinearGradient(0,0,R,0);
    lg.addColorStop(0,'rgba(216,255,62,.28)'); lg.addColorStop(1,'rgba(216,255,62,0)');
    c.strokeStyle=lg; c.lineWidth=2;
    c.beginPath(); c.moveTo(0,0); c.lineTo(R,0); c.stroke();
    c.restore();

    // 边框
    c.strokeStyle='rgba(216,255,62,.22)'; c.lineWidth=3;
    c.beginPath(); c.arc(R,R,R-2,0,7); c.stroke();

    // 方位与坐标
    const dirs=['N','NE','E','SE','S','SW','W','NW'];
    let deg = ((-yaw*180/Math.PI)%360+360)%360;
    this.el.mmHeading.textContent = dirs[Math.round(deg/45)%8];
    this.el.mmCoord.textContent = `E ${String(Math.round(px)+150).padStart(3,'0')} · N ${String(Math.round(pz)+150).padStart(3,'0')}`;
  }

  /* ---------- 快捷栏 ---------- */
  renderQuickbar(slots, active){
    const q = this.el.quickbar;
    if (q.children.length !== slots.length){
      q.innerHTML = slots.map((s,i)=>
        `<div class="qb-slot" data-i="${i}">
           <span class="qb-key">${i+1}</span>
           <img class="qb-ic" src="${s?itemIcon(s.ic, RARITY[s.rare].color):''}" alt="">
           <span class="qb-nm">${s?s.n:''}</span>
           <span class="qb-qty">${s&&s.qty>1?s.qty:''}</span>
         </div>`).join('');
    } else {
      slots.forEach((s,i)=>{
        const el = q.children[i];
        if (!el) return;
        el.querySelector('.qb-ic').src = s?itemIcon(s.ic, RARITY[s.rare].color):'';
        el.querySelector('.qb-nm').textContent = s?s.n:'';
        el.querySelector('.qb-qty').textContent = s&&s.qty>1?s.qty:'';
        el.classList.toggle('empty', !s || s.qty<=0);
      });
    }
    [...q.children].forEach((el,i)=>el.classList.toggle('active', i===active));
  }
  quickUse(i){
    const el = this.el.quickbar.children[i];
    if (!el) return;
    el.classList.remove('using'); void el.offsetWidth; el.classList.add('using');
  }

  /* ---------- 计分板 ---------- */
  showScoreboard(on){ this.el.scoreboard.style.display = on?'block':'none'; }
  renderScoreboard(rows, mapName){
    this.el.sbMap.textContent = mapName;
    this.el.sbBody.innerHTML = rows.map(r=>
      `<tr class="${r.self?'self':''}">
        <td>${r.name}</td><td>${r.kills}</td><td>${r.dmg}</td><td>₵${r.loot.toLocaleString()}</td>
        <td class="st-${r.status}">${r.status==='ok'?'行动中':r.status==='dead'?'已阵亡':'已撤离'}</td>
      </tr>`).join('');
  }

  /* ---------- 背包 ---------- */
  showBackpack(on){ this.el.backpack.style.display = on?'flex':'none'; }
  renderBackpack(state, onSelect){
    const cap = state.bagCap;
    this.el.bpCap.textContent = cap+' 格';
    let html = '';
    for (let i=0;i<cap;i++){
      const it = state.bag[i];
      if (!it){ html += `<div class="bp-cell" data-i="${i}"></div>`; continue; }
      const def = ITEMS[it.id];
      html += `<div class="bp-cell r-${def.rare} ${state.selIdx===i?'sel':''}" data-i="${i}">
        <img class="bc-ic" src="${itemIcon(def.ic, RARITY[def.rare].color)}">
        ${it.qty>1?`<span class="bc-qty">${it.qty}</span>`:''}
        <span class="bc-r"></span></div>`;
    }
    this.el.bpGrid.innerHTML = html;
    this.el.bpGrid.onclick = e => {
      const cell = e.target.closest('.bp-cell'); if (!cell) return;
      onSelect(+cell.dataset.i);
    };
    // 装备栏
    this.el.bpEquip.innerHTML = `
      ${['weapon1','weapon2','helmet','armor','bag'].map(k=>{
        const it = state.equip[k]; if (!it) return '';
        const def = it.def || ITEMS[it.id] || {n:it.name||k, rare:'white', ic:'box'};
        return `<div class="bp-eqslot"><img class="be-ic" src="${itemIcon(def.ic||'box', RARITY[def.rare]?RARITY[def.rare].color:'#c8d0c8')}">
          <div><b>${def.n||def.name}</b><em>${it.info||''}</em></div></div>`;
      }).join('')}`;
  }
  renderDetail(idx, state, actions){
    const d = this.el.bpDetail;
    if (idx == null || !state.bag[idx]){ d.innerHTML = '<p class="dim">选择一个物品查看详情</p>'; return; }
    const it = state.bag[idx], def = ITEMS[it.id];
    d.innerHTML = `
      <h6>${def.n}</h6>
      <span class="bd-rare r-${def.rare}">${RARITY[def.rare].cn}</span>
      <div class="bd-stat"><span>重量</span><b>${def.wt} kg</b></div>
      <div class="bd-stat"><span>估价</span><b>₵${def.val.toLocaleString()}</b></div>
      ${def.heal?`<div class="bd-stat"><span>治疗量</span><b>+${def.heal}</b></div>`:''}
      ${def.armor?`<div class="bd-stat"><span>护甲修复</span><b>+${def.armor}</b></div>`:''}
      ${def.use?`<div class="bd-stat"><span>使用耗时</span><b>${def.use}s</b></div>`:''}
      <p class="bd-desc">${def.desc}</p>
      <div class="bd-act">
        ${def.cat==='medic'||def.cat==='armor'?'<button class="df-btn primary sm block" data-act="use">使 用</button>':''}
        <button class="df-btn ghost sm block" data-act="drop">丢 弃</button>
      </div>`;
    d.onclick = e => { const b = e.target.closest('[data-act]'); if (b) actions(b.dataset.act, idx); };
  }

  /* ---------- 撤离 ---------- */
  showExtract(on, name, remain, total){
    this.el.extract.style.display = on?'block':'none';
    if (!on) return;
    this.el.epName.textContent = name;
    this.el.epCount.textContent = Math.ceil(remain);
    const C = 2*Math.PI*44;
    this.el.epCircle.style.strokeDashoffset = String(C * (1 - remain/total));
    this.el.epCircle.setAttribute('stroke-dasharray', C);
  }

  /* ---------- 结算 ---------- */
  showResult(win, sub, stats, loot){
    this.el.resBanner.textContent = win?'行动成功':'行动失败';
    this.el.resBanner.className = 'res-banner ' + (win?'win':'lose');
    this.el.resSub.textContent = sub;
    this.el.resStats.innerHTML = stats.map(s=>
      `<div class="rs-cell"><b>${s.v}</b><span>${s.k}</span></div>`).join('');
    this.el.resLoot.innerHTML = loot.length
      ? loot.map(l=>`<div class="rl-item">${l.n}${l.q>1?` <b>×${l.q}</b>`:''}</div>`).join('')
      : '<p class="dim">未带出任何物资</p>';
    this.el.result.style.display = 'grid';
  }
  hideResult(){ this.el.result.style.display = 'none'; }

  /* ---------- 其他 ---------- */
  setPerf(fps, ping){
    if (this._pFps !== fps){ this._pFps = fps; this.el.fps.textContent = fps; }
    if (this._pPing !== ping){ this._pPing = ping; this.el.ping.textContent = ping; }
  }
  showPause(on){ this.el.pause.style.display = on?'grid':'none'; }
  showDeploy(on, mapName, count){
    this.el.deploy.style.display = on?'grid':'none';
    if (!on) return;
    this.el.dpMapName.textContent = mapName;
    this.el.dpCount.textContent = count;
  }
}
