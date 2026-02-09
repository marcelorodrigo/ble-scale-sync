import noble, { Peripheral, Characteristic } from '@abandonware/noble';
import type {
  ScaleAdapter,
  UserProfile,
  GarminPayload,
  ScaleReading,
} from './interfaces/scale-adapter.js';
import type { WeightUnit } from './validate-env.js';

const LBS_TO_KG = 0.453592;
const BLE_DEBUG = !!process.env.DEBUG;
const BT_BASE_UUID_SUFFIX = '00001000800000805f9b34fb';

function debug(msg: string): void {
  if (BLE_DEBUG) console.log(`[BLE:debug] ${msg}`);
}

/** Normalize a UUID to lowercase 32-char (no dashes) form for comparison. */
function normalizeUuid(uuid: string): string {
  const stripped = uuid.replace(/-/g, '').toLowerCase();
  // Expand 4-char short UUIDs to full 128-bit form
  if (stripped.length === 4) {
    return `0000${stripped}${BT_BASE_UUID_SUFFIX}`;
  }
  return stripped;
}

/** Compare two BLE UUIDs, handling short (4-char) vs long (32-char) forms. */
function uuidMatch(a: string, b: string): boolean {
  return normalizeUuid(a) === normalizeUuid(b);
}

export interface ScanOptions {
  targetMac?: string;
  adapters: ScaleAdapter[];
  profile: UserProfile;
  weightUnit?: WeightUnit;
  onLiveData?: (reading: ScaleReading) => void;
}

