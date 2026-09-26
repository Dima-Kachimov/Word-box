// Стан інтерфейсу гравця: активний інструмент, розмір пензля, вкладка,
// режим вводу, позиція курсора. Навмисно без залежностей від інших доменів
// (щоб render/scene.ts міг читати uiState.tool/cursor, не створюючи циклів
// імпортів з ui/input.ts, який сам залежить від камери й тулів).

export type InputMode = 'idle' | 'paint' | 'pan' | 'pinch';

export interface ScreenPoint { x: number; y: number; }

export const uiState = {
  tool: 'rain',
  brushR: 3,
  tab: 'weather',
  mode: 'idle' as InputMode,
  panMode: false,
  painting: false,
  cursor: null as ScreenPoint | null,
  lastPos: null as ScreenPoint | null,
  lastShot: 0
};
