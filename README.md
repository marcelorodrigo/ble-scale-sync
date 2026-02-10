# BLE Scale Sync

> **Work in Progress** — Under active development. Expect breaking changes.

A cross-platform CLI tool that reads body composition data from BLE smart scales and exports it to Garmin Connect, MQTT, or both. It bridges the gap between inexpensive BLE scales and fitness platforms that lack native integration — the entire pipeline runs locally without a phone or cloud service.

23 scale adapters · Linux / macOS / Windows · Garmin Connect + MQTT + Home Assistant · 10 body composition metrics

---

## Motivation

BLE body composition scales in the $20–40 range often match or exceed more expensive alternatives in measurement quality, but they typically lock data inside a proprietary phone app. Getting that data into Garmin Connect means opening the app, waiting for a Bluetooth sync, and manually transcribing numbers. Every time.

This project removes the manual step. A small always-on device (e.g. Raspberry Pi) listens for the scale's BLE broadcast, reads the measurement, computes body composition metrics from the raw impedance data, and pushes everything to the configured export targets automatically.

---

## Architecture

The system is split across two runtimes:

- **TypeScript / Node.js** — BLE communication, scale protocol parsing, body composition calculation, export orchestration
- **Python** — Garmin Connect upload (the `garminconnect` library handles the unofficial API)

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

**Data flow:**

1. The BLE layer scans for advertisements and selects the appropriate scale adapter based on device name and service UUIDs. OS-specific handlers (`node-ble` on Linux, `@abandonware/noble` on Windows/macOS) are loaded dynamically at runtime.
2. The adapter connects to the scale, performs any required handshake (unlock commands, user profile transmission, time sync), and subscribes to measurement notifications.
3. Once a stable reading is received (weight > 10 kg, impedance > 200 Ohm), the connection is closed and body composition is calculated using BIA formulas with the user's profile data.
4. Results are dispatched in parallel to all enabled exporters. Partial failure is tolerated — the process exits with an error only if every exporter fails.

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

