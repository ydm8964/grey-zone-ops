/* ============================================================
   配置数据层：干员 / 武器 / 物品 / 地图 / 图标生成
============================================================ */

export const RARITY = {
  white: { cn:'普通', color:'#c8d0c8' },
  green: { cn:'精良', color:'#4ade80' },
  blue:  { cn:'稀有', color:'#4db5ff' },
  purple:{ cn:'史诗', color:'#b06cff' },
  gold:  { cn:'传说', color:'#ffc23e' },
  red:   { cn:'禁忌', color:'#ff4757' },
};

/* ---------------- 干员 ---------------- */
export const OPERATORS = [
  { id:'wolf', name:'红狼', en:'WOLF', role:'突击', hue:12,
    desc:'前特种部队突击手，擅长近距离压制与高速突进。',
    skills:[
      { ic:'⚡', n:'动力外骨骼', d:'开启后 8 秒内移动速度提升 40%，冲刺消耗减半' },
      { ic:'☁', n:'烟雾弹', d:'投掷烟雾弹，形成半径 8 米烟幕，持续 12 秒' },
      { ic:'✚', n:'肾上腺素', d:'击倒敌人后恢复 25 点生命并重置体力' },
    ]},
  { id:'stinger', name:'蜂医', en:'STINGER', role:'支援', hue:150,
    desc:'战地医疗专家，携带蜂群无人机，可为小队提供持续治疗。',
    skills:[
      { ic:'✚', n:'蜂群治疗无人机', d:'释放无人机，为范围内队友每秒恢复 8 点生命，持续 15 秒' },
      { ic:'◎', n:'激素注射枪', d:'远程注射，瞬间恢复目标 40 点生命并解除重伤' },
      { ic:'✚', n:'战场急救', d:'救援队友速度提升 60%' },
    ]},
  { id:'luna', name:'露娜', en:'LUNA', role:'侦察', hue:200,
    desc:'情报侦察干员，掌握战场视野，擅长远程狙击与标记。',
    skills:[
      { ic:'◎', n:'侦查箭', d:'射出侦查箭，落点 25 米内敌人被持续标记 10 秒' },
      { ic:'◈', n:'情报扫描', d:'扫描 60 米范围内所有敌人，持续 6 秒' },
      { ic:'✦', n:'静步', d:'移动时脚步声降低 70%' },
    ]},
  { id:'hackclaw', name:'骇爪', en:'HACKCLAW', role:'工程', hue:280,
    desc:'电子战专家，可瘫痪敌方设备并夺取战场控制权。',
    skills:[
      { ic:'⌁', n:'骇入脉冲', d:'瘫痪 30 米内敌方电子设备与瞄具 8 秒' },
      { ic:'▣', n:'战术雷达', d:'部署雷达，标记 50 米内移动目标 20 秒' },
      { ic:'⚙', n:'工程精通', d:'开启容器速度提升 50%，可破解加密保险箱' },
    ]},
  { id:'shepherd', name:'牧羊人', en:'SHEPHERD', role:'支援', hue:45,
    desc:'防御型干员，可部署声呐与防护屏障，掩护队友推进。',
    skills:[
      { ic:'▣', n:'声呐探测器', d:'部署声呐，周期标记 35 米内敌人，持续 25 秒' },
      { ic:'⬢', n:'防爆屏障', d:'部署可吸收 400 点伤害的屏障，持续 20 秒' },
      { ic:'✚', n:'护甲修复', d:'为队友修复 60 点护甲值' },
    ]},
  { id:'vyron', name:'威龙', en:'VYRON', role:'突击', hue:0,
    desc:'重型突击干员，火力压制与破点能力极强。',
    skills:[
      { ic:'☠', n:'三连装炸药', d:'投掷三连装炸药，破门或造成范围杀伤' },
      { ic:'⚡', n:'战术冲刺', d:'短时提升移动速度并降低受击伤害 20%' },
      { ic:'✦', n:'爆破抗性', d:'受到爆炸伤害降低 35%' },
    ]},
  { id:'tempest', name:'疾风', en:'TEMPEST', role:'突击', hue:190,
    desc:'高机动突击手，擅长绕后与快速换位。',
    skills:[
      { ic:'⚡', n:'战术钩索', d:'发射钩索快速位移至目标点' },
      { ic:'◎', n:'震荡手雷', d:'致盲并减速范围内敌人 3 秒' },
      { ic:'✦', n:'轻装', d:'移动速度提升 12%，翻越速度加快' },
    ]},
  { id:'deepblue', name:'深蓝', en:'DEEP BLUE', role:'工程', hue:210,
    desc:'载具与机械专家，可呼叫火力支援与部署哨戒。',
    skills:[
      { ic:'▣', n:'哨戒机枪', d:'部署自动哨戒机枪，持续 30 秒' },
      { ic:'⚙', n:'载具维修', d:'修复载具并提升其装甲 30%' },
      { ic:'✦', n:'机械亲和', d:'可携带额外弹药与投掷物' },
    ]},
  { id:'byte', name:'比特', en:'BYTE', role:'工程', hue:100,
    desc:'无人机操作员，空中侦察与精确打击。',
    skills:[
      { ic:'◈', n:'自爆无人机', d:'操控无人机撞击目标，造成 90 点爆炸伤害' },
      { ic:'◎', n:'空中侦察', d:'无人机升空标记 70 米内敌人 12 秒' },
      { ic:'⚙', n:'快速部署', d:'技能冷却缩短 25%' },
    ]},
  { id:'silverwing', name:'银翼', en:'SILVER WING', role:'侦察', hue:220,
    desc:'高空渗透专家，可滑翔突入并标记敌方部署。',
    skills:[
      { ic:'✈', n:'滑翔翼', d:'展开滑翔翼，可从高处滑翔 200 米' },
      { ic:'◎', n:'标记信号弹', d:'标记 80 米内所有敌人 8 秒' },
      { ic:'✦', n:'高空视野', d:'开镜时可视距离提升 25%' },
    ]},
  { id:'gu', name:'蛊', en:'GU', role:'支援', hue:320,
    desc:'毒素与烟雾战术专家，擅长区域封锁。',
    skills:[
      { ic:'☠', n:'毒气弹', d:'投掷毒气弹，区域内敌人持续掉血并咳嗽' },
      { ic:'☁', n:'烟雾发生器', d:'生成大范围烟雾掩护，持续 18 秒' },
      { ic:'✦', n:'抗毒体质', d:'免疫毒气与燃烧伤害' },
    ]},
];

