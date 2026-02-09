import type { Peripheral } from '@abandonware/noble';
import type {
  ScaleAdapter,
  ScaleReading,
  UserProfile,
  GarminPayload,
} from '../interfaces/scale-adapter.js';
import { uuid16, buildPayload, type ScaleBodyComp } from './body-comp-helpers.js';

const CHR_NOTIFY = uuid16(0x8a21);
const CHR_WRITE = uuid16(0x8a81);

/**
 * Adapter for Trisa body-composition scales (names starting with "01257B" or "11257B").
 *
 * Protocol details:
 *   - Service 0x7802, notify (indicate) 0x8A21, write 0x8A81
 *   - Scale sends challenge first; no unlock command needed
 *   - Measurement frames use base-10 float encoding for weight and resistance
 *   - Info flags at byte[0]: bit0=timestamp, bit1=resistance1, bit2=resistance2
 *   - Weight: bytes [1-3] unsigned 24-bit LE mantissa, byte[4] signed exponent
 *   - Impedance derived from resistance2: if r2 < 410 then 3.0 else 0.3*(r2-400)
 */
export class TrisaAdapter implements ScaleAdapter {
  readonly name = 'Trisa';
  readonly charNotifyUuid = CHR_NOTIFY;
  readonly charWriteUuid = CHR_WRITE;

  /** Empty unlock — the scale sends a challenge first. */
  readonly unlockCommand: number[] = [];
  readonly unlockIntervalMs = 0;

  matches(peripheral: Peripheral): boolean {
    const name = (peripheral.advertisement.localName || '').toUpperCase();
    return name.startsWith('01257B') || name.startsWith('11257B');
  }

  /**
   * Parse a Trisa measurement frame.
   *
   * Layout:
   *   [0]      info flags
   *             bit 0: timestamp present (7 bytes at offset 5)
   *             bit 1: resistance1 present (4 bytes base-10 float)
   *             bit 2: resistance2 present (4 bytes base-10 float)
   *   [1-3]    weight mantissa, unsigned 24-bit little-endian
   *   [4]      weight exponent, signed int8
   *   [5+]     optional timestamp (7 bytes if bit0 set)
   *   then:    optional resistance1 (4 bytes if bit1 set)
   *   then:    optional resistance2 (4 bytes if bit2 set)
   *
   * Weight = mantissa * 10^exponent
   * Impedance from resistance2: r2 < 410 ? 3.0 : 0.3 * (r2 - 400)
   */
  parseNotification(data: Buffer): ScaleReading | null {
    if (data.length < 5) return null;

    const flags = data[0];
    const hasTimestamp = (flags & 0x01) !== 0;
    const hasResistance1 = (flags & 0x02) !== 0;
    const hasResistance2 = (flags & 0x04) !== 0;

    // Skip frames that are just timestamps (only bit0 set, no weight data expected)
    if (hasTimestamp && !hasResistance1 && !hasResistance2) {
      // Check if this is a timestamp-only frame by verifying we have
      // meaningful weight data
      const mantissa = data[1] | (data[2] << 8) | (data[3] << 16);
      if (mantissa === 0) return null;
    }

    // Weight: 24-bit unsigned LE mantissa + signed exponent
    const mantissa = data[1] | (data[2] << 8) | (data[3] << 16);
    const exponent = data.readInt8(4);
    const weight = mantissa * Math.pow(10, exponent);

    if (weight <= 0 || !Number.isFinite(weight)) return null;

    // Walk through optional fields to find resistance2
    let offset = 5;

    if (hasTimestamp) {
      offset += 7;
    }

    if (hasResistance1) {
      offset += 4;
    }

    let impedance = 0;
    if (hasResistance2 && offset + 4 <= data.length) {
      const r2Mantissa = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
      const r2Exponent = data.readInt8(offset + 3);
      const r2 = r2Mantissa * Math.pow(10, r2Exponent);

      if (r2 < 410) {
        impedance = 3.0;
      } else {
        impedance = 0.3 * (r2 - 400);
      }
    }

    return { weight, impedance };
  }

  isComplete(reading: ScaleReading): boolean {
    return reading.weight > 0;
  }

  computeMetrics(reading: ScaleReading, profile: UserProfile): GarminPayload {
    const comp: ScaleBodyComp = {};
    return buildPayload(reading.weight, reading.impedance, comp, profile);
  }
}
