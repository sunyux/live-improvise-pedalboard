// Reusable knob/footswitch/demo-panel/keyboard UI, wired to a pedal-engine.js
// instance. Mount into any container: mountPedalboard(el, {keys, onNoteOn, onNoteOff}).
// Expects the host page's stylesheet to define .board/.pedal/.knob/.footswitch/
// .demo-panel/.keyboard/.key/.action-btn/.status (see index.html's <style> block
// for the canonical rules — same class names, copy them into any new page).

import { createPedalEngine } from './pedal-engine.js';

export const DEFAULT_KEYS=[
  {key:'a',freq:261.63},{key:'w',freq:277.18},{key:'s',freq:293.66},{key:'e',freq:311.13},{key:'d',freq:329.63},
  {key:'f',freq:349.23},{key:'t',freq:369.99},{key:'g',freq:392.00},{key:'y',freq:415.30},{key:'h',freq:440.00},
  {key:'u',freq:466.16},{key:'j',freq:493.88},{key:'k',freq:523.25},{key:'o',freq:554.37},{key:'l',freq:587.33}
];

function buildMarkup(keys){
  const keyDivs=keys.map(k=>`<div class="key" data-key="${k.key}">${k.key.toUpperCase()}</div>`).join('');
  return `
    <div class="transport-mini">
      <button class="action-btn primary" data-role="engine-btn">启动音频引擎</button>
      <span class="status" data-role="engine-status">音频引擎未启动</span>
    </div>
    <div class="board">
      <div class="pedal" data-pedal="drive">
        <h3>Overdrive</h3>
        <div class="knob-row">
          <div class="knob-unit">
            <div class="knob" data-param="drive" data-value="0.3"><div class="indicator"></div></div>
            <div class="knob-label">Drive</div>
          </div>
        </div>
        <div class="footswitch"></div>
        <div class="pedal-state">Bypass</div>
      </div>
      <div class="pedal" data-pedal="delay">
        <h3>Delay</h3>
        <div class="knob-row">
          <div class="knob-unit"><div class="knob" data-param="time" data-value="0.35"><div class="indicator"></div></div><div class="knob-label">Time</div></div>
          <div class="knob-unit"><div class="knob" data-param="feedback" data-value="0.35"><div class="indicator"></div></div><div class="knob-label">Feedback</div></div>
        </div>
        <div class="footswitch"></div>
        <div class="pedal-state">Bypass</div>
      </div>
      <div class="pedal" data-pedal="reverb">
        <h3>Reverb</h3>
        <div class="knob-row">
          <div class="knob-unit"><div class="knob" data-param="decay" data-value="0.5"><div class="indicator"></div></div><div class="knob-label">Decay</div></div>
          <div class="knob-unit"><div class="knob" data-param="mix" data-value="0.4"><div class="indicator"></div></div><div class="knob-label">Mix</div></div>
        </div>
        <div class="footswitch"></div>
        <div class="pedal-state">Bypass</div>
      </div>
    </div>
    <div class="demo-panel">
      <h2>内置示范声音</h2>
      <p class="demo-hint">还没接乐器?先点一下"启动音频引擎",再用下面这些按钮或键盘弹出声音,一样会过效果器链条。</p>
      <div class="demo-buttons">
        <button class="action-btn" data-demo="ufo" disabled>飞碟音效 UFO</button>
        <button class="action-btn" data-demo="noise" disabled>噪音脉冲 Noise</button>
        <button class="action-btn" data-demo="alert" disabled>提示音 Notice</button>
        <button class="action-btn" data-demo="drone" disabled>持续音垫 Drone</button>
        <button class="action-btn" data-demo="water" disabled>流水声 Water</button>
        <button class="action-btn" data-demo="guitar" disabled>吉他扫弦 Guitar Strum</button>
      </div>
      <p class="demo-hint">电脑键盘演奏(像弹钢琴一样,按住不放会持续发声,可切换不同乐器音色,像多种乐器一起演奏):</p>
      <div class="keyboard" data-role="keyboard">${keyDivs}</div>
      <div style="margin-top:12px;">
        <button class="action-btn" data-role="timbre-btn">键盘音色: 合成 Synth</button>
      </div>
    </div>
  `;
}