/* ---------------- 武器 ---------------- */
export const WEAPONS = {
  m4a1:  { name:'M4A1',       cn:'M4A1 突击步枪', cal:'5.56×45mm', dmg:26, rpm:700, mag:30, reserve:210, recoil:{x:0.42,y:0.85}, spread:1.6, adsSpread:0.4, reload:2.4, ads:0.22, range:120, auto:true,  modes:['auto','single'], scope:1.25 },
  ak12:  { name:'AK-12',      cn:'AK-12 突击步枪', cal:'5.45×39mm', dmg:32, rpm:620, mag:30, reserve:180, recoil:{x:0.58,y:1.15}, spread:2.0, adsSpread:0.5, reload:2.7, ads:0.26, range:130, auto:true,  modes:['auto','single'], scope:1.25 },
  scar:  { name:'SCAR-H',     cn:'SCAR-H 战斗步枪', cal:'7.62×51mm', dmg:42, rpm:550, mag:20, reserve:140, recoil:{x:0.72,y:1.45}, spread:2.2, adsSpread:0.45, reload:2.9, ads:0.28, range:160, auto:true, modes:['auto','single'], scope:1.35 },
  vector:{ name:'Vector',     cn:'Vector 冲锋枪', cal:'.45 ACP', dmg:20, rpm:1100, mag:25, reserve:200, recoil:{x:0.34,y:0.62}, spread:2.4, adsSpread:0.7, reload:1.9, ads:0.16, range:70, auto:true, modes:['auto','burst'], scope:1.15 },
  mp5:   { name:'MP5',        cn:'MP5 冲锋枪', cal:'9×19mm', dmg:22, rpm:800, mag:30, reserve:240, recoil:{x:0.3,y:0.55}, spread:2.1, adsSpread:0.6, reload:2.1, ads:0.15, range:80, auto:true, modes:['auto','single'], scope:1.15 },
  sr25:  { name:'SR-25',      cn:'SR-25 精确射手步枪', cal:'7.62×51mm', dmg:68, rpm:280, mag:20, reserve:100, recoil:{x:0.9,y:2.0}, spread:3.2, adsSpread:0.06, reload:3.2, ads:0.36, range:220, auto:false, modes:['single'], scope:3.0 },
  awm:   { name:'AWM',        cn:'AWM 狙击步枪', cal:'.338 Lapua', dmg:145, rpm:45, mag:5, reserve:30, recoil:{x:1.4,y:3.0}, spread:5.0, adsSpread:0.02, reload:3.8, ads:0.46, range:400, auto:false, modes:['single'], scope:5.0 },
  g17:   { name:'G17',        cn:'G17 手枪', cal:'9×19mm', dmg:24, rpm:400, mag:17, reserve:85, recoil:{x:0.5,y:0.9}, spread:2.4, adsSpread:0.9, reload:1.7, ads:0.18, range:60, auto:false, modes:['single'], scope:1.1 },
  shotgun:{name:'M870',       cn:'M870 霰弹枪', cal:'12铅径', dmg:16, rpm:75, mag:6, reserve:42, recoil:{x:1.2,y:2.4}, spread:6.5, adsSpread:3.2, reload:3.4, ads:0.24, range:35, pellets:9, auto:false, modes:['single'], scope:1.0 },
};

