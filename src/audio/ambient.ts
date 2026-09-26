// Фонові й випадкові звуки: голоси тварин, потріскування вогню/лави,
// цвіркуни/пташки, і петльові звуки (океан/вітер/дощ/вогонь/смерч/лава),
// гучність яких залежить від того, скільки відповідних об'єктів у кадрі.

import { rnd, clamp } from '../world/noise';
import { clock } from '../sim/clock';
import { weatherCounters } from '../sim/particles';
import { weatherStats } from '../render/buffer';
import { camera, visibleTile } from '../render/camera';
import { tornados } from '../sim/events';
import { animals, creatureState } from '../creatures/animal';
import { canPlay, loops, setLoop, audioState } from './engine';
import { SFX } from './sfx';

export function animalVoices(): void {
  if (!canPlay() || --creatureState.voiceCd > 0) return;
  for (let tries = 0; tries < 8; tries++) {
    const a = animals[(rnd() * animals.length) | 0];
    if (!a) return;
    const S = a.S;
    if (!S.voice || a.dead || a.state === 'sleep' || a.state === 'rest') continue;
    if (S.key === 'wolf' && clock.dark < 0.3) continue;
    if (S.key === 'frog' && clock.dark < 0.15) continue;
    if ((S.key === 'bird' || S.key === 'gull' || S.key === 'eagle') && clock.dark > 0.3) continue;
    if (!visibleTile(a.x, a.y)) continue;
    (SFX[S.voice] as (v: number) => void)(clamp(camera.zoom / camera.fitZ / 2.5, 0.35, 1));
    creatureState.voiceCd = 50 + rnd() * 90;
    return;
  }
  creatureState.voiceCd = 20;
}

export function ambientSfx(): void {
  if (!canPlay() || clock.paused) return;
  if (weatherStats.visFire > 0 && rnd() < Math.min(0.5, weatherStats.visFire / 25)) SFX.crackle(0.04 + rnd() * 0.08);
  if (weatherStats.visLava > 0 && rnd() < Math.min(0.08, weatherStats.visLava / 150)) SFX.blup();
  if (clock.dark > 0.35 && rnd() < 0.025) SFX.cricket();
  if (clock.dark < 0.15 && rnd() < 0.004) SFX.tweet(0.5);
}

export function audioTick(ts: number): void {
  if (!audioState.AC) return;
  let visTor = 0;
  for (const t of tornados) if (visibleTile(t.x, t.y)) visTor++;
  const on = clock.paused ? 0 : 1;
  setLoop(loops.ocean, on * (0.05 + 0.035 * Math.sin(ts / 2600)));
  setLoop(loops.wind, on * (0.015 + 0.06 * clock.windS * (1 - clock.dark * 0.5)), 350 + 450 * clock.windS);
  setLoop(loops.rain, on * Math.min(0.32, weatherCounters.rainCount / 220));
  setLoop(loops.fire, on * Math.min(0.4, weatherStats.visFire / 35));
  setLoop(loops.tornado, on * Math.min(0.45, visTor * 0.3));
  setLoop(loops.lava, on * Math.min(0.35, weatherStats.visLava / 30));
}
