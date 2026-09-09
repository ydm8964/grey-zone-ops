/* ============================================================
   音效系统：WebAudio 实时合成（无外部素材依赖）
============================================================ */
class AudioSys {
  constructor(){
    this.ctx = null; this.enabled = true; this.master = null;
    this.volume = 0.6; this.noiseBuf = null;
  }
  init(){
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    // 总线压缩，避免爆音
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 12; comp.attack.value = .003; comp.release.value = .18;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this._noise();
  }
  resume(){ if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  _noise(){
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    this.noiseBuf = buf;
  }
  _env(node, t0, a, d, peak=1){
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0+a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+a+d);
    node.connect(g); g.connect(this.master);
    return g;
  }
  _src(buf, rate=1){ const s=this.ctx.createBufferSource(); s.buffer=buf; s.playbackRate.value=rate; return s; }
  _lp(f){ const f2=this.ctx.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=f; return f2; }
  /* 播放结束后断开自身与链路：高射速下每秒上百节点，仅 stop 会让中间节点长期挂在 master 上 */
  _auto(src, ...chain){
    try { src.onended = ()=>{ src.disconnect(); chain.forEach(c => c && c.disconnect()); }; } catch(e){}
  }
  _hp(f){ const f2=this.ctx.createBiquadFilter(); f2.type='highpass'; f2.frequency.value=f; return f2; }