/* ---------------- 物品 ---------------- */
export const ITEMS = {
  medkit:   { n:'军用医疗包',   rare:'green',  cat:'medic',     ic:'medkit',  wt:0.6, val:12000, use:6.0, heal:75,  desc:'恢复 75 点生命，可治疗轻伤部位。' },
  ifak:     { n:'IFAK 急救包',  rare:'white',  cat:'medic',     ic:'bandage', wt:0.3, val:3200,  use:3.2, heal:35,  desc:'快速恢复 35 点生命。' },
  tourniquet:{n:'止血带',       rare:'green',  cat:'medic',     ic:'tourn',   wt:0.2, val:5800,  use:2.4, heal:0,   desc:'止住大出血状态，防止持续失血。' },
  surgery:  { n:'手术包',       rare:'blue',   cat:'medic',     ic:'surgery', wt:1.1, val:26000, use:9.5, heal:0,   desc:'修复所有受损部位，恢复行动能力。' },
  painkiller:{n:'止痛药',       rare:'white',  cat:'medic',     ic:'pill',    wt:0.1, val:1800,  use:2.0, heal:0,   desc:'30 秒内持续恢复生命，可带伤行动。' },
  armorplate:{n:'护甲板',       rare:'blue',   cat:'armor',     ic:'plate',   wt:1.8, val:21000, use:4.5, armor:50,desc:'修复 50 点护甲值，可叠加使用。' },
  ammo556:  { n:'5.56×45mm 弹药', rare:'white', cat:'ammo',     ic:'ammo',    wt:0.4, val:900,   ammo:60,  desc:'一盒 60 发步枪弹。' },
  ammo762:  { n:'7.62×51mm 弹药', rare:'white', cat:'ammo',     ic:'ammo',    wt:0.5, val:1200,  ammo:40,  desc:'一盒 40 发全威力弹。' },
  ammo9:    { n:'9×19mm 手枪弹', rare:'white', cat:'ammo',      ic:'ammo',    wt:0.3, val:600,   ammo:50,  desc:'一盒 50 发手枪弹。' },
  goldcup:  { n:'黄金圣杯',     rare:'gold',   cat:'valuable',  ic:'cup',     wt:2.4, val:420000, desc:'阿萨拉卫队搜刮的战利品，价值连城。' },
  gpu:      { n:'旗舰显卡',     rare:'purple', cat:'valuable',  ic:'chip',    wt:0.9, val:186000, desc:'黑市抢手货，体积小价值高。' },
  bitcoin:  { n:'比特币矿机',   rare:'purple', cat:'valuable',  ic:'box',     wt:4.5, val:158000, desc:'沉重的电子设备，但收益可观。' },
  vase:     { n:'古董花瓶',     rare:'blue',   cat:'valuable',  ic:'vase',    wt:1.6, val:74000,  desc:'易碎的古代工艺品。' },
  cigar:    { n:'雪茄盒',       rare:'green',  cat:'valuable',  ic:'box',     wt:0.7, val:28000,  desc:'军官私藏的雪茄。' },
  dogtag:   { n:'身份牌',       rare:'white',  cat:'valuable',  ic:'tag',     wt:0.1, val:4500,   desc:'从阵亡者身上取下的身份牌。' },
  fuel:     { n:'航空燃料',     rare:'blue',   cat:'valuable',  ic:'can',     wt:3.2, val:96000,  desc:'高纯度燃料，军工急需物资。' },
};