**All platforms:** [Node.js](https://nodejs.org/) v20+ · [Python](https://python.org/) 3.9+ (for Garmin upload) · BLE adapter

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

1. [Node.js](https://nodejs.org/) v20+ LTS (check "Add to PATH")
2. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) ("Desktop development with C++")
3. [Python](https://python.org/) (check "Add to PATH")
4. BLE adapter with [WinUSB driver](https://zadig.akeo.ie/) — see [noble Windows guide](https://github.com/abandonware/noble#windows)

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

### 1. Environment

```bash
cp .env.example .env
```

```ini
GARMIN_EMAIL=you@example.com
GARMIN_PASSWORD=your_password

USER_HEIGHT=183
USER_BIRTH_DATE=2000-06-15
USER_GENDER=male
USER_IS_ATHLETE=true

# Optional (defaults to metric)
WEIGHT_UNIT=kg
HEIGHT_UNIT=cm
```

### 2. Scale discovery (optional)

```bash
npm run scan
```

Scans for 15 seconds and identifies recognized devices (`[QN Scale]`, `[Mi Scale 2]`, etc.). To lock to a specific scale, set `SCALE_MAC` in `.env`:

```ini
SCALE_MAC=FF:03:00:13:A1:04
```

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

```ini
EXPORTERS=garmin              # default
EXPORTERS=garmin,mqtt         # both in parallel
EXPORTERS=mqtt                # MQTT only
```

All configured exporters run in parallel. The process reports an error only if every exporter fails.

#### MQTT

Publishes the full body composition payload as a JSON object to the configured topic.

**Home Assistant auto-discovery** is enabled by default — all 11 metrics register as sensors grouped under a single "BLE Scale" device. No manual YAML configuration needed.

```ini
MQTT_BROKER_URL=mqtt://localhost:1883
# MQTT_TOPIC=scale/body-composition
# MQTT_QOS=1
# MQTT_RETAIN=true
# MQTT_USERNAME=
# MQTT_PASSWORD=
# MQTT_CLIENT_ID=ble-scale-sync
# MQTT_HA_DISCOVERY=true
```

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

```bash
npm start                                 # Scan → read → export
DRY_RUN=true npm start                    # Read only, skip exports
DEBUG=true npm start                      # Verbose BLE logging
```

```powershell
# Windows PowerShell
$env:DRY_RUN="true"; npm start
$env:DEBUG="true"; npm start
```

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

| | c₁ | c₂ | c₃ | c₄ |
|---|---|---|---|---|
| Male | 0.503 | 0.165 | −0.158 | 17.8 |
| Male (athlete) | 0.637 | 0.205 | −0.180 | 12.5 |
| Female | 0.490 | 0.150 | −0.130 | 11.5 |
| Female (athlete) | 0.550 | 0.180 | −0.150 | 8.5 |

When impedance is unavailable (scale doesn't support BIA, or the user steps off before stabilization), body fat falls back to the Deurenberg equation:
`BF% = 1.2 × BMI + 0.23 × age − 10.8 × sex − 5.4` (sex: 1 = male, 0 = female; athlete: ×0.85)

Mi Scale 2 and Yunmai adapters bypass these formulas entirely and use the scale's own pre-computed values.

</details>

**Athlete mode** (`USER_IS_ATHLETE=true`) adjusts the model for higher lean body mass: increased BIA coefficients, higher water ratio (74% vs 73%), higher muscle ratio (60% vs 54%), BMR boost (+5%), and metabolic age capped at actual age − 5.

---

## Development

```bash
npm test                                   # 500+ tests (Vitest)
npx vitest run tests/calculator.test.ts    # Single file
npm run lint                               # ESLint
npm run format:check                       # Prettier check
```

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

1. Create `src/scales/your-brand.ts` implementing the `ScaleAdapter` interface
2. Register in `src/scales/index.ts` — ordering matters (specific adapters before the Standard GATT catch-all)
3. Add tests in `tests/scales/`

### Adding an exporter

1. Create `src/exporters/your-exporter.ts` implementing the `Exporter` interface
2. Add the name to `ExporterName` type and env parsing in `src/exporters/config.ts`
3. Add the factory case in `src/exporters/index.ts` → `createExporters()`
4. Add tests in `tests/exporters/`
5. Document config variables in `.env.example`

---

## Troubleshooting

<details>
<summary>"Permission denied" on Linux</summary>

```bash
sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))
```

</details>

<details>
<summary>Scale not found</summary>

- Step on the scale to wake it — most scales advertise for only 10–30 seconds after activation
- Verify `SCALE_MAC` matches the address shown by `npm run scan`
- Linux: confirm Bluetooth is running with `sudo systemctl start bluetooth`
- Auto-discovery works without `SCALE_MAC` on all platforms

</details>

<details>
<summary>Connection errors on Raspberry Pi</summary>

The app stops BLE discovery before connecting (BlueZ on low-power devices frequently aborts connections while discovery is active). If `le-connection-abort-by-local` persists:

```bash
sudo systemctl restart bluetooth
```

</details>

<details>
<summary>Garmin upload fails</summary>

- Re-run `npm run setup-garmin` to refresh tokens
- Verify `.env` credentials
- Try from a non-VPN residential network (Garmin rate-limits certain IP ranges)

</details>

<details>
<summary>Windows BLE issues</summary>

- The BLE adapter must use the [WinUSB driver](https://zadig.akeo.ie/) (not the default Windows Bluetooth driver)
- Run the terminal as Administrator if permission errors occur

</details>

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

**Scale protocols** — All 23 BLE adapters were ported from [openScale](https://github.com/oliexdev/openScale) by oliexdev. openScale is an open-source Android app that has reverse-engineered the BLE protocols of dozens of body composition scales over several years. The Java and Kotlin source code served as the primary reference for this project's adapter implementations — frame formats, byte-level offsets, multi-step handshake sequences, checksum algorithms, and manufacturer-specific quirks. This project would not exist without that foundational work.

**Garmin Connect upload** — Powered by [python-garminconnect](https://github.com/cyberjunky/python-garminconnect) by cyberjunky, a Python library for the unofficial Garmin Connect API. It handles OAuth authentication, session token management, and the body composition upload endpoint.

**Body composition formulas** — The BIA lean body mass model follows Lukaski (1986). Basal metabolic rate uses the Mifflin-St Jeor equation (1990). The impedance-free fallback for body fat percentage is based on the Deurenberg equation (1991). Athlete-mode adjustments follow published sports science adaptations of these models for individuals with above-average lean mass.

**BLE libraries** — [node-ble](https://github.com/chrvadala/node-ble) (Linux/BlueZ D-Bus) and [@abandonware/noble](https://github.com/abandonware/noble) (Windows/macOS) provide the low-level Bluetooth communication layer.

---

## License

GPL-3.0 — see [LICENSE](LICENSE).
