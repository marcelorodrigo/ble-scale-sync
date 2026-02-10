import type { Exporter } from '../interfaces/exporter.js';
import type { ExporterConfig } from './config.js';
import { GarminExporter } from './garmin.js';
import { MqttExporter } from './mqtt.js';

export { loadExporterConfig } from './config.js';

export function createExporters(config: ExporterConfig): Exporter[] {
  const exporters: Exporter[] = [];

  for (const name of config.exporters) {
    switch (name) {
      case 'garmin':
        exporters.push(new GarminExporter());
        break;
      case 'mqtt':
        exporters.push(new MqttExporter(config.mqtt!));
        break;
    }
  }

  return exporters;
}
