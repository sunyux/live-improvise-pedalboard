// Reusable Web Audio effects chain: Overdrive -> Delay -> Reverb -> master.
// Framework-free ES module. Connect any source to engine.inputGain to run it
// through the chain. Extracted from index.html's buildGraph() so the tuned
// parameters (drive curve steepness, makeup gains, mix ratios) live in one
// place instead of being copy-pasted per page.

export function createDistortionCurve(amount){
  const k=amount*400, n=44100, curve=new Float32Array(n);
  for(let i=0;i<n;i++){
    const x=i*2/n-1;
    curve[i]=(3+k)*x*20*(Math.PI/180)/(Math.PI+k*Math.abs(x));
  }
  return curve;
}

export function createImpulse(ctx, decaySeconds){
  const rate=ctx.sampleRate;
  const len=Math.max(1, Math.floor(rate*decaySeconds*3));
  const impulse=ctx.createBuffer(2, len, rate);
  for(let c=0;c<2;c++){
    const data=impulse.getChannelData(c);
    for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/len, 3);
  }
  return impulse;
}

export function createPedalEngine(audioCtx){
  const pedalState={
    drive:{on:false, drive:0.3},
    delay:{on:false, time:0.35, feedback:0.35},
    reverb:{on:false, decay:0.5, mix:0.4}
  };

  const inputGain=audioCtx.createGain();
  const masterGain=audioCtx.createGain();
  masterGain.gain.value=0.9;

  const driveShaper=audioCtx.createWaveShaper();
  driveShaper.curve=createDistortionCurve(pedalState.drive.drive);
  driveShaper.oversample='4x';
  const driveMakeup=audioCtx.createGain();
  driveMakeup.gain.value=2.2; // the shaping curve attenuates level; compensate so drive reads as louder/grittier
  const driveDry=audioCtx.createGain(), driveWet=audioCtx.createGain();
  driveDry.gain.value=1; driveWet.gain.value=0;

  const delayNode=audioCtx.createDelay(2.0);
  delayNode.delayTime.value=pedalState.delay.time;
  const feedbackGain=audioCtx.createGain();
  feedbackGain.gain.value=pedalState.delay.feedback*0.85;
  const delayDry=audioCtx.createGain(), delayWet=audioCtx.createGain();
  delayDry.gain.value=1; delayWet.gain.value=0;

  const convolver=audioCtx.createConvolver();
  convolver.buffer=createImpulse(audioCtx, pedalState.reverb.decay*2+0.2);
  const reverbMakeup=audioCtx.createGain();
  reverbMakeup.gain.value=1.7; // noise-based IR tail is naturally quiet; compensate
  const reverbDry=audioCtx.createGain(), reverbWet=audioCtx.createGain();
  reverbDry.gain.value=1; reverbWet.gain.value=0;

  inputGain.connect(driveDry); inputGain.connect(driveShaper);
  driveShaper.connect(driveMakeup); driveMakeup.connect(driveWet);
  const afterDrive=audioCtx.createGain();
  driveDry.connect(afterDrive); driveWet.connect(afterDrive);

  afterDrive.connect(delayDry);
  afterDrive.connect(delayNode);
  delayNode.connect(feedbackGain); feedbackGain.connect(delayNode);
  delayNode.connect(delayWet);
  const afterDelay=audioCtx.createGain();
  delayDry.connect(afterDelay); delayWet.connect(afterDelay);

  afterDelay.connect(reverbDry);
  afterDelay.connect(convolver);
  convolver.connect(reverbMakeup); reverbMakeup.connect(reverbWet);
  const afterReverb=audioCtx.createGain();
  reverbDry.connect(afterReverb); reverbWet.connect(afterReverb);

  afterReverb.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  const analyser=audioCtx.createAnalyser();
  analyser.fftSize=2048;
  masterGain.connect(analyser);

  function applyBypass(){
    const t=audioCtx.currentTime, ramp=0.03;
    driveDry.gain.linearRampToValueAtTime(pedalState.drive.on?0:1, t+ramp);
    driveWet.gain.linearRampToValueAtTime(pedalState.drive.on?1:0, t+ramp);
    delayDry.gain.linearRampToValueAtTime(pedalState.delay.on?0.5:1, t+ramp);
    delayWet.gain.linearRampToValueAtTime(pedalState.delay.on?0.85:0, t+ramp);
    reverbDry.gain.linearRampToValueAtTime(pedalState.reverb.on?(1-pedalState.reverb.mix):1, t+ramp);
    reverbWet.gain.linearRampToValueAtTime(pedalState.reverb.on?pedalState.reverb.mix:0, t+ramp);
  }

  function applyParams(){
    driveShaper.curve=createDistortionCurve(pedalState.drive.drive);
    delayNode.delayTime.setTargetAtTime(pedalState.delay.time, audioCtx.currentTime, 0.02);
    feedbackGain.gain.setTargetAtTime(pedalState.delay.feedback*0.85, audioCtx.currentTime, 0.02);
    convolver.buffer=createImpulse(audioCtx, pedalState.reverb.decay*2+0.2);
    applyBypass();
  }

  applyBypass();

  let droneVoice=null;

  function playGuitarPluck(freq, gain){
    const now=audioCtx.currentTime;
    const sampleRate=audioCtx.sampleRate;
    const period=1/freq;
    const bufferSize=Math.max(2, Math.ceil(sampleRate*period));
    const buffer=audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=Math.random()*2-1;
    const noise=audioCtx.createBufferSource(); noise.buffer=buffer;
    const delay=audioCtx.createDelay(1); delay.delayTime.value=period;
    const damping=audioCtx.createBiquadFilter(); damping.type='lowpass'; damping.frequency.value=4500;
    const feedback=audioCtx.createGain(); feedback.gain.value=0.98;
    const outGain=audioCtx.createGain(); outGain.gain.value=gain!==undefined?gain:0.5;
    noise.connect(delay); delay.connect(damping); damping.connect(feedback); feedback.connect(delay);
    damping.connect(outGain); outGain.connect(inputGain);
    noise.start(now); noise.stop(now+period);
    setTimeout(()=>{ try{ delay.disconnect(); damping.disconnect(); feedback.disconnect(); outGain.disconnect(); }catch(e){} }, 3500);
  }

  function playGuitarDemo(){
    const strings=[82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
    strings.forEach((f,i)=>{ setTimeout(()=>playGuitarPluck(f, 0.45), i*90); });
    return strings.length*90+600;
  }

  function playUFO(){
    const now=audioCtx.currentTime, dur=3.2;
    const osc=audioCtx.createOscillator(); osc.type='sine';
    const vibrato=audioCtx.createOscillator(); vibrato.type='sine'; vibrato.frequency.value=6;
    const vibratoGain=audioCtx.createGain(); vibratoGain.gain.value=40;
    const env=audioCtx.createGain(); env.gain.value=0;
    vibrato.connect(vibratoGain); vibratoGain.connect(osc.frequency);
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(880, now+dur*0.5);
    osc.frequency.linearRampToValueAtTime(160, now+dur);
    osc.connect(env); env.connect(inputGain);
    env.gain.linearRampToValueAtTime(0.35, now+0.1);
    env.gain.linearRampToValueAtTime(0, now+dur);
    osc.start(now); vibrato.start(now);
    osc.stop(now+dur); vibrato.stop(now+dur);
    return dur*1000;
  }

  function playNoiseBurst(){
    const now=audioCtx.currentTime, dur=0.8;
    const bufferSize=audioCtx.sampleRate*dur;
    const buffer=audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=Math.random()*2-1;
    const noise=audioCtx.createBufferSource(); noise.buffer=buffer;
    const filter=audioCtx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=1200; filter.Q.value=0.7;
    const env=audioCtx.createGain(); env.gain.value=0;
    noise.connect(filter); filter.connect(env); env.connect(inputGain);
    env.gain.linearRampToValueAtTime(0.4, now+0.02);
    env.gain.exponentialRampToValueAtTime(0.001, now+dur);
    noise.start(now); noise.stop(now+dur);
    return dur*1000;
  }

  function playAlert(){
    const now=audioCtx.currentTime;
    const notes=[880, 660];
    notes.forEach((freq,i)=>{
      const t=now+i*0.18;
      const osc=audioCtx.createOscillator(); osc.type='square'; osc.frequency.value=freq;
      const env=audioCtx.createGain(); env.gain.value=0;
      osc.connect(env); env.connect(inputGain);
      env.gain.linearRampToValueAtTime(0.2, t+0.02);
      env.gain.linearRampToValueAtTime(0, t+0.15);
      osc.start(t); osc.stop(t+0.16);
    });
    return 400;
  }

  function toggleDrone(){
    if(droneVoice){
      const now=audioCtx.currentTime;
      droneVoice.env.gain.linearRampToValueAtTime(0, now+0.6);
      droneVoice.osc1.stop(now+0.7); droneVoice.osc2.stop(now+0.7);
      droneVoice=null;
      return false;
    }
    const now=audioCtx.currentTime;
    const osc1=audioCtx.createOscillator(); osc1.type='sawtooth'; osc1.frequency.value=110;
    const osc2=audioCtx.createOscillator(); osc2.type='sawtooth'; osc2.frequency.value=110*1.005;
    const filter=audioCtx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=800;
    const env=audioCtx.createGain(); env.gain.value=0;
    osc1.connect(filter); osc2.connect(filter); filter.connect(env); env.connect(inputGain);
    env.gain.linearRampToValueAtTime(0.15, now+1.2);
    osc1.start(now); osc2.start(now);
    droneVoice={osc1, osc2, env};
    return true;
  }

  function noteOn(freq){
    const osc=audioCtx.createOscillator(); osc.type='triangle'; osc.frequency.value=freq;
    const env=audioCtx.createGain(); env.gain.value=0;
    osc.connect(env); env.connect(inputGain);
    const now=audioCtx.currentTime;
    env.gain.linearRampToValueAtTime(0.3, now+0.03);
    osc.start(now);
    return {osc, env};
  }
  function noteOff(voice){
    if(!voice) return;
    const now=audioCtx.currentTime;
    voice.env.gain.linearRampToValueAtTime(0, now+0.08);
    voice.osc.stop(now+0.1);
  }

  return {
    audioCtx, inputGain, masterGain, analyser, pedalState,
    setParam(pedal, param, value){ pedalState[pedal][param]=value; applyParams(); },
    setBypass(pedal, on){ pedalState[pedal].on=on; applyBypass(); },
    playGuitarPluck, playGuitarDemo, playUFO, playNoiseBurst, playAlert, toggleDrone,
    noteOn, noteOff,
    get droneActive(){ return !!droneVoice; }
  };
}
