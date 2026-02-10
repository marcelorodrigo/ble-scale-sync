import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MqttExporter } from '../../src/exporters/mqtt.js';
import type { MqttConfig } from '../../src/exporters/config.js';
import type { BodyComposition } from '../../src/interfaces/scale-adapter.js';

const samplePayload: BodyComposition = {
  weight: 80,
  impedance: 500,
  bmi: 23.9,
  bodyFatPercent: 18.5,
  waterPercent: 55.2,
  boneMass: 3.1,
  muscleMass: 62.4,
  visceralFat: 8,
  physiqueRating: 5,
  bmr: 1750,
  metabolicAge: 30,
};

const defaultConfig: MqttConfig = {
  brokerUrl: 'mqtt://localhost:1883',
  topic: 'scale/body-composition',
  qos: 1,
  retain: true,
  clientId: 'ble-scale-sync',
};

const { mockPublishAsync, mockEndAsync, mockConnectAsync } = vi.hoisted(() => {
  const mockPublishAsync = vi.fn().mockResolvedValue(undefined);
  const mockEndAsync = vi.fn().mockResolvedValue(undefined);
  const mockConnectAsync = vi.fn().mockResolvedValue({
    publishAsync: mockPublishAsync,
    endAsync: mockEndAsync,
  });
  return { mockPublishAsync, mockEndAsync, mockConnectAsync };
});

vi.mock('mqtt', () => ({
  connectAsync: mockConnectAsync,
}));

describe('MqttExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectAsync.mockResolvedValue({
      publishAsync: mockPublishAsync,
      endAsync: mockEndAsync,
    });
    mockPublishAsync.mockResolvedValue(undefined);
    mockEndAsync.mockResolvedValue(undefined);
  });

  it('has name "mqtt"', () => {
    const exporter = new MqttExporter(defaultConfig);
    expect(exporter.name).toBe('mqtt');
  });

  it('publishes payload as JSON to configured topic', async () => {
    const exporter = new MqttExporter(defaultConfig);
    const result = await exporter.export(samplePayload);

    expect(result.success).toBe(true);
    expect(mockConnectAsync).toHaveBeenCalledWith('mqtt://localhost:1883', {
      clientId: 'ble-scale-sync',
      username: undefined,
      password: undefined,
      connectTimeout: 10_000,
    });
    expect(mockPublishAsync).toHaveBeenCalledWith(
      'scale/body-composition',
      JSON.stringify(samplePayload),
      { qos: 1, retain: true },
    );
    expect(mockEndAsync).toHaveBeenCalled();
  });

  it('passes username and password when configured', async () => {
    const config: MqttConfig = {
      ...defaultConfig,
      username: 'user',
      password: 'pass',
    };
    const exporter = new MqttExporter(config);
    await exporter.export(samplePayload);

    expect(mockConnectAsync).toHaveBeenCalledWith(
      'mqtt://localhost:1883',
      expect.objectContaining({ username: 'user', password: 'pass' }),
    );
  });

  it('returns failure after retries when connect fails', async () => {
    mockConnectAsync.mockRejectedValue(new Error('connection refused'));
    const exporter = new MqttExporter(defaultConfig);
    const result = await exporter.export(samplePayload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('connection refused');
    // 1 initial + 2 retries = 3 attempts
    expect(mockConnectAsync).toHaveBeenCalledTimes(3);
  });

  it('returns failure after retries when publish fails', async () => {
    mockPublishAsync.mockRejectedValue(new Error('publish timeout'));
    const exporter = new MqttExporter(defaultConfig);
    const result = await exporter.export(samplePayload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('publish timeout');
    expect(mockPublishAsync).toHaveBeenCalledTimes(3);
  });

  it('always calls endAsync even if publish fails', async () => {
    mockPublishAsync.mockRejectedValue(new Error('fail'));
    const exporter = new MqttExporter(defaultConfig);
    await exporter.export(samplePayload);

    // endAsync should have been called on each attempt
    expect(mockEndAsync).toHaveBeenCalledTimes(3);
  });

  it('uses custom topic and qos', async () => {
    const config: MqttConfig = {
      ...defaultConfig,
      topic: 'home/weight',
      qos: 0,
      retain: false,
    };
    const exporter = new MqttExporter(config);
    await exporter.export(samplePayload);

    expect(mockPublishAsync).toHaveBeenCalledWith('home/weight', expect.any(String), {
      qos: 0,
      retain: false,
    });
  });
});
