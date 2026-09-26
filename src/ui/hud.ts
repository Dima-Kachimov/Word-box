// Кнопки шапки (рух/пензель/день-ніч/звук/пауза/збереження/новий світ) та
// нижній HUD (час доби, вітер, кількість тварин).

import { clock } from '../sim/clock';
import { camera, zoomAt } from '../render/camera';
import { view } from '../render/context';
import { fitCamera } from '../render/camera';
import { regenerateWorld } from '../sim/worldLifecycle';
import { animals } from '../creatures/animal';
import { uiState } from './state';
import { initAudio, setSoundOn, audioState } from '../audio/engine';
import { updateInspect } from './inspect';
import { saveToLocalStorage, loadFromLocalStorage } from '../save/save';
import { showToast } from './toast';

let panBtn: HTMLButtonElement;
let dayBtn: HTMLButtonElement;
let pauseBtn: HTMLButtonElement;
let soundBtn: HTMLButtonElement;

export function setPanMode(on: boolean): void {
  uiState.panMode = on;
  if (panBtn) panBtn.classList.toggle('on', on);
}

/** Синхронізує вигляд кнопок шапки з поточним станом (потрібно після завантаження збереження). */
export function syncHeaderButtons(): void {
  if (dayBtn) dayBtn.classList.toggle('on', clock.dayCycle);
  if (pauseBtn) { pauseBtn.textContent = clock.paused ? '▶' : '❚❚'; pauseBtn.classList.toggle('on', clock.paused); }
  if (soundBtn) soundBtn.textContent = audioState.soundOn ? '🔊' : '🔇';
}

export function initHud(): void {
  panBtn = document.getElementById('panBtn') as HTMLButtonElement;
  panBtn.addEventListener('click', () => setPanMode(!uiState.panMode));

  const brushBtn = document.getElementById('brushBtn') as HTMLButtonElement;
  const SIZES: [number, string][] = [[2, 'S'], [3, 'M'], [5, 'L']];
  brushBtn.addEventListener('click', () => {
    const k = (SIZES.findIndex(s => s[0] === uiState.brushR) + 1) % SIZES.length;
    uiState.brushR = SIZES[k][0];
    brushBtn.textContent = SIZES[k][1];
  });

  dayBtn = document.getElementById('dayBtn') as HTMLButtonElement;
  dayBtn.addEventListener('click', () => {
    clock.dayCycle = !clock.dayCycle;
    dayBtn.classList.toggle('on', clock.dayCycle);
  });

  pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
  pauseBtn.addEventListener('click', () => {
    clock.paused = !clock.paused;
    pauseBtn.textContent = clock.paused ? '▶' : '❚❚';
    pauseBtn.classList.toggle('on', clock.paused);
  });

  document.getElementById('regenBtn')!.addEventListener('click', () => {
    regenerateWorld();
    fitCamera();
    zoomAt(view.canvas.width / 2, view.canvas.height / 2, camera.minZoom);
  });

  soundBtn = document.getElementById('soundBtn') as HTMLButtonElement;
  soundBtn.addEventListener('click', () => {
    initAudio();
    setSoundOn(!audioState.soundOn);
    soundBtn.textContent = audioState.soundOn ? '🔊' : '🔇';
  });
  window.addEventListener('pointerdown', initAudio, true);

  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
  saveBtn.addEventListener('click', () => {
    saveToLocalStorage();
    showToast('Світ збережено', 1400);
  });

  const loadBtn = document.getElementById('loadBtn') as HTMLButtonElement;
  loadBtn.addEventListener('click', () => {
    const ok = loadFromLocalStorage();
    showToast(ok ? 'Світ завантажено' : 'Немає збереження', 1400);
    if (ok) {
      fitCamera(); zoomAt(view.canvas.width / 2, view.canvas.height / 2, camera.minZoom);
      syncHeaderButtons();
    }
  });
}

const timeLbl = document.getElementById('timeLbl')!;
const windArrow = document.getElementById('windArrow')!;
const animalLbl = document.getElementById('animalLbl')!;

/** Оновлює текстові індикатори HUD — викликається раз на кілька кадрів. */
export function updateHud(): void {
  const mins = Math.floor(((12 + clock.tod * 24) % 24) * 60);
  timeLbl.textContent = (clock.dark > 0.25 ? '☾ ' : '☀ ') + String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  windArrow.style.transform = `rotate(${clock.windA}rad)`;
  let na = 0;
  for (const a of animals) if (a.S.key !== 'firefly') na++;
  animalLbl.textContent = '🐾 ' + na;
  updateInspect();
}