/* ---------------- 地图 ---------------- */
export const MAPS = [
  { id:'dam', name:'零号大坝', en:'ZERO DAM', threat:2, squad:'3 人', time:'25 分钟', palette:['#3a4a3a','#1a2418','#0d120d'],
    desc:'阿萨拉卫队控制的水利枢纽，物资丰沛，三处撤离点。地形开阔，狙击手的天堂。',
    tags:['开阔地形','狙击点位','高价值物资','3处撤离点'] },
  { id:'valley', name:'长弓溪谷', en:'LONG BOW VALLEY', threat:3, squad:'3 人', time:'28 分钟', palette:['#4a5238','#242a1c','#0e1109'],
    desc:'被遗弃的山区矿场，巷道纵横，近距离交火频繁。地下设施藏有大量军械。',
    tags:['复杂巷道','近战密集','地下设施','4处撤离点'] },
  { id:'bark', name:'巴克什', en:'BARKHAN', threat:4, squad:'3 人', time:'30 分钟', palette:['#5a4a32','#2e2618','#12100a'],
    desc:'沙漠中的石油精炼厂，烈日与沙尘暴交替。重兵把守，物资等级最高。',
    tags:['沙漠地形','重兵把守','顶级物资','2处撤离点'] },
  { id:'space', name:'航天基地', en:'SPACE BASE', threat:5, squad:'3 人', time:'32 分钟', palette:['#2a3a4a','#161e28','#0a0d12'],
    desc:'绝密航天发射场，卫队精锐驻守。进入需支付高额门票，回报亦极为丰厚。',
    tags:['需门票','精锐卫队','传说物资','1处撤离点'] },
];

/* ---------------- 难度 ---------------- */
export const DIFFS = [
  { n:'常规', enemyMul:0.8, lootMul:1.0, aiDmg:0.8 },
  { n:'机密', enemyMul:1.2, lootMul:1.35, aiDmg:1.1 },
  { n:'绝密', enemyMul:1.7, lootMul:1.8, aiDmg:1.45 },
];

/* ---------------- SVG 图标生成 ---------------- */
const ic = s => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;

