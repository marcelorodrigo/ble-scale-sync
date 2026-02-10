# BLE Scale Sync

> **Work in Progress** — Under active development. Expect breaking changes.

A cross-platform CLI tool that reads body composition data from BLE smart scales and exports it to Garmin Connect, MQTT, or both. It bridges the gap between inexpensive BLE scales and fitness platforms that lack native integration — the entire pipeline runs locally without a phone or cloud service.

| | |
|---|---|
| **Scale adapters** | 23 (22 vendor-specific + Standard GATT catch-all) |
| **Platforms** | Linux (Raspberry Pi), macOS, Windows |
| **Export targets** | Garmin Connect, MQTT (Home Assistant auto-discovery) |
| **Metrics** | Weight, BMI, body fat %, water %, bone mass, muscle mass, visceral fat, physique rating, BMR, metabolic age |
| **Tests** | 500+ (Vitest) |

---

## Motivation

BLE body composition scales in the $20–40 range often match or exceed more expensive alternatives in measurement quality, but they typically lock data inside a proprietary phone app. Getting that data into Garmin Connect means opening the app, waiting for a Bluetooth sync, and manually transcribing numbers. Every time.

This project removes the manual step. A small always-on device (e.g. Raspberry Pi) listens for the scale's BLE broadcast, reads the measurement, computes body composition metrics from the raw impedance data, and pushes everything to the configured export targets automatically.

---

## Architecture

The system is split across two runtimes:

| Runtime | Responsibility |
|---|---|
| **TypeScript / Node.js** | BLE communication, scale protocol parsing, body composition calculation, export orchestration |
| **Python** | Garmin Connect upload via the `garminconnect` library (unofficial API) |

```
                                          ┌───────────────────┐
                                   ┌────> │  Garmin Connect   │
┌──────────────┐    ┌────────────┐ │      └───────────────────┘
│  BLE Scale   │    │ TypeScript │ │      ┌───────────────────┐
│  (Bluetooth) │ ─> │ BLE + Body │ ├────> │   MQTT Broker     │
└──────────────┘    │ Composition│ │      └───────────────────┘
                    └────────────┘ │      ┌───────────────────┐
                                   └────> │  Future exports…  │
                                          └───────────────────┘
```

| Step | Description |
|---|---|
| **1. Scan** | BLE layer scans for advertisements, selects the appropriate adapter by device name and service UUIDs. OS-specific handlers (`node-ble` on Linux, `@abandonware/noble` on Windows/macOS) are loaded dynamically. |
| **2. Connect** | Adapter connects to the scale, performs any required handshake (unlock commands, user profile transmission, time sync), subscribes to measurement notifications. |
| **3. Compute** | Once a stable reading is received (weight > 10 kg, impedance > 200 Ohm), the connection closes and body composition is calculated using BIA formulas with the user's profile. |
| **4. Export** | Results are dispatched in parallel to all enabled exporters. Partial failure is tolerated — the process exits with an error only if every exporter fails. |

---

## Supported Scales

| Brand / Model | Protocol |
|---|---|
| **QN-Scale** / Renpho / Senssun / Sencor | Custom (FFE0 / FFF0) |
| **Renpho** ES-WBE28 | Vendor BCS/WSS |
| **Renpho** ES-26BB | Custom (1A10) |
| **Xiaomi Mi Scale 2** (MIBCS / MIBFS) | Vendor UUID |
| **Yunmai** Signal / Mini / SE | Custom (FFE0) |
| **Beurer** BF700 / BF710 / BF800 | Custom (FFE0) |
| **Sanitas** SBF70 / SBF75 / SBF72 / SBF73 | Custom (FFE0) / BCS |
| **Beurer** BF915 | Standard BCS |
| **Soehnle** Shape200 / Shape100 / Shape50 / Style100 | Custom UUID |
| **Medisana** BS430 / BS440 / BS444 | Custom (78B2) |
| **Trisa** Body Analyze | Custom (7802) |
| **Excelvan** CF369 (Electronic Scale) | Custom (FFF0) |
| **Hesley** (YunChen) | Custom (FFF0) |
| **Inlife** (fatscale) | Custom (FFF0) |
| **Digoo** DG-SO38H (Mengii) | Custom (FFF0) |
| **Senssun Fat** | Custom (FFF0) |
| **ES-CS20M** | Custom (1A10) |
| **Exingtech Y1** (vscale) | Custom UUID |
| **1byone** / Eufy C1 / Eufy P1 | Custom (FFF0 / FFB0) |
| **Active Era** BS-06 | Custom (FFB0) |
| **MGB** (Swan / Icomon / YG) | Custom (FFB0) |
| **Hoffen** BS-8107 | Custom (FFB0) |
| Any **standard BT SIG BCS/WSS** scale | Standard (181B / 181D) |

