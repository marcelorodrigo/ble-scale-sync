/**
 * Shared body-composition helpers used by multiple scale adapters.
 *
 * Most consumer scales provide body-fat / water / muscle / bone directly
 * in their BLE frames.  The helpers here fill in the remaining GarminPayload
 * fields (BMI, BMR, metabolic age, physique rating) that are always
 * calculated from the user profile rather than measured by the scale.
 */

import type { UserProfile, GarminPayload } from '../interfaces/scale-adapter.js';

export interface ScaleBodyComp {
  fat?: number;       // %
  water?: number;     // %
  muscle?: number;    // %
  bone?: number;      // kg
  visceralFat?: number;
}

/** Build a full GarminPayload from scale-provided body-comp values + user profile. */
export function buildPayload(
  weight: number,
  impedance: number,
  comp: ScaleBodyComp,
  p: UserProfile,
): GarminPayload {
  const heightM = p.height / 100;
  const bmi = weight / (heightM * heightM);

  const bodyFatPercent = comp.fat ?? estimateBodyFat(bmi, p);
  const lbm = weight * (1 - bodyFatPercent / 100);

  const waterPercent = comp.water
    ?? (lbm * (p.isAthlete ? 0.74 : 0.73) / weight) * 100;

  const boneMass = comp.bone ?? lbm * 0.042;

  const muscleMass = comp.muscle != null
    ? (comp.muscle / 100) * weight
    : lbm * (p.isAthlete ? 0.60 : 0.54);

  let visceralFat: number;
  if (comp.visceralFat != null) {
    visceralFat = Math.max(1, Math.min(Math.trunc(comp.visceralFat), 59));
  } else if (bodyFatPercent > 10) {
    visceralFat = Math.max(1, Math.min(
      Math.trunc((bodyFatPercent * 0.55) - 4 + (p.age * 0.08)), 59));
  } else {
    visceralFat = 1;
  }

  const physiqueRating = computePhysiqueRating(bodyFatPercent, muscleMass, weight);

  const baseBmr = (10 * weight) + (6.25 * p.height) - (5 * p.age);
  let bmr = baseBmr + (p.gender === 'male' ? 5 : -161);
  if (p.isAthlete) bmr *= 1.05;

  const idealBmr = (10 * weight) + (6.25 * p.height) - (5 * 25) + 5;
  let metabolicAge = p.age + Math.trunc((idealBmr - bmr) / 15);
  if (metabolicAge < 12) metabolicAge = 12;
  if (p.isAthlete && metabolicAge > p.age) metabolicAge = p.age - 5;

  return {
    weight: r2(weight), impedance: r2(impedance),
    bmi: r2(bmi), bodyFatPercent: r2(bodyFatPercent),
    waterPercent: r2(waterPercent), boneMass: r2(boneMass),
    muscleMass: r2(muscleMass), visceralFat,
    physiqueRating, bmr: Math.trunc(bmr), metabolicAge,
  };
}

/** Deurenberg formula — fallback when no scale body-fat is available. */
export function estimateBodyFat(bmi: number, p: UserProfile): number {
  const sexFactor = p.gender === 'male' ? 1 : 0;
  let bf = 1.2 * bmi + 0.23 * p.age - 10.8 * sexFactor - 5.4;
  if (p.isAthlete) bf *= 0.85;
  return Math.max(3, Math.min(bf, 60));
}

export function computePhysiqueRating(
  bodyFatPercent: number, muscleMass: number, weight: number,
): number {
  if (bodyFatPercent > 25) return muscleMass > weight * 0.4 ? 2 : 1;
  if (bodyFatPercent < 18) {
    if (muscleMass > weight * 0.45) return 9;
    if (muscleMass > weight * 0.4) return 8;
    return 7;
  }
  if (muscleMass > weight * 0.45) return 6;
  if (muscleMass < weight * 0.38) return 4;
  return 5;
}

/** Expand a 16-bit UUID to the full 128-bit BLE string. */
export function uuid16(code: number): string {
  return `0000${code.toString(16).padStart(4, '0')}00001000800000805f9b34fb`;
}

export function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** XOR checksum over a range of buffer bytes. */
export function xorChecksum(buf: Buffer | number[], start: number, end: number): number {
  let xor = 0;
  for (let i = start; i < end; i++) xor ^= (buf[i] & 0xff);
  return xor & 0xff;
}