export function scanAndRead(opts: ScanOptions): Promise<GarminPayload> {
  const { targetMac, adapters, profile, weightUnit, onLiveData } = opts;
  const targetId: string | undefined = targetMac?.toLowerCase().replace(/:/g, '');

  return new Promise<GarminPayload>((resolve, reject) => {
    let unlockInterval: ReturnType<typeof setInterval> | null = null;
    let resolved = false;

    function cleanup(peripheral?: Peripheral): void {
      if (unlockInterval) {
        clearInterval(unlockInterval);
        unlockInterval = null;
      }
      noble.stopScanning();
      noble.removeListener('stateChange', onStateChange);
      noble.removeListener('discover', onDiscover);
      if (peripheral && peripheral.state === 'connected') {
        peripheral.disconnect(() => {});
      }
    }

    function onStateChange(state: string): void {
      if (state === 'poweredOn') {
        console.log('[BLE] Adapter powered on, scanning...');
        noble.startScanning([], false);
      } else {
        console.log(`[BLE] Adapter state: ${state}`);
        noble.stopScanning();
      }
    }

    noble.on('stateChange', onStateChange);

    function onDiscover(peripheral: Peripheral): void {
      const id: string =
        peripheral.id?.replace(/:/g, '').toLowerCase() ||
        peripheral.address?.replace(/:/g, '').toLowerCase() ||
        '';

      const advUuids = peripheral.advertisement.serviceUuids || [];
      debug(
        `Discovered: ${peripheral.advertisement.localName || '(unnamed)'} [${id}] services=[${advUuids.join(', ')}]`,
      );

      let matchedAdapter: ScaleAdapter | undefined;

      if (targetId) {
        // Pinned mode: only consider the specific MAC
        if (id !== targetId) return;

        matchedAdapter = adapters.find((a) => a.matches(peripheral));
        if (!matchedAdapter) {
          const deviceName: string = peripheral.advertisement.localName || '(unknown)';
          cleanup();
          reject(
            new Error(
              `Device found (${deviceName}) but no adapter recognized it. ` +
                `Registered adapters: ${adapters.map((a) => a.name).join(', ')}`,
            ),
          );
          return;
        }
      } else {
        // Auto-discovery mode: try all adapters against every peripheral
        matchedAdapter = adapters.find((a) => a.matches(peripheral));
        if (!matchedAdapter) return;

        console.log(`[BLE] Auto-discovered: ${matchedAdapter.name} (${peripheral.id})`);
      }

      console.log(
        `[BLE] Found scale: ${peripheral.advertisement.localName || peripheral.id} [${matchedAdapter.name}]`,
      );
      noble.stopScanning();

      peripheral.connect((err?: string) => {
        if (err) {
          cleanup(peripheral);
          reject(new Error(`BLE connect failed: ${err}`));
          return;
        }

        console.log('[BLE] Connected. Discovering services...');

        peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
          if (err) {
            cleanup(peripheral);
            reject(new Error(`Service discovery failed: ${err}`));
            return;
          }

          debug(`Services: [${(services || []).map((s) => s.uuid).join(', ')}]`);
          for (const c of characteristics) {
            debug(`  Char ${c.uuid} — properties: [${c.properties?.join(', ') ?? 'n/a'}]`);
          }

          debug(
            `Looking for notify=${matchedAdapter.charNotifyUuid}` +
              (matchedAdapter.altCharNotifyUuid
                ? ` (alt=${matchedAdapter.altCharNotifyUuid})`
                : '') +
              `, write=${matchedAdapter.charWriteUuid}` +
              (matchedAdapter.altCharWriteUuid ? ` (alt=${matchedAdapter.altCharWriteUuid})` : ''),
          );

          const findChar = (uuid: string): Characteristic | undefined =>
            characteristics.find((c) => uuidMatch(c.uuid, uuid));

          const notifyChar: Characteristic | undefined =
            findChar(matchedAdapter.charNotifyUuid) ??
            (matchedAdapter.altCharNotifyUuid
              ? findChar(matchedAdapter.altCharNotifyUuid)
              : undefined);
          const writeChar: Characteristic | undefined =
            findChar(matchedAdapter.charWriteUuid) ??
            (matchedAdapter.altCharWriteUuid
              ? findChar(matchedAdapter.altCharWriteUuid)
              : undefined);

          if (!notifyChar || !writeChar) {
            const discoveredUuids = characteristics.map((c) => c.uuid).join(', ');
            cleanup(peripheral);
            reject(
              new Error(
                `Required characteristics not found. ` +
                  `Notify (${matchedAdapter.charNotifyUuid}): ${!!notifyChar}, ` +
                  `Write (${matchedAdapter.charWriteUuid}): ${!!writeChar}. ` +
                  `Discovered characteristics: [${discoveredUuids}]`,
              ),
            );
            return;
          }

          debug(`Matched notify=${notifyChar.uuid}, write=${writeChar.uuid}`);

          notifyChar.subscribe((err?: string) => {
            if (err) {
              cleanup(peripheral);
              reject(new Error(`Subscribe failed: ${err}`));
              return;
            }
            console.log('[BLE] Subscribed to notifications. Step on the scale.');
          });

          notifyChar.on('data', (data: Buffer) => {
            if (resolved) return;

            const reading: ScaleReading | null = matchedAdapter.parseNotification(data);
            if (!reading) return;

            // Convert lbs → kg when the user declared lbs and the adapter
            // doesn't already normalise to kg internally.
            if (weightUnit === 'lbs' && !matchedAdapter.normalizesWeight) {
              reading.weight *= LBS_TO_KG;
            }

            if (onLiveData) {
              onLiveData(reading);
            }

            if (matchedAdapter.isComplete(reading)) {
              resolved = true;
              cleanup(peripheral);

              try {
                const payload: GarminPayload = matchedAdapter.computeMetrics(reading, profile);
                resolve(payload);
              } catch (e) {
                reject(e);
              }
            }
          });

          const unlockBuf: Buffer = Buffer.from(matchedAdapter.unlockCommand);
          const sendUnlock = (): void => {
            if (!resolved) {
              writeChar.write(unlockBuf, true, (err?: string) => {
                if (err && !resolved) {
                  console.error(`[BLE] Unlock write error: ${err}`);
                }
              });
            }
          };

          sendUnlock();
          unlockInterval = setInterval(sendUnlock, matchedAdapter.unlockIntervalMs);
        });
      });

      peripheral.on('disconnect', () => {
        if (!resolved) {
          cleanup(peripheral);
          reject(new Error('Scale disconnected unexpectedly'));
        }
      });
    }

    noble.on('discover', onDiscover);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((noble as any).state === 'poweredOn') {
      console.log('[BLE] Adapter already on, scanning...');
      noble.startScanning([], false);
    }
  });
}
