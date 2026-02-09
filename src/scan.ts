import noble, { Peripheral } from '@abandonware/noble';
import { adapters } from './scales/index.js';

const SCAN_DURATION_MS = 15_000;
const seen = new Map<string, boolean>();
const recognized: { id: string; name: string; adapter: string }[] = [];

console.log('Scanning for BLE devices... (15 seconds)\n');

noble.on('stateChange', (state: string) => {
  if (state === 'poweredOn') {
    noble.startScanning([], true);
  } else {
    console.log(`Adapter state: ${state}`);
    process.exit(1);
  }
});

noble.on('discover', (peripheral: Peripheral) => {
  const id: string = peripheral.address || peripheral.id;
  if (seen.has(id)) return;
  seen.set(id, true);

  const name: string = peripheral.advertisement.localName || '(unknown)';
  const rssi: number = peripheral.rssi;

  const matched = adapters.find((a) => a.matches(peripheral));
  const tag: string = matched ? ` << ${matched.name}` : '';

  if (matched) {
    recognized.push({ id, name, adapter: matched.name });
  }

  console.log(`  ${id}  RSSI: ${rssi}  Name: ${name}${tag}`);
});

setTimeout(() => {
  noble.stopScanning();
  console.log(`\nDone. Found ${seen.size} device(s).`);

  if (recognized.length === 0) {
    console.log('\nNo recognized scales found. Make sure your scale is powered on.');
  } else {
    console.log(`\n--- Recognized scales (${recognized.length}) ---`);
    for (const s of recognized) {
      console.log(`  ${s.id}  ${s.name}  [${s.adapter}]`);
    }
    console.log('\nTo pin to a specific scale, add to .env:');
    console.log(`  SCALE_MAC=${recognized[0].id}`);
    if (recognized.length === 1) {
      console.log('\nOnly one scale found — auto-discovery will work without SCALE_MAC.');
    }
  }

  process.exit(0);
}, SCAN_DURATION_MS);
