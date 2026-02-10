#!/usr/bin/env tsx

// Load .env FIRST — before any other module initializes
import './env.js';

import { scanAndRead } from './ble/index.js';
import { adapters } from './scales/index.js';
import { loadConfig } from './validate-env.js';
import { createLogger } from './logger.js';
import { loadExporterConfig, createExporters } from './exporters/index.js';
import type { GarminPayload } from './interfaces/scale-adapter.js';

const log = createLogger('Sync');

const { profile, scaleMac: SCALE_MAC, weightUnit, dryRun } = loadConfig();

const KG_TO_LBS = 2.20462;

function fmtWeight(kg: number): string {
  if (weightUnit === 'lbs') return `${(kg * KG_TO_LBS).toFixed(2)} lbs`;
  return `${kg.toFixed(2)} kg`;
}

async function main(): Promise<void> {
  const modeLabel = dryRun ? 'Scale → Garmin Connect (dry run)' : 'Scale → Garmin Connect';
  log.info(`\n${modeLabel}`);
  if (SCALE_MAC) {
    log.info(`Scanning for scale ${SCALE_MAC}...`);
  } else {
    log.info(`Scanning for any recognized scale...`);
  }
  log.info(`Adapters: ${adapters.map((a) => a.name).join(', ')}\n`);

  const payload: GarminPayload = await scanAndRead({
    targetMac: SCALE_MAC,
    adapters,
    profile,
    weightUnit,
    onLiveData(reading) {
      const impStr: string = reading.impedance > 0 ? `${reading.impedance} Ohm` : 'Measuring...';
      process.stdout.write(`\r  Weight: ${fmtWeight(reading.weight)} | Impedance: ${impStr}      `);
    },
  });

  log.info(`\nMeasurement received: ${fmtWeight(payload.weight)} / ${payload.impedance} Ohm`);
  log.info('Body composition:');
  const kgMetrics = new Set(['boneMass', 'muscleMass']);
  const { weight: _w, impedance: _i, ...metrics } = payload;
  for (const [k, v] of Object.entries(metrics)) {
    const display = kgMetrics.has(k) ? fmtWeight(v) : String(v);
    log.info(`  ${k}: ${display}`);
  }

  if (dryRun) {
    log.info('\nDry run — skipping export.');
    return;
  }

  const exporterConfig = loadExporterConfig();
  const exporters = createExporters(exporterConfig);
  log.info(`\nExporting to: ${exporters.map((e) => e.name).join(', ')}...`);

  const results = await Promise.allSettled(exporters.map((e) => e.export(payload)));

  let allFailed = true;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = exporters[i].name;
    if (result.status === 'fulfilled' && result.value.success) {
      allFailed = false;
    } else if (result.status === 'fulfilled') {
      log.error(`${name}: ${result.value.error}`);
    } else {
      log.error(
        `${name}: ${result.reason instanceof Error ? result.reason.message : result.reason}`,
      );
    }
  }

  if (allFailed) {
    log.error('All exports failed.');
    process.exit(1);
  }

  log.info('Done.');
}

main().catch((err: Error) => {
  log.error(err.message);
  process.exit(1);
});