export function itemIcon(kind, color='#d8ff3e'){
  const W = v => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${v}</svg>`;
  const M = {
    medkit: W(`<rect x="8" y="18" width="48" height="34" rx="3" fill="#1a2a1a" stroke="${color}" stroke-width="2"/>
      <rect x="26" y="10" width="12" height="8" fill="#1a2a1a" stroke="${color}" stroke-width="2"/>
      <path d="M32 24v22M21 35h22" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`),
    bandage: W(`<rect x="6" y="24" width="52" height="18" rx="2" fill="#e8e0c8" stroke="#a89a72" stroke-width="2" transform="rotate(-20 32 33)"/>
      <circle cx="22" cy="27" r="2.4" fill="#a89a72"/><circle cx="32" cy="24" r="2.4" fill="#a89a72"/><circle cx="42" cy="27" r="2.4" fill="#a89a72"/>`),
    tourn: W(`<path d="M12 32h40" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#8a2b2b" stroke-width="6"/>
      <path d="M32 16v32" stroke="#8a2b2b" stroke-width="4" stroke-dasharray="4 4"/>`),
    surgery: W(`<rect x="10" y="12" width="44" height="40" rx="4" fill="#16261e" stroke="${color}" stroke-width="2"/>
      <path d="M20 32h24M32 20v24" stroke="${color}" stroke-width="3"/>
      <circle cx="32" cy="32" r="12" fill="none" stroke="${color}" stroke-width="1.5" opacity=".6"/>`),
    pill: W(`<rect x="10" y="22" width="44" height="20" rx="10" fill="#d8e8ff" stroke="#7a92b8" stroke-width="2"/>
      <path d="M32 22v20" stroke="#7a92b8" stroke-width="2"/><circle cx="21" cy="32" r="3" fill="#ff8a94"/>`),
    plate: W(`<path d="M32 6l22 8v22c0 12-9 19-22 24-13-5-22-12-22-24V14z" fill="#22303c" stroke="${color}" stroke-width="2"/>
      <path d="M32 14l14 5v14c0 8-6 12-14 16-8-4-14-8-14-16V19z" fill="#2e4050"/>`),
    ammo: W(`<rect x="12" y="14" width="40" height="38" rx="2" fill="#2a2a1e" stroke="#b8a04a" stroke-width="2"/>
      <path d="M20 14v8M28 14v8M36 14v8M44 14v8" stroke="#b8a04a" stroke-width="3"/>
      <rect x="16" y="30" width="32" height="18" fill="#3a3a28"/>`),
    cup: W(`<path d="M18 12h28l-4 20a10 10 0 0 1-20 0z" fill="#d4a02a" stroke="#8a6410" stroke-width="2"/>
      <path d="M32 42v6M22 52h20" stroke="#d4a02a" stroke-width="4" stroke-linecap="round"/>`),
    chip: W(`<rect x="14" y="14" width="36" height="36" rx="3" fill="#1a1a24" stroke="#7ad0ff" stroke-width="2"/>
      <rect x="24" y="24" width="16" height="16" fill="#2a3a52"/>
      <path d="M22 14v-6M32 14v-6M42 14v-6M22 50v6M32 50v6M42 50v6M14 22h-6M14 32h-6M14 42h-6M50 22h6M50 32h6M50 42h6" stroke="#7ad0ff" stroke-width="2"/>`),
    box: W(`<path d="M8 22l24-12 24 12v22L32 56 8 44z" fill="#3a3020" stroke="#a89050" stroke-width="2"/>
      <path d="M8 22l24 12 24-12M32 34v22" stroke="#a89050" stroke-width="2" fill="none"/>`),
    vase: W(`<path d="M24 8h16l-3 8c8 5 11 12 11 20 0 12-9 20-16 20s-16-8-16-20c0-8 3-15 11-20z" fill="#5a7a9a" stroke="#3a5a7a" stroke-width="2"/>
      <path d="M18 30c6 4 22 4 28 0" stroke="#8ab0d0" stroke-width="2" fill="none"/>`),
    tag: W(`<circle cx="32" cy="22" r="12" fill="none" stroke="#c8d0c8" stroke-width="3"/>
      <path d="M22 32l-6 24 16-12 16 12-6-24" fill="none" stroke="#c8d0c8" stroke-width="3"/>`),
    can: W(`<rect x="14" y="20" width="30" height="34" rx="3" fill="#8a3a2a" stroke="#d0a050" stroke-width="2"/>
      <path d="M44 26h6l2 12-8 2z" fill="#6a2a1a"/><rect x="20" y="28" width="18" height="14" fill="#d0a050" opacity=".7"/>`),
    rifle: W(`<path d="M6 26h38v8H6z" fill="#2e2e28" stroke="#7a7a6a" stroke-width="1.6"/>
      <path d="M44 28h14v5H44z" fill="#1e1e18"/><path d="M16 34l-4 12h6l4-12z" fill="#3a3a30"/>
      <path d="M26 26v-6h8v6" fill="none" stroke="#7a7a6a" stroke-width="1.6"/>`),
    helmet: W(`<path d="M10 34a22 22 0 0 1 44 0v6H10z" fill="#2a3a2a" stroke="#7a8a6a" stroke-width="2"/>
      <path d="M10 34h44v8H10z" fill="#1a2418"/>`),
    backpack: W(`<rect x="14" y="16" width="36" height="40" rx="8" fill="#2a3424" stroke="#7a8a5a" stroke-width="2"/>
      <rect x="22" y="28" width="20" height="14" rx="2" fill="#1a2414"/>
      <path d="M20 16v-6h24v6" fill="none" stroke="#7a8a5a" stroke-width="2"/>`),
    gpu: W(`<rect x="6" y="18" width="52" height="26" rx="2" fill="#1c2028" stroke="#6ad0ff" stroke-width="2"/>
      <circle cx="20" cy="31" r="8" fill="#0e1218" stroke="#6ad0ff" stroke-width="1.6"/>
      <circle cx="44" cy="31" r="8" fill="#0e1218" stroke="#6ad0ff" stroke-width="1.6"/>
      <path d="M20 31l6-5M44 31l-6 5" stroke="#6ad0ff" stroke-width="1.6"/>
      <rect x="28" y="24" width="8" height="14" fill="#2a3444"/>
      <path d="M10 44v8M20 44v8M30 44v8M40 44v8M50 44v8" stroke="#c8a04a" stroke-width="2.6"/>`),
    btc: W(`<rect x="8" y="12" width="48" height="40" rx="4" fill="#20242c" stroke="#f0a83e" stroke-width="2"/>
      <rect x="14" y="18" width="36" height="20" rx="2" fill="#0e1218"/>
      <path d="M20 24h12a4 4 0 0 1 0 8H20z" fill="none" stroke="#f0a83e" stroke-width="2"/>
      <path d="M20 22v10M24 20v4M28 20v4M24 30v4M28 30v4" stroke="#f0a83e" stroke-width="1.6"/>
      <circle cx="44" cy="45" r="3" fill="#f0a83e"/><path d="M16 44h20" stroke="#6a7480" stroke-width="2"/>`),
    fuel: W(`<rect x="16" y="10" width="32" height="46" rx="4" fill="#7a2a20" stroke="#d0a050" stroke-width="2"/>
      <rect x="16" y="22" width="32" height="4" fill="#d0a050" opacity=".8"/>
      <rect x="16" y="40" width="32" height="4" fill="#d0a050" opacity=".8"/>
      <path d="M32 16c4 5 6 8 6 12a6 6 0 0 1-12 0c0-4 2-7 6-12z" fill="#ffb03e"/>
      <path d="M24 6h16" stroke="#5a1a12" stroke-width="3"/>`),
    sniper: W(`<path d="M4 28h34v7H4z" fill="#2e2e28" stroke="#7a7a6a" stroke-width="1.6"/>
      <path d="M38 29h22v4H38z" fill="#1a1a16"/>
      <path d="M22 26h12v5H22z" fill="#1a1a16"/>
      <rect x="24" y="18" width="10" height="8" rx="2" fill="#141414" stroke="#5ac8ff" stroke-width="1.4"/>
      <path d="M14 35l-4 12h6l4-12z" fill="#3a3a30"/><path d="M30 35v-4h6v4" fill="none" stroke="#7a7a6a" stroke-width="1.6"/>`),
    smg: W(`<path d="M8 26h30v8H8z" fill="#2e2e28" stroke="#7a7a6a" stroke-width="1.6"/>
      <path d="M38 28h12v5H38z" fill="#1e1e18"/>
      <path d="M20 34h6l-2 16h-6z" fill="#3a3a30"/>
      <path d="M12 34l-3 10h5l3-10z" fill="#3a3a30"/>
      <path d="M24 26v-5h6v5" fill="none" stroke="#7a7a6a" stroke-width="1.6"/>`),
  };
  return ic(M[kind] || M.box);
}

/* 干员剪影（程序化生成，避免外部素材依赖） */
export function operatorArt(op){
  const h = op.hue;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${h},22%,16%)"/>
        <stop offset="1" stop-color="hsl(${h},26%,7%)"/>
      </linearGradient>
      <linearGradient id="bd" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${h},46%,42%)"/>
        <stop offset="1" stop-color="hsl(${h},52%,16%)"/>
      </linearGradient>
    </defs>
    <rect width="300" height="400" fill="url(#bg)"/>
    <g opacity=".14" stroke="hsl(${h},60%,55%)" stroke-width="1">
      ${Array.from({length:11},(_,i)=>`<line x1="0" y1="${i*40}" x2="300" y2="${i*40}"/>`).join('')}
      ${Array.from({length:8},(_,i)=>`<line x1="${i*40}" y1="0" x2="${i*40}" y2="400"/>`).join('')}
    </g>
    <circle cx="150" cy="132" r="76" fill="hsl(${h},30%,26%)" opacity=".35"/>
    <path d="M150 60c26 0 42 20 42 46v34h-84v-34c0-26 16-46 42-46z" fill="url(#bd)"/>
    <path d="M104 118c0-30 20-52 46-52s46 22 46 52v14h-92z" fill="hsl(${h},40%,22%)"/>
    <rect x="112" y="96" width="76" height="18" rx="4" fill="#0d1410" opacity=".85"/>
    <rect x="118" y="99" width="30" height="12" fill="hsl(${h},80%,52%)" opacity=".7"/>
    <rect x="156" y="99" width="26" height="12" fill="hsl(${h},80%,52%)" opacity=".45"/>
    <path d="M150 152c46 0 84 26 92 62l10 186H48l10-186c8-36 46-62 92-62z" fill="url(#bd)"/>
    <path d="M112 168l38 34 38-34 10 14-48 44-48-44z" fill="hsl(${h},60%,30%)"/>
    <rect x="60" y="232" width="180" height="26" rx="3" fill="#151d12" opacity=".9"/>
    <rect x="72" y="242" width="60" height="8" rx="2" fill="hsl(${h},70%,50%)" opacity=".65"/>
    <rect x="146" y="242" width="40" height="8" rx="2" fill="hsl(${h},70%,50%)" opacity=".4"/>
    <path d="M196 236l58 14-12 42-52-12z" fill="#20261c"/>
    <rect x="204" y="248" width="46" height="8" rx="2" fill="#3a4432"/>
    <text x="150" y="378" text-anchor="middle" font-size="46" font-weight="900"
      fill="hsl(${h},70%,62%)" opacity=".18" font-family="sans-serif">${op.en}</text>
  </svg>`;
  return ic(svg);
}

