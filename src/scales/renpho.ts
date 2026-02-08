import type { Peripheral } from '@abandonware/noble';
import { RenphoCalculator } from '../calculator.js';
import type {
  ScaleAdapter,
  ScaleReading,
  UserProfile,
  GarminPayload,
} from '../interfaces/scale-adapter.js';

const KNOWN_NAMES: string[] = ['qn-scale', 'renpho', 'senssun', 'sencor'];

export class RenphoScaleAdapter implements ScaleAdapter {
  readonly name = 'Renpho';
  readonly charNotifyUuid = '0000fff100001000800000805f9b34fb';
  readonly charWriteUuid  = '0000fff200001000800000805f9b34fb';
  readonly unlockCommand  = [0x13, 0x09, 0x00, 0x01, 0x01, 0x02];
  readonly unlockIntervalMs = 2000;

  matches(peripheral: Peripheral): boolean {
    const name: string = (peripheral.advertisement.localName || '').toLowerCase();
    return KNOWN_NAMES.some((p) => name.includes(p));
  }

  parseNotification(data: Buffer): ScaleReading | null {
    if (data[0] !== 0x10 || data.length < 10) return null;

    const rawWeight: number = (data[3] << 8) + data[4];
    const rawImpedance: number = (data[8] << 8) + data[9];

    if (Number.isNaN(rawWeight) || Number.isNaN(rawImpedance)) return null;

    return {
      weight: rawWeight / 100.0,
      impedance: rawImpedance,
    };
  }

  isComplete(reading: ScaleReading): boolean {
    return reading.weight > 10.0 && reading.impedance > 200;
  }

  computeMetrics(reading: ScaleReading, profile: UserProfile): GarminPayload {
    const calc = new RenphoCalculator(
      reading.weight,
      reading.impedance,
      profile.height,
      profile.age,
      profile.gender,
      profile.isAthlete,
    );
    const metrics = calc.calculate();

    if (!metrics) {
      throw new Error('Calculation failed: invalid inputs');
    }

    return {
      weight: reading.weight,
      impedance: reading.impedance,
      ...metrics,
    };
  }
}
