import type { ScaleAdapter } from '../interfaces/scale-adapter.js';
import { RenphoScaleAdapter } from './renpho.js';
import { StandardGattScaleAdapter } from './standard-gatt.js';
import { MiScale2Adapter } from './mi-scale-2.js';
import { YunmaiScaleAdapter } from './yunmai.js';

export const adapters: ScaleAdapter[] = [
  // Specific adapters first — they match by device name before the generic one
  new RenphoScaleAdapter(),
  new MiScale2Adapter(),
  new YunmaiScaleAdapter(),
  // Generic standard GATT adapter last — matches by service UUID / brand names
  new StandardGattScaleAdapter(),
];
