// Звуковий рушій: увесь звук синтезується у браузері (Web Audio API), без
// зовнішніх аудіофайлів — так само, як в оригінальному прототипі.

export interface LoopNode {
  f: BiquadFilterNode;
  g: GainNode;
}

export const audioState = {
  AC: null as AudioContext | null,
  master: null as GainNode | null,
  echoIn: null as DelayNode | null,
  noiseBuf: null as AudioBuffer | null,
  soundOn: true
};

export const loops: Record<string, LoopNode> = {};

function mkLoop(type: BiquadFilterType, freq: number, q: number): LoopNode {
  const AC = audioState.AC!;
  const src = AC.createBufferSource();
  src.buffer = audioState.noiseBuf;
  src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = AC.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(audioState.master!);
  src.start();
  return { f, g };
}

export function initAudio(): void {
  if (audioState.AC) {
    if (audioState.AC.state === 'suspended') audioState.AC.resume();
    return;
  }
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const AC = new Ctor();
  audioState.AC = AC;
  const master = AC.createGain();
  master.gain.value = audioState.soundOn ? 0.7 : 0;
  master.connect(AC.destination);
  audioState.master = master;
  const echoIn = AC.createDelay(1);
  echoIn.delayTime.value = 0.3;
  audioState.echoIn = echoIn;
  const fb = AC.createGain(); fb.gain.value = 0.35;
  const wetG = AC.createGain(); wetG.gain.value = 0.45;
  echoIn.connect(fb); fb.connect(echoIn); echoIn.connect(wetG); wetG.connect(master);
  const noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  audioState.noiseBuf = noiseBuf;
  loops.ocean = mkLoop('lowpass', 420, 0.7);
  loops.wind = mkLoop('bandpass', 600, 0.9);
  loops.rain = mkLoop('highpass', 1800, 0.5);
  loops.fire = mkLoop('lowpass', 380, 0.8);
  loops.tornado = mkLoop('lowpass', 240, 1.4);
  loops.lava = mkLoop('lowpass', 130, 1);
}

export function setSoundOn(on: boolean): void {
  audioState.soundOn = on;
  if (audioState.master && audioState.AC) {
    audioState.master.gain.setTargetAtTime(on ? 0.7 : 0, audioState.AC.currentTime, 0.05);
  }
}

export function setLoop(l: LoopNode | undefined, v: number, freq?: number): void {
  if (!l || !audioState.AC) return;
  const t = audioState.AC.currentTime;
  l.g.gain.setTargetAtTime(v, t, 0.3);
  if (freq) l.f.frequency.setTargetAtTime(freq, t, 0.3);
}

export const canPlay = (): boolean => !!audioState.AC && audioState.soundOn && audioState.AC.state === 'running';

function envelope(g: GainNode, t: number, a: number, vol: number, dur: number): void {
  vol = Math.max(0.0002, vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, t + Math.max(a, dur * 0.55));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

export interface NoiseShotOpts {
  type?: BiquadFilterType;
  dur?: number;
  attack?: number;
  freq?: number;
  freqEnd?: number;
  q?: number;
  vol?: number;
  delay?: number;
}

export function noiseShot(o: NoiseShotOpts): void {
  if (!canPlay()) return;
  const AC = audioState.AC!;
  const t = AC.currentTime + (o.delay || 0), dur = o.dur || 0.4, a = o.attack || 0.01;
  const s = AC.createBufferSource(); s.buffer = audioState.noiseBuf;
  const f = AC.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 1;
  f.frequency.setValueAtTime(o.freq || 1000, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
  const g = AC.createGain(); envelope(g, t, a, o.vol || 0.2, dur);
  s.connect(f); f.connect(g); g.connect(audioState.master!);
  s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
}

export interface ToneOpts {
  type?: OscillatorType;
  freqs: [number, number][];
  dur: number;
  vol: number;
  attack?: number;
  vib?: number;
  vibDepth?: number;
  filter?: [BiquadFilterType, number, number];
  am?: number;
  echo?: boolean;
  delay?: number;
}

export function tone(o: ToneOpts): void {
  if (!canPlay()) return;
  const AC = audioState.AC!;
  const t = AC.currentTime + (o.delay || 0), dur = o.dur, a = o.attack || 0.02;
  const osc = AC.createOscillator(); osc.type = o.type || 'sine';
  o.freqs.forEach(([tt, fr], k) => {
    if (k) osc.frequency.linearRampToValueAtTime(fr, t + tt);
    else osc.frequency.setValueAtTime(fr, t);
  });
  let node: AudioNode = osc;
  const extra: OscillatorNode[] = [];
  if (o.vib) {
    const l = AC.createOscillator(); l.frequency.value = o.vib;
    const lg = AC.createGain(); lg.gain.value = o.vibDepth || 10;
    l.connect(lg); lg.connect(osc.frequency); extra.push(l);
  }
  if (o.filter) {
    const f = AC.createBiquadFilter();
    f.type = o.filter[0]; f.frequency.value = o.filter[1]; f.Q.value = o.filter[2];
    node.connect(f); node = f;
  }
  const g = AC.createGain(); envelope(g, t, a, o.vol, dur); node.connect(g);
  let out: AudioNode = g;
  if (o.am) {
    const am = AC.createGain(); am.gain.value = 0.5;
    const l = AC.createOscillator(); l.frequency.value = o.am;
    const lg = AC.createGain(); lg.gain.value = 0.5;
    l.connect(lg); lg.connect(am.gain); extra.push(l);
    g.connect(am); out = am;
  }
  out.connect(audioState.master!);
  if (o.echo) out.connect(audioState.echoIn!);
  osc.start(t); osc.stop(t + dur + 0.1);
  extra.forEach(l => { l.start(t); l.stop(t + dur + 0.1); });
}
