// Точка входу: ініціалізація DOM/канваси, збирання всіх доменів докупи й
// головний ігровий цикл (requestAnimationFrame). Логіка кожного кроку
// винесена в свій модуль — тут лише порядок виклику, що повторює
// послідовність з оригінального однофайлового прототипу.

import './style.css';
import { initView, view } from './render/context';
import { sizeCanvas, fitCamera, clampCam, zoomAt, camera } from './render/camera';
import { renderBuffer, isDirty, clearDirty, markDirty } from './render/buffer';
import { render } from './render/scene';
import { initWorld } from './sim/worldLifecycle';
import { clock, tickWind, advanceTimeOfDay, updateLighting } from './sim/clock';
import { TICK } from './world/constants';
import { simulate } from './sim/simulate';
import { updateClouds, weatherTick } from './sim/clouds';
import { updateEntities } from './sim/events';
import { updateParticles } from './sim/particles';
import { updateAnimals } from './creatures/ai';
import { creatureState } from './creatures/animal';
import { audioState } from './audio/engine';
import { audioTick, ambientSfx, animalVoices } from './audio/ambient';
import { initToast, showToast } from './ui/toast';
import { initHud, updateHud, savedWorldSize } from './ui/hud';
import { uiState } from './ui/state';
import { initTabs } from './ui/tabs';
import { initInput, continuousPaint } from './ui/input';
import { updateInspect } from './ui/inspect';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const wrap = document.getElementById('canvasWrap') as HTMLElement;

initView(canvas);
initToast(document.getElementById('toast')!);
initHud();
initTabs(document.getElementById('tabs')!, document.getElementById('toolbar')!, updateInspect);
initInput(canvas);

sizeCanvas(wrap);
uiState.worldSize = savedWorldSize();
initWorld(wrap.clientWidth, wrap.clientHeight, uiState.worldSize);
fitCamera();
zoomAt(view.canvas.width / 2, view.canvas.height / 2, camera.minZoom);

window.addEventListener('resize', () => {
  sizeCanvas(wrap);
  clampCam();
  if (camera.zoom < camera.minZoom) fitCamera();
});

const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
showToast(coarsePointer ? 'Два пальці — масштаб і рух' : 'Колесо — масштаб, права кнопка — рух', 4000);

let lastTick = 0, lastTs = 0;

function loop(ts: number): void {
  const dt = Math.min(100, ts - (lastTs || ts));
  lastTs = ts;

  if (!clock.paused) {
    if (ts - lastTick > TICK) {
      lastTick = ts;
      tickWind(ts);
      simulate();
      weatherTick();
      clock.frame++;
      markDirty();
    }
    advanceTimeOfDay(dt);
    updateClouds();
    updateEntities(clock.frame);
    updateAnimals();
    updateParticles();
  }
  updateLighting();

  continuousPaint(ts);

  if (isDirty()) { renderBuffer(clock.frame); clearDirty(); }
  render();

  if (audioState.AC) {
    if (creatureState.fc % 6 === 0) audioTick(ts);
    ambientSfx();
    animalVoices();
  }

  if ((clock.frame & 3) === 0) updateHud();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
