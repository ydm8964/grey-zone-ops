/* ============================================================
   菜单系统：大厅 / 干员 / 仓库 / 交易行 / 排行 / 设置
============================================================ */
import { OPERATORS, WEAPONS, ITEMS, MAPS, DIFFS, RARITY, operatorArt, mapArt, itemIcon } from './config.js';
import { Audio2 } from './audio.js';

const $ = id => document.getElementById(id);

/* [名称, 品类, 均价, 24h涨跌, 挂单数, 图标, 品级] */
const MARKET_ROWS = [
  ['黄金圣杯','收藏品','₵420,000','+8.4%',12,'cup','gold'],
  ['旗舰显卡','收藏品','₵186,000','-2.1%',47,'gpu','purple'],
  ['比特币矿机','收藏品','₵158,000','+3.7%',8,'btc','purple'],
  ['航空燃料','收藏品','₵96,000','+1.2%',23,'fuel','blue'],
  ['古董花瓶','收藏品','₵74,000','-0.8%',31,'vase','blue'],
  ['M4A1 突击步枪','武器','₵68,000','-1.4%',52,'rifle','blue'],
  ['AWM 狙击步枪','武器','₵245,000','+2.8%',6,'sniper','purple'],
  ['Vector 冲锋枪','武器','₵54,000','+0.9%',38,'smg','green'],
  ['手术包','医疗','₵26,000','+1.9%',77,'surgery','purple'],
  ['护甲板','护甲','₵21,000','+5.6%',194,'plate','blue'],
  ['军用医疗包','医疗','₵12,000','+0.4%',286,'medkit','green'],
  ['5.56×45mm 弹药','武器','₵3,200','-0.3%',612,'ammo','white'],
];
/* [玩家, 干员, 段位分, K/D, 撤离率] */
const RANK_ROWS = [
  ['破晓之刃','红狼','4,820','3.42','68%'], ['暗夜猎手','露娜','4,695','2.98','71%'],
  ['钢铁壁垒','牧羊人','4,510','2.11','74%'], ['幽灵行者','疾风','4,388','3.85','59%'],
  ['电子幽灵','骇爪','4,204','2.54','66%'], ['战场天使','蜂医','4,120','1.87','77%'],
  ['雷霆重锤','威龙','3,988','2.76','61%'], ['高空之眼','银翼','3,864','3.10','63%'],
  ['机械之心','深蓝','3,742','2.05','69%'], ['毒雾弥漫','蛊','3,610','2.44','64%'],
  ['量子比特','比特','3,505','2.31','65%'],
];

export class Menu {
  constructor(onDeploy){
    this.onDeploy = onDeploy;
    this.selMap = 0; this.selDiff = 0; this.selOp = 0; this.selMode = 'ops';
    this.stashFilter = 'all';
    this.mkCat = 'all'; this.mkKw = '';
    this.settings = {
      brightness:1.0, fov:90, quality:'high', vsync:true, shadow:true, fps:true,
      volMaster:.6, volSfx:.8, volVoice:.7, volMusic:.35,
      sens:1.0, adsSens:.8, invertY:false,
      crosshair:'cross', hitmarker:true, dmgNum:true, autoPickup:false, showFps:true,
    };
    this._bind();
    this._renderMaps();
    this._renderLoadout();
    this._renderOperators();
    this._renderStash();
    this._renderMarket();
    this._renderRank();
    this._renderSettings();
  }

  /* ---------------- 载入 ---------------- */
  boot(){
    const tips = ['正在初始化战术系统…','正在校验反作弊模块…','正在加载地图资源…',
      '正在同步干员数据…','正在连接战区服务器…','准备就绪'];
    let i = 0;
    const fill = $('bootFill');
    const tick = () => {
      const p = Math.min(100, (i+1)/tips.length*100);
      fill.style.width = p+'%';
      $('bootTip').textContent = tips[i];
      i++;
      if (i < tips.length) setTimeout(tick, 260 + Math.random()*220);
      else setTimeout(()=>{
        $('bootTip').textContent = '准备就绪';
        const b = $('bootStart'); b.style.display='inline-block'; b.focus();
      }, 420);
    };
    tick();
  }

