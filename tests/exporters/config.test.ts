import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadExporterConfig } from '../../src/exporters/config.js';

describe('loadExporterConfig()', () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.unstubAllEnvs();
    exitSpy.mockClear();
    errorSpy.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('EXPORTERS parsing', () => {
    it('defaults to garmin when EXPORTERS is not set', () => {
      const cfg = loadExporterConfig();
      expect(cfg.exporters).toEqual(['garmin']);
      expect(cfg.mqtt).toBeUndefined();
    });

    it('parses single exporter', () => {
      vi.stubEnv('EXPORTERS', 'garmin');
      const cfg = loadExporterConfig();
      expect(cfg.exporters).toEqual(['garmin']);
    });

    it('parses multiple exporters', () => {
      vi.stubEnv('EXPORTERS', 'garmin,mqtt');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      const cfg = loadExporterConfig();
      expect(cfg.exporters).toEqual(['garmin', 'mqtt']);
    });

    it('trims whitespace around names', () => {
      vi.stubEnv('EXPORTERS', ' garmin , mqtt ');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      const cfg = loadExporterConfig();
      expect(cfg.exporters).toEqual(['garmin', 'mqtt']);
    });

    it('is case-insensitive', () => {
      vi.stubEnv('EXPORTERS', 'GARMIN,MQTT');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      const cfg = loadExporterConfig();
      expect(cfg.exporters).toEqual(['garmin', 'mqtt']);
    });

    it('deduplicates exporters', () => {
      vi.stubEnv('EXPORTERS', 'garmin,garmin');
      const cfg = loadExporterConfig();
      expect(cfg.exporters).toEqual(['garmin']);
    });

    it('rejects unknown exporter names', () => {
      vi.stubEnv('EXPORTERS', 'garmin,influxdb');
      expect(() => loadExporterConfig()).toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown exporter 'influxdb'"));
    });

    it('supports mqtt-only', () => {
      vi.stubEnv('EXPORTERS', 'mqtt');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      const cfg = loadExporterConfig();
      expect(cfg.exporters).toEqual(['mqtt']);
    });
  });

  describe('MQTT config', () => {
    it('requires MQTT_BROKER_URL when mqtt is enabled', () => {
      vi.stubEnv('EXPORTERS', 'mqtt');
      expect(() => loadExporterConfig()).toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('MQTT_BROKER_URL is required'));
    });

    it('uses defaults for optional MQTT vars', () => {
      vi.stubEnv('EXPORTERS', 'mqtt');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://broker.local:1883');
      const cfg = loadExporterConfig();
      expect(cfg.mqtt).toEqual({
        brokerUrl: 'mqtt://broker.local:1883',
        topic: 'scale/body-composition',
        qos: 1,
        retain: true,
        username: undefined,
        password: undefined,
        clientId: 'ble-scale-sync',
        haDiscovery: true,
      });
    });

    it('parses all MQTT env vars', () => {
      vi.stubEnv('EXPORTERS', 'mqtt');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://broker.local:1883');
      vi.stubEnv('MQTT_TOPIC', 'home/scale');
      vi.stubEnv('MQTT_QOS', '2');
      vi.stubEnv('MQTT_RETAIN', 'false');
      vi.stubEnv('MQTT_USERNAME', 'user');
      vi.stubEnv('MQTT_PASSWORD', 'pass');
      vi.stubEnv('MQTT_CLIENT_ID', 'my-scale');
      vi.stubEnv('MQTT_HA_DISCOVERY', 'false');
      const cfg = loadExporterConfig();
      expect(cfg.mqtt).toEqual({
        brokerUrl: 'mqtt://broker.local:1883',
        topic: 'home/scale',
        qos: 2,
        retain: false,
        username: 'user',
        password: 'pass',
        clientId: 'my-scale',
        haDiscovery: false,
      });
    });

    it('rejects invalid MQTT_QOS', () => {
      vi.stubEnv('EXPORTERS', 'mqtt');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      vi.stubEnv('MQTT_QOS', '5');
      expect(() => loadExporterConfig()).toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('MQTT_QOS must be 0, 1, or 2'));
    });

    it('rejects invalid MQTT_RETAIN', () => {
      vi.stubEnv('EXPORTERS', 'mqtt');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      vi.stubEnv('MQTT_RETAIN', 'maybe');
      expect(() => loadExporterConfig()).toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('MQTT_RETAIN must be true/false'),
      );
    });

    it('does not parse MQTT config when mqtt is not enabled', () => {
      vi.stubEnv('EXPORTERS', 'garmin');
      vi.stubEnv('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      const cfg = loadExporterConfig();
      expect(cfg.mqtt).toBeUndefined();
    });
  });
});
