import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

import { createLogger } from '../logger.js';
import type { BodyComposition } from '../interfaces/scale-adapter.js';
import type { Exporter, ExportResult } from '../interfaces/exporter.js';

const log = createLogger('Garmin');

const __dirname: string = dirname(fileURLToPath(import.meta.url));
const ROOT: string = join(__dirname, '..', '..');

function findPython(): Promise<string> {
  return new Promise((resolve) => {
    const check = spawn('python3', ['--version'], { stdio: 'ignore' });
    check.on('error', () => resolve('python'));
    check.on('close', (code) => resolve(code === 0 ? 'python3' : 'python'));
  });
}

function uploadToGarmin(payload: BodyComposition, pythonCmd: string): Promise<ExportResult> {
  return new Promise<ExportResult>((resolve, reject) => {
    const scriptPath: string = join(ROOT, 'scripts', 'garmin_upload.py');
    const py = spawn(pythonCmd, [scriptPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd: ROOT,
    });

    const chunks: Buffer[] = [];
    py.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();

    py.on('close', (code: number | null) => {
      const raw: string = Buffer.concat(chunks).toString().trim();
      if (!raw) {
        reject(new Error(`Python uploader exited with code ${code} and no output`));
        return;
      }
      try {
        const result: ExportResult = JSON.parse(raw);
        resolve(result);
      } catch {
        reject(new Error(`Invalid JSON from Python (exit ${code}): ${raw}`));
      }
    });

    py.on('error', (err: Error) => {
      reject(new Error(`Failed to launch Python: ${err.message}`));
    });
  });
}

export class GarminExporter implements Exporter {
  readonly name = 'garmin';

  async export(data: BodyComposition): Promise<ExportResult> {
    const pythonCmd = await findPython();
    const MAX_RETRIES = 2;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        log.info(`Retrying upload (${attempt}/${MAX_RETRIES})...`);
      }

      try {
        const result = await uploadToGarmin(data, pythonCmd);
        if (result.success) {
          log.info('Garmin upload succeeded.');
          return result;
        }
        lastError = result.error;
        log.error(`Upload failed: ${lastError}`);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        log.error(`Upload error: ${lastError}`);
      }
    }

    return { success: false, error: lastError ?? 'All upload attempts failed' };
  }
}