/* 地图缩略图（战术等高线风格） */
export function mapArt(m){
  const [c1,c2,c3] = m.palette;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
    </linearGradient></defs>
    <rect width="400" height="240" fill="url(#g)"/>
    <g fill="none" stroke="rgba(255,255,255,.10)" stroke-width="1">
      ${Array.from({length:14},(_,i)=>`<path d="M0 ${20+i*16} C 80 ${10+i*16}, 140 ${40+i*16}, 200 ${22+i*16} S 330 ${4+i*16}, 400 ${26+i*16}"/>`).join('')}
    </g>
    <g opacity=".5">
      <path d="M40 200 L110 168 L160 186 L150 232 L58 236 Z" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.2)"/>
      <path d="M180 150 L246 132 L268 158 L212 176 Z" fill="rgba(0,0,0,.4)" stroke="rgba(255,255,255,.18)"/>
      <path d="M286 92 L352 74 L372 108 L306 124 Z" fill="rgba(0,0,0,.42)" stroke="rgba(255,255,255,.18)"/>
      <rect x="196" y="196" width="52" height="34" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.15)"/>
      <rect x="60" y="70" width="34" height="52" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.15)"/>
    </g>
    <g stroke="rgba(255,255,255,.14)" stroke-width="2" fill="none">
      <path d="M0 118 L400 96"/><path d="M136 0 L120 240"/><path d="M266 0 L300 240"/>
    </g>
    <g fill="rgba(216,255,62,.5)">
      <circle cx="352" cy="182" r="4"/><circle cx="24" cy="26" r="4"/><circle cx="378" cy="228" r="4"/>
    </g>
    <text x="14" y="228" font-size="11" fill="rgba(255,255,255,.32)" font-family="monospace">${m.en} · GRID 15-42</text>
  </svg>`;
  return ic(svg);
}
