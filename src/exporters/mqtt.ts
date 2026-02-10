import { createLogger } from '../logger.js';
import type { BodyComposition } from '../interfaces/scale-adapter.js';
import type { Exporter, ExportResult } from '../interfaces/exporter.js';
import type { MqttConfig } from './config.js';

const log = createLogger('MQTT');

const CONNECT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

export class MqttExporter implements Exporter {
  readonly name = 'mqtt';
  private readonly config: MqttConfig;

  constructor(config: MqttConfig) {
    this.config = config;
  }

  async export(data: BodyComposition): Promise<ExportResult> {
    const { connectAsync } = await import('mqtt');
    const { brokerUrl, topic, qos, retain, username, password, clientId } = this.config;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        log.info(`Retrying MQTT publish (${attempt}/${MAX_RETRIES})...`);
      }

      try {
        const client = await connectAsync(brokerUrl, {
          clientId,
          username,
          password,
          connectTimeout: CONNECT_TIMEOUT_MS,
        });

        try {
          const payload = JSON.stringify(data);
          await client.publishAsync(topic, payload, { qos, retain });
          log.info(`Published to ${topic} (qos=${qos}, retain=${retain}).`);
          return { success: true };
        } finally {
          await client.endAsync();
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        log.error(`MQTT publish failed: ${lastError}`);
      }
    }

    return { success: false, error: lastError ?? 'All MQTT publish attempts failed' };
  }
}
