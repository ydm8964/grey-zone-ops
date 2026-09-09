/* ============================================================
   入口：屏幕状态机 / 部署流程
============================================================ */
import { Menu } from './menu.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { Audio2 } from './audio.js';

const $ = id => document.getElementById(id);
const SCREENS = ['boot','lobby','operators','stash','market','rank','hud'];

function showScreen(id){
  SCREENS.forEach(s => $(s).classList.toggle('active', s===id));
  // 退出战斗回大厅时，导航高亮同步回「开始游戏」
  const ALIAS = { play:'lobby', operator:'operators', ops:'operators' };
  document.querySelectorAll('.nav-item').forEach(x=>{
    const t = ALIAS[x.dataset.tab] || x.dataset.tab;
    x.classList.toggle('active', t===id);
  });
}

/* 先建菜单（纯 DOM，不依赖 WebGL），再建 3D（失败也不影响大厅） */
const hud = new HUD();
let game = null, menu = null;
try {
  game = new Game($('scene'), hud);
} catch (err){
  console.error('3D 初始化失败：', err);
  game = { noWebgl:true, start:()=>false, stop(){}, onExit:null,
           _showErr(){ hud.toast('WebGL 初始化失败，请在支持 WebGL 的浏览器中打开', '#ff4757'); } };
}
menu = new Menu(cfg => deploy(cfg));

/* WebGL 预检：不支持时在大厅直接禁用部署按钮并给出原因，而不是点了才报错 */
if (game.noWebgl){
  const btn = $('btnDeploy');
  btn.classList.add('disabled');
  btn.textContent = '设备不支持 WebGL';
  btn.title = '请使用支持 WebGL 的浏览器（Chrome / Edge / Safari 最新版）后重试';
}

/* 载入 → 大厅 */
menu.boot();
$('bootStart').onclick = ()=>{
  Audio2.init(); Audio2.resume();
  Audio2.ui('confirm');
  showScreen('lobby');
};

/* 部署流程 */
function deploy(cfg){
  if (game.noWebgl) return;   // 按钮已禁用并注明原因，不再走倒计时→失败回退
  Audio2.init(); Audio2.resume();
  showScreen('hud');
  hud.showDeploy(true, cfg.map.name, 3);
  Audio2.alarm();

  let n = 3;
  const tick = setInterval(()=>{
    n--;
    if (n > 0){
      hud.showDeploy(true, cfg.map.name, n);
      Audio2.ui('click');
    } else {
      clearInterval(tick);
      hud.showDeploy(false);
      // 战局初始化异常兜底：任何错误都要提示并退回大厅，绝不停在黑屏
      let ok = false;
      try {
        ok = game.start(cfg);
      } catch (err){
        console.error('[战局初始化失败]', err);
        hud.toast('战局初始化失败：' + (err?.message || String(err)), '#ff4757');
      }
      if (ok === false){ showScreen('lobby'); return; }
      // requestPointerLock 在现代浏览器返回 Promise，失败会产生 Unhandled Rejection
      try { const r = $('scene').requestPointerLock(); if (r?.catch) r.catch(()=>{}); } catch(e){}
      hud.toast('点击画面以锁定鼠标', '#ff9d2e');
    }
  }, 900);
}

/* 退出战斗 */
game.onExit = ()=>{ showScreen('lobby'); };

/* 调试句柄 */
window.__df = { hud, game, menu, showScreen };

/* 大厅背景音（低频环境） */
addEventListener('pointerdown', ()=>{ Audio2.resume(); }, { once:true });

/* 防止空格滚动 / F5 等 */
addEventListener('keydown', e=>{
  if (['Space','Tab','F1','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
});