export function mountPedalboard(root, options={}){
  const keys=options.keys || DEFAULT_KEYS;
  const onNoteOn=options.onNoteOn || (()=>{});
  const onNoteOff=options.onNoteOff || (()=>{});

  root.innerHTML=buildMarkup(keys);

  // Mirrors the `timbres` registry in pedal-engine.js (labels only — the
  // actual synthesis lives entirely in the engine, not duplicated here).
  const TIMBRES=[
    {key:'synth',label:'合成 Synth'},
    {key:'marimba',label:'马林巴 Marimba'},
    {key:'horn',label:'圆号 Horn'},
    {key:'flute',label:'长笛 Flute'},
    {key:'harp',label:'竖琴 Harp'},
    {key:'guitar',label:'吉他 Guitar'}
  ];
  let engine=null, audioCtx=null, timbreIndex=0;
  const activeNotes={};

  const engineBtn=root.querySelector('[data-role=engine-btn]');
  const engineStatus=root.querySelector('[data-role=engine-status]');
  const demoButtons=[...root.querySelectorAll('[data-demo]')];
  const timbreBtn=root.querySelector('[data-role=timbre-btn]');
  const keyboardEl=root.querySelector('[data-role=keyboard]');

  function flash(btn, ms){ btn.classList.add('playing'); setTimeout(()=>btn.classList.remove('playing'), ms); }

  function startEngine(){
    if(audioCtx) return;
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    engine=createPedalEngine(audioCtx);
    engineStatus.textContent='音频引擎已启动';
    engineBtn.disabled=true;
    engineBtn.textContent='引擎运行中 Running';
    demoButtons.forEach(b=>b.disabled=false);
  }
  engineBtn.addEventListener('click', startEngine);

  root.querySelectorAll('.knob').forEach(knob=>{
    let dragging=false, startY=0, startVal=0;
    const setVisual=(val)=>{
      const deg=-135+val*270;
      knob.querySelector('.indicator').style.transform=`translateX(-50%) rotate(${deg}deg)`;
    };
    setVisual(parseFloat(knob.dataset.value));
    knob.addEventListener('pointerdown', e=>{
      dragging=true; startY=e.clientY; startVal=parseFloat(knob.dataset.value);
      knob.setPointerCapture(e.pointerId);
    });
    knob.addEventListener('pointermove', e=>{
      if(!dragging) return;
      let val=startVal + (startY-e.clientY)/120;
      val=Math.max(0,Math.min(1,val));
      knob.dataset.value=val;
      setVisual(val);
      if(engine) engine.setParam(knob.closest('.pedal').dataset.pedal, knob.dataset.param, val);
    });
    ['pointerup','pointercancel'].forEach(ev=>knob.addEventListener(ev, ()=>dragging=false));
  });

  root.querySelectorAll('.pedal').forEach(p=>{
    const sw=p.querySelector('.footswitch');
    const stateEl=p.querySelector('.pedal-state');
    let on=false;
    sw.addEventListener('click', ()=>{
      on=!on;
      p.classList.toggle('on', on);
      stateEl.textContent=on?'Engaged':'Bypass';
      if(engine) engine.setBypass(p.dataset.pedal, on);
    });
  });

  demoButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!engine) return;
      const demo=btn.dataset.demo;
      if(demo==='ufo') flash(btn, engine.playUFO());
      else if(demo==='noise') flash(btn, engine.playNoiseBurst());
      else if(demo==='alert') flash(btn, engine.playAlert());
      else if(demo==='water') flash(btn, engine.playWater());
      else if(demo==='guitar') flash(btn, engine.playGuitarDemo());
      else if(demo==='drone'){
        const active=engine.toggleDrone();
        btn.classList.toggle('playing', active);
        btn.textContent=active?'停止音垫':'持续音垫 Drone';
      }
    });
  });

  timbreBtn.addEventListener('click', ()=>{
    timbreIndex=(timbreIndex+1)%TIMBRES.length;
    timbreBtn.textContent='键盘音色: '+TIMBRES[timbreIndex].label;
  });

  function noteOn(key){
    if(!engine) return;
    const entry=keys.find(k=>k.key===key);
    if(!entry) return;
    const timbre=engine.timbres[TIMBRES[timbreIndex].key];
    const keyEl=keyboardEl.querySelector(`[data-key="${key}"]`);
    if(timbre.mode==='oneshot'){
      timbre.play(entry.freq, 0.5);
      if(keyEl){ keyEl.classList.add('active'); setTimeout(()=>keyEl.classList.remove('active'),400); }
      onNoteOn(key, entry.freq);
      return;
    }
    if(activeNotes[key]) return;
    // remember which timbre started this note, so a mid-hold timbre switch
    // can't strand the voice (noteOff must stop it with the same synth fn)
    activeNotes[key]={voice:timbre.noteOn(entry.freq), timbreKey:TIMBRES[timbreIndex].key};
    if(keyEl) keyEl.classList.add('active');
    onNoteOn(key, entry.freq);
  }
  function noteOff(key){
    if(!engine) return;
    const held=activeNotes[key];
    if(!held) return;
    engine.timbres[held.timbreKey].noteOff(held.voice);
    delete activeNotes[key];
    const keyEl=keyboardEl.querySelector(`[data-key="${key}"]`);
    if(keyEl) keyEl.classList.remove('active');
    onNoteOff(key);
  }

  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(keys.some(o=>o.key===k) && !e.repeat) noteOn(k);
  });
  window.addEventListener('keyup', e=>{
    const k=e.key.toLowerCase();
    if(keys.some(o=>o.key===k)) noteOff(k);
  });
  keyboardEl.querySelectorAll('.key').forEach(div=>{
    div.addEventListener('pointerdown', ()=>noteOn(div.dataset.key));
    ['pointerup','pointerleave'].forEach(ev=>div.addEventListener(ev, ()=>noteOff(div.dataset.key)));
  });

  return { startEngine, noteOn, noteOff, getEngine:()=>engine };
}
