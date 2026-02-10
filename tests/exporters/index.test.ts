import { describe, it, expect } from 'vitest';
import { createExporters } from '../../src/exporters/index.js';
import { GarminExporter } from '../../src/exporters/garmin.js';
import { MqttExporter } from '../../src/exporters/mqtt.js';
import type { ExporterConfig } from '../../src/exporters/config.js';

describe('createExporters()', () => {
  it('creates GarminExporter for garmin', () => {
    const config: ExporterConfig = { exporters: ['garmin'] };
    const exporters = createExporters(config);
    expect(exporters).toHaveLength(1);
    expect(exporters[0]).toBeInstanceOf(GarminExporter);
    expect(exporters[0].name).toBe('garmin');
  });

  it('creates MqttExporter for mqtt', () => {
    const config: ExporterConfig = {
      exporters: ['mqtt'],
      mqtt: {
        brokerUrl: 'mqtt://localhost:1883',
        topic: 'test',
        qos: 1,
        retain: true,
        clientId: 'test',
      },
    };
    const exporters = createExporters(config);
    expect(exporters).toHaveLength(1);
    expect(exporters[0]).toBeInstanceOf(MqttExporter);
    expect(exporters[0].name).toBe('mqtt');
  });

  it('creates multiple exporters in order', () => {
    const config: ExporterConfig = {
      exporters: ['garmin', 'mqtt'],
      mqtt: {
        brokerUrl: 'mqtt://localhost:1883',
        topic: 'test',
        qos: 1,
        retain: true,
        clientId: 'test',
      },
    };
    const exporters = createExporters(config);
    expect(exporters).toHaveLength(2);
    expect(exporters[0]).toBeInstanceOf(GarminExporter);
    expect(exporters[1]).toBeInstanceOf(MqttExporter);
  });

  it('returns empty array for empty exporters list', () => {
    const config: ExporterConfig = { exporters: [] };
    const exporters = createExporters(config);
    expect(exporters).toHaveLength(0);
  });
});