  // 枪声：低频砰 + 中频爆 + 高频噪尾
  shot(cal='rifle', dist=0){
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + (dist*0.011);
    const cfg = { rifle:{p:180,t:.09,n:.16,amp:.55,lp:5200}, pistol:{p:260,t:.07,n:.12,amp:.45,lp:6400},
                  smg:{p:230,t:.06,n:.11,amp:.40,lp:6000}, sniper:{p:110,t:.20,n:.36,amp:.85,lp:4200},
                  shotgun:{p:95,t:.16,n:.30,amp:.75,lp:3400} }[cal] || {p:180,t:.09,n:.16,amp:.5,lp:5200};
    const amp = cfg.amp * Math.pow(0.42, Math.min(dist,6));

    // 低频冲击
    const o1 = this.ctx.createOscillator(); o1.type='sine';
    o1.frequency.setValueAtTime(cfg.p*2.2, t);
    o1.frequency.exponentialRampToValueAtTime(cfg.p*0.55, t+cfg.t);
    const g1 = this._env(o1, t, .002, cfg.t, amp); o1.start(t); o1.stop(t+cfg.t+.05);
    this._auto(o1, g1);

    // 中频爆音
    const o2 = this.ctx.createOscillator(); o2.type='square';
    o2.frequency.setValueAtTime(cfg.p*4, t);
    o2.frequency.exponentialRampToValueAtTime(cfg.p, t+.03);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(amp*.35, t);
    g2.gain.exponentialRampToValueAtTime(.0001, t+.045);
    const lp2 = this._lp(1800);
    o2.connect(lp2); lp2.connect(g2); g2.connect(this.master);
    o2.start(t); o2.stop(t+.1);
    this._auto(o2, lp2, g2);

    // 噪声尾（距离感：低通 + 混响式衰减）
    const n = this._src(this.noiseBuf, .8 + Math.random()*.4);
    const nf = this._lp(cfg.lp * Math.pow(.55, Math.min(dist,5)));
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(amp*.9, t);
    ng.gain.exponentialRampToValueAtTime(.0001, t+cfg.n + dist*.14);
    n.connect(nf); nf.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t+cfg.n+dist*.2+.1);
    this._auto(n, nf, ng);
  }
  reload(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    [ [0,320,.04], [.09,220,.05], [.22,540,.04] ].forEach(([dt,f,d])=>{
      const o=this.ctx.createOscillator(); o.type='square'; o.frequency.value=f;
      const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,t+dt);
      g.gain.exponentialRampToValueAtTime(.12,t+dt+.004); g.gain.exponentialRampToValueAtTime(.0001,t+dt+d);
      o.connect(g); g.connect(this.master); o.start(t+dt); o.stop(t+dt+d+.02);
    });
  }
  dryFire(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const n=this._src(this.noiseBuf,2); const hp=this._hp(2600); const g=this.ctx.createGain();
    g.gain.setValueAtTime(.22,t); g.gain.exponentialRampToValueAtTime(.0001,t+.05);
    n.connect(hp); hp.connect(g); g.connect(this.master); n.start(t); n.stop(t+.07);
  }
  hit(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(1500,t);
    o.frequency.exponentialRampToValueAtTime(760,t+.05);
    const g=this.ctx.createGain(); g.gain.setValueAtTime(.22,t); g.gain.exponentialRampToValueAtTime(.0001,t+.06);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+.08);
  }
  headshot(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(2400,t);
    o.frequency.exponentialRampToValueAtTime(1200,t+.09);
    const g=this.ctx.createGain(); g.gain.setValueAtTime(.3,t); g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+.14); this.hit();
  }
  kill(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    [880,1320,1760].forEach((f,i)=>{ const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.value=f;
      const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,t+i*.05);
      g.gain.exponentialRampToValueAtTime(.2,t+i*.05+.01); g.gain.exponentialRampToValueAtTime(.0001,t+i*.05+.14);
      o.connect(g); g.connect(this.master); o.start(t+i*.05); o.stop(t+i*.05+.16); });
  }
  pain(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const n=this._src(this.noiseBuf,.5); const f=this._lp(700); const g=this.ctx.createGain();
    g.gain.setValueAtTime(.3,t); g.gain.exponentialRampToValueAtTime(.0001,t+.45);
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t); n.stop(t+.5);
  }
  pickup(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    [620,930].forEach((f,i)=>{ const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.value=f;
      const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,t+i*.06);
      g.gain.exponentialRampToValueAtTime(.16,t+i*.06+.008); g.gain.exponentialRampToValueAtTime(.0001,t+i*.06+.11);
      o.connect(g); g.connect(this.master); o.start(t+i*.06); o.stop(t+i*.06+.13); });
  }
  heal(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(300,t);
    o.frequency.exponentialRampToValueAtTime(900,t+.5);
    const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.13,t+.1); g.gain.exponentialRampToValueAtTime(.0001,t+.6);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+.65);
  }
  footstep(run){
    if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const n=this._src(this.noiseBuf, run?1.1:.75);
    const f=this._lp(run?900:620); const g=this.ctx.createGain();
    g.gain.setValueAtTime(run?.11:.06, t); g.gain.exponentialRampToValueAtTime(.0001, t+(run?.13:.16));
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t); n.stop(t+.2);
  }
  explosion(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const n=this._src(this.noiseBuf,.35); const f=this._lp(1100); const g=this.ctx.createGain();
    g.gain.setValueAtTime(.85,t); g.gain.exponentialRampToValueAtTime(.0001,t+1.1);
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t); n.stop(t+1.2);
    const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(90,t);
    o.frequency.exponentialRampToValueAtTime(30,t+.7);
    const g2=this.ctx.createGain(); g2.gain.setValueAtTime(.7,t); g2.gain.exponentialRampToValueAtTime(.0001,t+.8);
    o.connect(g2); g2.connect(this.master); o.start(t); o.stop(t+.85);
  }
  ui(kind='click'){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    const f = {click:520, hover:760, back:340, confirm:660, error:180}[kind] || 520;
    const o=this.ctx.createOscillator(); o.type='square'; o.frequency.value=f;
    const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.07,t+.004); g.gain.exponentialRampToValueAtTime(.0001,t+.07);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+.09);
  }
  alarm(){ if(!this.ctx||!this.enabled) return; const t=this.ctx.currentTime;
    for(let i=0;i<3;i++){ const o=this.ctx.createOscillator(); o.type='sawtooth';
      o.frequency.setValueAtTime(440,t+i*.22); o.frequency.linearRampToValueAtTime(660,t+i*.22+.16);
      const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,t+i*.22);
      g.gain.exponentialRampToValueAtTime(.1,t+i*.22+.02); g.gain.exponentialRampToValueAtTime(.0001,t+i*.22+.2);
      o.connect(g); g.connect(this.master); o.start(t+i*.22); o.stop(t+i*.22+.22); }
  }
  setVolume(v){ this.volume=v; if(this.master) this.master.gain.value=v; }
  toggle(){ this.enabled=!this.enabled; if(!this.enabled&&this.ctx) this.master.gain.value=0;
    else if(this.master) this.master.gain.value=this.volume; return this.enabled; }
}
export const Audio2 = new AudioSys();