If your scale isn't listed, run `npm run scan` — the Standard GATT catch-all adapter handles any scale that implements the Bluetooth SIG Body Composition Service or Weight Scale Service.

---

## Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | v20+ | All platforms |
| [Python](https://python.org/) | 3.9+ | Required only for Garmin Connect upload |
| BLE adapter | — | Built-in on Raspberry Pi and most laptops |

<details>
<summary>Linux (Debian / Ubuntu / Raspberry Pi OS)</summary>

```bash
sudo apt-get update
sudo apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev build-essential python3-pip

# Node.js v20 (skip if already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Allow BLE access without root
sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))
```

</details>

<details>
<summary>macOS</summary>

```bash
xcode-select --install
brew install node@20
```

No additional Bluetooth setup — macOS uses CoreBluetooth natively.

</details>

<details>
<summary>Windows</summary>

| Requirement | Notes |
|---|---|
| [Node.js](https://nodejs.org/) v20+ LTS | Check "Add to PATH" during install |
| [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) | "Desktop development with C++" workload |
| [Python](https://python.org/) | Check "Add to PATH" during install |
| BLE adapter with [WinUSB driver](https://zadig.akeo.ie/) | See [noble Windows guide](https://github.com/abandonware/noble#windows) |

</details>

---

## Installation

```bash
git clone https://github.com/KristianP26/blescalesync.git
cd blescalesync

npm install

# Python venv (for Garmin upload)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

> Modern Linux distros (Debian 12+, Ubuntu 23.04+, Raspberry Pi OS Bookworm) require a venv for pip.

---

## Configuration

### 1. Environment variables

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `GARMIN_EMAIL` | Yes | — | Garmin Connect email (used during `npm run setup-garmin`) |
| `GARMIN_PASSWORD` | Yes | — | Garmin Connect password |
| `USER_HEIGHT` | Yes | — | Height in cm (or inches if `HEIGHT_UNIT=in`) |
| `USER_BIRTH_DATE` | Yes | — | Format: `YYYY-MM-DD` |
| `USER_GENDER` | Yes | — | `male` or `female` |
| `USER_IS_ATHLETE` | Yes | — | `true` or `false` — adjusts BIA model |
| `WEIGHT_UNIT` | No | `kg` | Display unit (`kg` or `lbs`) — does not affect calculations |
| `HEIGHT_UNIT` | No | `cm` | Input unit for `USER_HEIGHT` (`cm` or `in`) |
| `SCALE_MAC` | No | — | Lock to a specific scale (MAC address or macOS UUID) |
| `TOKEN_DIR` | No | `~/.garmin_tokens` | Garmin auth token storage directory |
| `DRY_RUN` | No | `false` | Read scale and compute metrics without exporting |
| `DEBUG` | No | `false` | Verbose BLE logging |

### 2. Scale discovery (optional)

```bash
npm run scan
```

Scans for 15 seconds and identifies recognized devices (`[QN Scale]`, `[Mi Scale 2]`, etc.). To lock to a specific scale, set `SCALE_MAC` in `.env`.

> **Recommended** — BLE range extends through walls. Without `SCALE_MAC`, the app connects to the first recognized scale it finds.
>
> On macOS, use the CoreBluetooth UUID shown by `npm run scan` instead of a MAC address.

### 3. Garmin authentication

```bash
npm run setup-garmin
```

One-time login. Tokens are saved to `~/.garmin_tokens/` and reused automatically.

> If authentication fails, Garmin may be rate-limiting your IP (common with VPNs and cloud networks). Authenticate from a residential connection, then copy `~/.garmin_tokens/` to the target machine.

### 4. Exporters

| Config value | Targets | Description |
|---|---|---|
| `EXPORTERS=garmin` | Garmin Connect | Default if `EXPORTERS` is not set |
| `EXPORTERS=mqtt` | MQTT broker | Requires `MQTT_BROKER_URL` |
| `EXPORTERS=garmin,mqtt` | Both | Run in parallel |

All configured exporters run in parallel. The process reports an error only if every exporter fails.

#### MQTT

Publishes the full body composition payload as a JSON object to the configured topic.

**Home Assistant auto-discovery** is enabled by default — all 11 metrics register as sensors grouped under a single "BLE Scale" device. No manual YAML configuration needed.

| Variable | Default | Description |
|---|---|---|
| `MQTT_BROKER_URL` | *required* | Broker connection URL (`mqtt://host:1883`) |
| `MQTT_TOPIC` | `scale/body-composition` | Publish topic for measurement data |
| `MQTT_QOS` | `1` | MQTT QoS level (0, 1, or 2) |
| `MQTT_RETAIN` | `true` | Retain the last published message on the broker |
| `MQTT_USERNAME` | — | Broker authentication username |
| `MQTT_PASSWORD` | — | Broker authentication password |
| `MQTT_CLIENT_ID` | `ble-scale-sync` | MQTT client identifier |
| `MQTT_HA_DISCOVERY` | `true` | Publish Home Assistant auto-discovery configs on connect |

---

## Usage

| Command | Description |
|---|---|
| `npm start` | Scan for scale, read measurement, export |
| `DRY_RUN=true npm start` | Read and compute only, skip exports |
| `DEBUG=true npm start` | Verbose BLE logging |
| `npm run scan` | Discover nearby BLE devices |
| `npm run setup-garmin` | One-time Garmin authentication |

Windows PowerShell: use `$env:DRY_RUN="true"; npm start` syntax for environment variables.

---

## Body Composition

Ten metrics are computed from each reading. The primary model is bioelectrical impedance analysis (BIA), which estimates lean body mass from the scale's impedance measurement combined with the user's height, age, and gender.

| Metric | Unit | Method |
|---|---|---|
| Weight | kg | Direct scale reading |
| BMI | — | `weight / height_m²` |
| Body Fat | % | BIA: `LBM = c₁·(H²/Z) + c₂·W + c₃·A + c₄`, then `BF% = (W − LBM) / W × 100` |
| Water | % | `LBM × 0.73 / W × 100` (athlete: 0.74) |
| Bone Mass | kg | `LBM × 0.042` |
| Muscle Mass | kg | `LBM × 0.54` (athlete: 0.60) |
| Visceral Fat | 1–59 | `BF% × 0.55 − 4 + age × 0.08` |
| Physique Rating | 1–9 | Classification based on BF% and muscle-to-weight ratio |
| BMR | kcal | Mifflin-St Jeor: `10W + 6.25H − 5A + s` (athlete: +5%) |
| Metabolic Age | years | `age + (idealBMR − BMR) / 15` |

<details>
<summary>BIA coefficients</summary>

The BIA model uses gender- and activity-specific coefficients for lean body mass estimation:

| Profile | c₁ | c₂ | c₃ | c₄ |
|---|---|---|---|---|
| Male | 0.503 | 0.165 | −0.158 | 17.8 |
| Male (athlete) | 0.637 | 0.205 | −0.180 | 12.5 |
| Female | 0.490 | 0.150 | −0.130 | 11.5 |
| Female (athlete) | 0.550 | 0.180 | −0.150 | 8.5 |

When impedance is unavailable (scale doesn't support BIA, or the user steps off before stabilization), body fat falls back to the Deurenberg equation:
`BF% = 1.2 × BMI + 0.23 × age − 10.8 × sex − 5.4` (sex: 1 = male, 0 = female; athlete: ×0.85)

Mi Scale 2 and Yunmai adapters bypass these formulas entirely and use the scale's own pre-computed values.

</details>

**Athlete mode** (`USER_IS_ATHLETE=true`) adjusts the model for higher lean body mass:

| Parameter | Normal | Athlete |
|---|---|---|
| BIA coefficients | Standard (see table) | Higher c₁, c₂ values |
| Water ratio | 73% of LBM | 74% of LBM |
| Muscle ratio | 54% of LBM | 60% of LBM |
| BMR adjustment | — | +5% |
| Metabolic age cap | None | Actual age − 5 |

---

## Development

| Command | Description |
|---|---|
| `npm test` | Run all 500+ tests (Vitest) |
| `npx vitest run tests/<file>` | Run a single test file |
| `npm run lint` | ESLint check |
| `npm run format:check` | Prettier check |

### Project structure

```
blescalesync/
├── src/
│   ├── index.ts                 # Orchestrator (scan → read → export)
│   ├── ble/                     # BLE layer — OS-specific handlers behind unified API
│   │   ├── index.ts             # Platform detection, dynamic import
│   │   ├── handler-node-ble.ts  # Linux (BlueZ D-Bus via node-ble)
│   │   ├── handler-noble.ts     # Windows / macOS (@abandonware/noble)
│   │   ├── shared.ts            # BleChar/BleDevice abstractions, waitForReading()
│   │   └── types.ts             # ScanOptions, ScanResult, constants, utilities
│   ├── exporters/               # Modular export targets
│   │   ├── garmin.ts            # Garmin Connect (Python subprocess)
│   │   ├── mqtt.ts              # MQTT publish + HA auto-discovery
│   │   ├── config.ts            # Exporter env validation
│   │   └── index.ts             # Registry — createExporters()
│   ├── scales/                  # 23 scale adapters (ScaleAdapter interface)
│   ├── interfaces/              # ScaleAdapter, Exporter, BodyComposition types
│   ├── calculator.ts            # Body composition math (BIA, Mifflin-St Jeor)
│   └── validate-env.ts          # .env validation
├── tests/                       # 500+ tests (Vitest)
├── garmin-scripts/              # Python — Garmin upload + auth setup
└── .env.example
```

### Adding a scale adapter

| Step | File | Action |
|---|---|---|
| 1 | `src/scales/your-brand.ts` | Implement the `ScaleAdapter` interface |
| 2 | `src/scales/index.ts` | Register in the adapter array (before the Standard GATT catch-all) |
| 3 | `tests/scales/your-brand.test.ts` | Add tests using helpers from `tests/helpers/scale-test-utils.ts` |

### Adding an exporter

| Step | File | Action |
|---|---|---|
| 1 | `src/exporters/your-exporter.ts` | Implement the `Exporter` interface |
| 2 | `src/exporters/config.ts` | Add to `ExporterName` type + env parsing |
| 3 | `src/exporters/index.ts` | Add factory case in `createExporters()` |
| 4 | `tests/exporters/your-exporter.test.ts` | Add tests |
| 5 | `.env.example` | Document config variables |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Permission denied" on Linux | `sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))` |
| Scale not found | Step on the scale to wake it (BLE advertisement lasts 10–30s). Verify `SCALE_MAC`. Linux: `sudo systemctl start bluetooth`. |
| `le-connection-abort-by-local` on Pi | `sudo systemctl restart bluetooth` — BlueZ on low-power devices aborts connections while discovery is active. |
| Garmin upload fails | Re-run `npm run setup-garmin`. Check `.env` credentials. Try from a non-VPN residential network. |
| Windows BLE errors | BLE adapter must use [WinUSB driver](https://zadig.akeo.ie/), not the default Windows Bluetooth driver. Run terminal as Administrator. |

---

## Recommended Setup

For a fully automated, always-on deployment:

| Component | Recommendation |
|---|---|
| **Hardware** | [Raspberry Pi Zero 2W](https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/) — built-in BLE, ~0.4W idle, ~$15 |
| **Scale** | Any supported BLE scale |
| **OS** | Raspberry Pi OS Lite (headless) |
| **Automation** | systemd service or cron job running `npm start` on boot |

The Pi sits next to the scale. Total hardware cost is under $50 for a setup that syncs every weigh-in to Garmin Connect without any manual interaction.

---

## Credits

| Component | Project | Description |
|---|---|---|
| **Scale protocols** | [openScale](https://github.com/oliexdev/openScale) by oliexdev | Open-source Android app for BLE body composition scales. All 23 adapters were ported from its Java/Kotlin source — frame formats, byte-level offsets, handshake sequences, checksum algorithms, and manufacturer quirks. This project would not exist without openScale's reverse engineering work. |
| **Garmin upload** | [python-garminconnect](https://github.com/cyberjunky/python-garminconnect) by cyberjunky | Python library for the unofficial Garmin Connect API. Handles OAuth authentication, session token management, and the body composition upload endpoint. |
| **BIA formulas** | Lukaski (1986), Mifflin-St Jeor (1990), Deurenberg (1991) | Lean body mass from impedance, basal metabolic rate, and body fat estimation without impedance. Athlete-mode adjustments follow published sports science adaptations. |
| **BLE libraries** | [node-ble](https://github.com/chrvadala/node-ble), [@abandonware/noble](https://github.com/abandonware/noble) | Low-level Bluetooth communication. node-ble for Linux (BlueZ D-Bus), noble for Windows/macOS. |

---

## License

GPL-3.0 — see [LICENSE](LICENSE).
