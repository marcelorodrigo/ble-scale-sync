import type { ScaleAdapter } from '../interfaces/scale-adapter.js';
import { RenphoScaleAdapter } from './renpho.js';

export const adapters: ScaleAdapter[] = [
  new RenphoScaleAdapter(),
];