  /* ---------------- 绑定 ---------------- */
  _bind(){
    // 导航
    document.querySelectorAll('.nav-item').forEach(b=>{
      b.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        this.show(b.dataset.tab);
      };
    });
    document.querySelectorAll('[data-back]').forEach(b=>{
      b.onclick = ()=>{ Audio2.ui('back'); this.show(b.dataset.back); };
    });
    // 模式
    document.querySelectorAll('.mode-card').forEach(c=>{
      c.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('.mode-card').forEach(x=>x.classList.remove('active'));
        c.classList.add('active');
        this.selMode = c.dataset.mode;
        $('modeName').textContent = c.querySelector('b').textContent;
      };
    });
    // 难度
    document.querySelectorAll('.diff-sel .df-chip').forEach(c=>{
      c.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('.diff-sel .df-chip').forEach(x=>x.classList.remove('active'));
        c.classList.add('active'); this.selDiff = +c.dataset.diff;
      };
    });
    // 干员筛选
    document.querySelectorAll('.role-filter .df-chip').forEach(c=>{
      c.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('.role-filter .df-chip').forEach(x=>x.classList.remove('active'));
        c.classList.add('active');
        const r = c.dataset.role;
        document.querySelectorAll('#opGrid .op-card').forEach(card=>
          card.style.display = (r==='all'||card.dataset.role===r)?'':'none');
      };
    });
    // 仓库筛选
    document.querySelectorAll('.stash-tabs .df-chip').forEach(c=>{
      c.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('.stash-tabs .df-chip').forEach(x=>x.classList.remove('active'));
        c.classList.add('active'); this.stashFilter = c.dataset.stash; this._renderStash();
      };
    });
    // 交易行筛选 / 搜索
    document.querySelectorAll('[data-mk]').forEach(c=>{
      c.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('[data-mk]').forEach(x=>x.classList.remove('active'));
        c.classList.add('active'); this.mkCat = c.dataset.mk; this._renderMarket();
      };
    });
    $('mkSearch').oninput = e=>{ this.mkKw = e.target.value; this._renderMarket(); };
    // 排行榜切换
    document.querySelectorAll('[data-rk]').forEach(c=>{
      c.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('[data-rk]').forEach(x=>x.classList.remove('active'));
        c.classList.add('active');
      };
    });
    // 设置
    $('btnSettings').onclick = ()=>{ Audio2.ui('click'); $('settingsModal').style.display='grid'; };
    $('btnOpenSettings2').onclick = ()=>{ Audio2.ui('click'); $('settingsModal').style.display='grid'; };
    document.querySelectorAll('[data-close]').forEach(b=>{
      b.onclick = ()=>{ Audio2.ui('back'); $(b.dataset.close).style.display='none'; };
    });
    document.querySelectorAll('.set-nav-item').forEach(b=>{
      b.onclick = ()=>{
        Audio2.ui('click');
        document.querySelectorAll('.set-nav-item').forEach(x=>x.classList.remove('active'));
        b.classList.add('active'); this._renderSettings(b.dataset.set);
      };
    });
    // 静音
    $('btnMute').onclick = e=>{
      const on = Audio2.toggle();
      e.currentTarget.classList.toggle('off', !on);
    };
    // 部署
    $('btnDeploy').onclick = ()=>{ Audio2.ui('confirm'); this.onDeploy(this.getConfig()); };
  }

  /* ---------------- 屏幕切换 ---------------- */
  show(name){
    // 兼容历史命名（play / operator）
    const ALIAS = { play:'lobby', operator:'operators', ops:'operators' };
    const key = ALIAS[name] || name;
    const lobbyish = ['lobby','operators','stash','market','rank'];
    lobbyish.forEach(n=>$(n).classList.toggle('active', n===key));
    document.querySelectorAll('.nav-item').forEach(x=>{
      const t = ALIAS[x.dataset.tab] || x.dataset.tab;
      x.classList.toggle('active', t===key);
    });
    // 未知 tab 兜底回大厅，避免出现全空白
    if (!lobbyish.includes(key)) this.show('lobby');
  }

  /* ---------------- 地图 ---------------- */
  _renderMaps(){
    const g = $('mapGrid');
    g.innerHTML = MAPS.map((m,i)=>
      `<div class="map-card ${i===this.selMap?'active':''}" data-i="${i}">
        <div class="map-bg" style="background-image:url('${mapArt(m)}')"></div>
        <div class="map-info"><b>${m.name}</b><em>${m.en}</em><p>${m.desc.slice(0,26)}…</p></div>
      </div>`).join('');
    g.onclick = e=>{
      const c = e.target.closest('.map-card'); if(!c) return;
      Audio2.ui('click');
      this.selMap = +c.dataset.i;
      document.querySelectorAll('.map-card').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      this._renderMapDetail();
    };
    this._renderMapDetail();
  }
  _renderMapDetail(){
    const m = MAPS[this.selMap];
    $('mapTitle').textContent = m.name;
    $('mapDesc').textContent = m.desc;
    $('mapTags').innerHTML = m.tags.map(t=>`<li>${t}</li>`).join('');
    $('mapSquad').textContent = m.squad;
    $('mapTime').textContent = m.time;
    const th = $('mapThreat');
    th.textContent = '★'.repeat(m.threat) + '☆'.repeat(5-m.threat);
    th.className = 'lv-' + (m.threat<=2?1:m.threat<=3?2:m.threat===4?3:4);
  }

  /* ---------------- 干员配装面板 ---------------- */
  _renderLoadout(){
    const op = OPERATORS[this.selOp];
    $('opSilhouette').style.backgroundImage = `url('${operatorArt(op)}')`;
    $('opRole').textContent = op.role;
    $('opName').textContent = op.name;
    $('opEn').textContent = op.en;
    $('skillList').innerHTML = op.skills.map(s=>
      `<div class="skill-row"><span class="sk-ic">${s.ic}</span>
        <div class="sk-txt"><b>${s.n}</b><span>${s.d}</span></div></div>`).join('');
    $('wSlot1').textContent = WEAPONS.m4a1.cn;
    $('wSlot2').textContent = WEAPONS.g17.cn;
  }

  /* ---------------- 干员选择 ---------------- */
  _renderOperators(){
    const g = $('opGrid');
    g.innerHTML = OPERATORS.map((op,i)=>
      `<div class="op-card ${i===this.selOp?'selected':''}" data-i="${i}" data-role="${op.role}">
        <div class="opc-img" style="background-image:url('${operatorArt(op)}')"></div>
        <div class="opc-info">
          <span class="opc-role">${op.role}</span>
          <b>${op.name}</b><em>${op.en}</em>
          <p>${op.desc}</p>
        </div>
        <div class="opc-sel">✓</div>
      </div>`).join('');
    g.onclick = e=>{
      const c = e.target.closest('.op-card'); if(!c) return;
      Audio2.ui('confirm');
      this.selOp = +c.dataset.i;
      document.querySelectorAll('.op-card').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      this._renderLoadout();
    };
  }

  /* ---------------- 仓库 ---------------- */
  _stashItems(){
    const base = [
      ['medkit',4],['ifak',8],['tourniquet',6],['surgery',2],['painkiller',12],
      ['armorplate',7],['ammo556',14],['ammo762',6],['ammo9',9],
      ['goldcup',1],['gpu',3],['bitcoin',1],['vase',2],['cigar',5],['dogtag',11],['fuel',2],
    ];
    let list = base.map(([id,qty])=>({id, qty, def:ITEMS[id]}));
    if (this.stashFilter !== 'all') list = list.filter(x=>x.def.cat===this.stashFilter);
    return list;
  }
  _renderStash(){
    const list = this._stashItems();
    $('stashGrid').innerHTML = list.map(it=>
      `<div class="st-cell r-${it.def.rare}" title="${it.def.n}">
        <img class="st-ic" src="${itemIcon(it.def.ic, RARITY[it.def.rare].color)}">
        <span class="st-qty">${it.qty>1?'×'+it.qty:''}</span>
        <span class="st-rare"></span><span class="st-nm">${it.def.n}</span>
      </div>`).join('');
    const total = list.reduce((s,it)=>s+it.def.val*it.qty, 0);
    $('stashValue').textContent = total.toLocaleString();
    const recent = [['黄金圣杯','零号大坝'],['旗舰显卡','巴克什'],['5.56×45mm 弹药','长弓溪谷'],
      ['护甲板','航天基地'],['身份牌','零号大坝']];
    $('recentList').innerHTML = recent.map(([n,m])=>`<li>${n}<span>${m}</span></li>`).join('');

    // 品级分布
    const order = ['red','gold','purple','blue','green','white'];
    const cnt = {}; order.forEach(k=>cnt[k]=0);
    list.forEach(it=>{ if (cnt[it.def.rare]!=null) cnt[it.def.rare]++; });
    const max = Math.max(1, ...Object.values(cnt));
    $('rareDist').innerHTML = order.map(k=>{
      const w = cnt[k]/max*100;
      return `<div class="rd-row"><span class="lb">${RARITY[k].cn}</span>
        <span class="tr"><i style="width:${w}%;background:${RARITY[k].color}"></i></span>
        <span class="vl">${cnt[k]}</span></div>`;
    }).join('') + `<div class="rd-legend">${order.map(k=>
      `<span><i style="background:${RARITY[k].color}"></i>${RARITY[k].cn}</span>`).join('')}</div>`;
  }

  /* ---------------- 交易行 / 排行 ---------------- */
  _renderMarket(){
    const kw = (this.mkKw || '').trim();
    const cat = this.mkCat || 'all';
    const rows = MARKET_ROWS.filter(r =>
      (cat === 'all' || r[1] === cat) && (!kw || r[0].includes(kw)));

    $('marketBody').innerHTML = rows.length ? rows.map(([n,c,p,d,q,ic,rare])=>{
      const up = d.startsWith('+');
      const pct = Math.min(100, Math.abs(parseFloat(d)) / 10 * 100);
      const hot = q < 30;
      const col = RARITY[rare].color;
      return `<tr>
        <td><div class="mk-name">
          <span class="mk-dot" style="background:${col};box-shadow:0 0 8px ${col}"></span>
          <span class="mk-ic"><img src="${itemIcon(ic, col)}" alt=""></span>
          <span><span class="nm">${n}</span> <span class="tag">${RARITY[rare].cn}</span></span>
        </div></td>
        <td style="color:var(--txt2)">${c}</td>
        <td><b>${p}</b></td>
        <td><span class="mk-trend ${up?'up':'down'}"><i class="arw">${up?'▲':'▼'}</i>${d}</span></td>
        <td><span class="mk-bar"><i class="${hot?'hot':''}" style="width:${Math.min(100,q/6)}%"></i></span>
            <span style="color:${hot?'var(--orange)':'var(--txt2)'};margin-left:6px">${q}</span></td>
        <td><button class="df-btn xs">购买</button></td></tr>`;
    }).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--txt3);padding:34px">没有匹配的物品</td></tr>`;
  }
  _renderRank(){
    const opHue = {};
    OPERATORS.forEach(o => opHue[o.name] = o.hue);
    const hue = n => `hsl(${opHue[n] ?? 90},62%,58%)`;

    // 领奖台：前三名
    $('rkPodium').innerHTML = RANK_ROWS.slice(0,3).map((r,i)=>`
      <div class="rk-pod g${i+1}">
        <div class="medal">${i+1}</div>
        <div class="who"><b>${r[0]}</b><em>${r[1]}</em><span>K/D ${r[3]} · 撤离率 ${r[4]}</span></div>
        <div class="sc"><b>${r[2]}</b><span>SCORE</span></div>
      </div>`).join('');

    $('rankBody').innerHTML = RANK_ROWS.map((r,i)=>{
      const cls = i===0?'top1':i===1?'top2':i===2?'top3':'';
      const kd = parseFloat(r[3]);
      const ex = parseInt(r[4]);
      return `<tr class="${cls}">
        <td class="rk-no">${String(i+1).padStart(2,'0')}</td>
        <td><b>${r[0]}</b></td>
        <td><span class="op-tag"><i class="op-dot" style="background:${hue(r[1])}"></i>${r[1]}</span></td>
        <td><b>${r[2]}</b></td>
        <td class="kd ${kd>=3?'hi':''}">${r[3]}</td>
        <td><span class="ex-bar"><i style="width:${ex}%"></i></span>${r[4]}</td></tr>`;
    }).join('');
  }

  /* ---------------- 设置 ---------------- */
  _renderSettings(tab='video'){
    const s = this.settings;
    const row = (label, ctrl) => `<div class="set-row"><label>${label}</label>${ctrl}</div>`;
    const slider = (k, min, max, step, fmt=v=>v) =>
      `<div style="display:flex;align-items:center;gap:10px">
        <input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-setk="${k}">
        <span class="val" data-valfor="${k}">${fmt(s[k])}</span></div>`;
    const sw = k => `<div class="switch ${s[k]?'on':''}" data-setsw="${k}"></div>`;

    const PAGES = {
      video: `
        <div class="set-group"><h5>显示</h5>
          ${row('亮度', slider('brightness',.5,1.5,.05,v=>Math.round(v*100)+'%'))}
          ${row('视野 FOV', slider('fov',70,120,1,v=>v+'°'))}
        </div>
        <div class="set-group"><h5>画质</h5>
          ${row('画质预设', `<select data-setk="quality">
            <option value="low"${s.quality==='low'?' selected':''}>流畅</option>
            <option value="medium"${s.quality==='medium'?' selected':''}>均衡</option>
            <option value="high"${s.quality==='high'?' selected':''}>高画质</option>
          </select>`)}
          ${row('阴影', sw('shadow'))}
          ${row('垂直同步', sw('vsync'))}
        </div>
        <div class="set-group"><h5>界面</h5>
          ${row('显示 FPS / 延迟', sw('fps'))}
          ${row('准星样式', `<select data-setk="crosshair">
            <option value="cross"${s.crosshair==='cross'?' selected':''}>十字</option>
            <option value="dot"${s.crosshair==='dot'?' selected':''}>圆点</option>
            <option value="t shape"${s.crosshair==='t shape'?' selected':''}>T 型</option>
          </select>`)}
          ${row('命中提示', sw('hitmarker'))}
          ${row('伤害数字', sw('dmgNum'))}
        </div>`,
      audio: `
        <div class="set-group"><h5>音量</h5>
          ${row('主音量', slider('volMaster',0,1,.05,v=>Math.round(v*100)+'%'))}
          ${row('音效', slider('volSfx',0,1,.05,v=>Math.round(v*100)+'%'))}
          ${row('语音', slider('volVoice',0,1,.05,v=>Math.round(v*100)+'%'))}
          ${row('音乐', slider('volMusic',0,1,.05,v=>Math.round(v*100)+'%'))}
        </div>
        <div class="set-group"><h5>提示</h5>
          <p class="dim" style="font-size:11px;line-height:1.8">
          音频由 WebAudio 实时合成，无外部音频文件依赖。首次点击页面后生效。</p>
        </div>`,
      control: `
        <div class="set-group"><h5>鼠标</h5>
          ${row('灵敏度', slider('sens',.2,3,.05,v=>v.toFixed(2)))}
          ${row('开镜灵敏度', slider('adsSens',.2,3,.05,v=>v.toFixed(2)))}
          ${row('反转 Y 轴', sw('invertY'))}
        </div>
        <div class="set-group"><h5>键位</h5>
          ${[['前进','W'],['后退','S'],['左移','A'],['右移','D'],['冲刺','Shift'],
             ['蹲伏','Ctrl'],['跳跃','Space'],['射击','鼠标左键'],['瞄准','鼠标右键'],
             ['换弹','R'],['交互 / 搜刮','F'],['战术背包','Tab'],['地图','M'],
             ['投掷手雷','G'],['快速治疗','H'],['切换武器','1 / 2'],['快捷道具','3 - 7'],
             ['计分板','Tab'],['暂停','ESC']]
            .map(([n,k])=>row(n, `<span class="keycap">${k}</span>`)).join('')}
        </div>`,
      game: `
        <div class="set-group"><h5>玩法</h5>
          ${row('自动拾取弹药', sw('autoPickup'))}
          ${row('显示 FPS', sw('showFps'))}
          ${row('命中提示', sw('hitmarker'))}
          ${row('伤害数字', sw('dmgNum'))}
        </div>
        <div class="set-group"><h5>关于</h5>
          <p class="dim" style="font-size:11px;line-height:1.9">
          灰区行动 · WEB 战术射击<br>
          本页面为技术演示，所有美术资源由代码程序化生成。<br>
          three.js r160 · WebGL · WebAudio</p>
        </div>`,
    };
    $('setContent').innerHTML = PAGES[tab] || PAGES.video;

    $('setContent').querySelectorAll('input[type=range]').forEach(r=>{
      r.oninput = ()=>{
        const k = r.dataset.setk; this.settings[k] = +r.value;
        const v = $('setContent').querySelector(`[data-valfor="${k}"]`);
        const f = k==='fov'?(x=>x+'°'):(k==='sens'||k==='adsSens')?(x=>x.toFixed(2)):(x=>Math.round(x*100)+'%');
        if (v) v.textContent = f(+r.value);
        if (k==='volMaster') Audio2.setVolume(+r.value);
      };
    });
    $('setContent').querySelectorAll('select').forEach(sel=>{
      sel.onchange = ()=>{ this.settings[sel.dataset.setk] = sel.value; };
    });
    $('setContent').querySelectorAll('[data-setsw]').forEach(swEl=>{
      swEl.onclick = ()=>{
        const k = swEl.dataset.setsw; this.settings[k] = !this.settings[k];
        swEl.classList.toggle('on', this.settings[k]);
      };
    });
  }

  /* ---------------- 输出配置 ---------------- */
  getConfig(){
    return {
      map: MAPS[this.selMap], diff: DIFFS[this.selDiff], diffIdx: this.selDiff,
      operator: OPERATORS[this.selOp], mode: this.selMode, settings: this.settings,
    };
  }
}
