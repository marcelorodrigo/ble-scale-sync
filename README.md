# ⚖️ BLE Scale Sync

> ⚠️ **Work in Progress** — Under active development. Expect breaking changes and rough edges.

**Step on your scale. Data lands in Garmin Connect. Done.**

A cross-platform CLI tool that reads body composition from any **BLE smart scale** and exports it wherever you need it. The ⭐ **killer feature** is **automatic Garmin Connect upload** — no phone app, no manual entry, no $150 Garmin Index scale. Just your cheap $30 BLE scale and a Raspberry Pi.

🏋️ **23 scale adapters** · 🖥️ **Linux / macOS / Windows** · 📡 **Garmin Connect + MQTT** · 🧮 **10 body composition metrics**

---

## 💡 Why This Exists

Garmin sells the **Index S2** scale (~$150) — Wi-Fi, notorious connectivity issues, inconsistent readings. Meanwhile, a $30 BLE scale has better hardware but no way to sync to Garmin Connect. The only workflow: open your phone app → wait for sync → manually type numbers into Garmin. Every. Single. Time.

I didn't want to depend on a phone app or buy an overpriced Garmin scale. So I built this.

A **Raspberry Pi Zero 2W** sits next to the scale, always on, always listening. Step on the scale, wait a few seconds, and the reading appears in Garmin Connect — **no phone, no app, no manual entry**. It just works.

---

## 🚀 Features

- ⭐ **Garmin Connect upload** — the only open-source tool that syncs cheap BLE scales directly to Garmin without a phone
- 📡 **MQTT export** — publish to Home Assistant, Node-RED, Grafana, or any MQTT broker
- 🔌 **Modular exporter system** — run multiple exports in parallel, add your own
- 🏋️ **23 scale adapters** — auto-detects your scale brand via BLE advertisement
- 🧮 **10 body metrics** — weight, BMI, body fat %, water %, bone mass, muscle mass, visceral fat, physique rating, BMR, metabolic age
- 🖥️ **Cross-platform** — Linux (Raspberry Pi), macOS, Windows
- 🔍 **Auto-discovery** — no config needed, just step on the scale
- 🏃 **Athlete mode** — adjusted formulas for active users

---

## 📐 How It Works

```
                                              ┌───────────────────┐
                                       ┌────> │  Garmin Connect ⭐│
┌──────────────┐      ┌──────────────┐ │      └───────────────────┘
│  BLE Scale   │ BLE  │  TypeScript  │ │      ┌───────────────────┐
│  (Bluetooth) │ ───> │  BLE + Body  │ ├────> │   MQTT Broker  📡 │
└──────────────┘      │  Composition │ │      └───────────────────┘
                      └──────────────┘ │      ┌───────────────────┐
                                       └────> │  Future exports…  │
                                              └───────────────────┘
```

1. **TypeScript** scans for a BLE scale using the OS-appropriate handler
2. Auto-detects the brand via adapter pattern and reads weight + impedance
3. Calculates 10 body composition metrics from BIA formulas
4. Dispatches results **in parallel** to all enabled exporters

---

## 📋 Supported Scales

| Brand / Model                                        | Protocol               |
| ---------------------------------------------------- | ---------------------- |
| **QN-Scale** / Renpho / Senssun / Sencor             | Custom (FFE0 / FFF0)   |
| **Renpho** ES-WBE28                                  | Vendor BCS/WSS         |
| **Renpho** ES-26BB                                   | Custom (1A10)          |
| **Xiaomi Mi Scale 2** (MIBCS / MIBFS)                | Vendor UUID            |
| **Yunmai** Signal / Mini / SE                        | Custom (FFE0)          |
| **Beurer** BF700 / BF710 / BF800                     | Custom (FFE0)          |
| **Sanitas** SBF70 / SBF75 / SBF72 / SBF73            | Custom (FFE0) / BCS    |
| **Beurer** BF915                                     | Standard BCS           |
| **Soehnle** Shape200 / Shape100 / Shape50 / Style100 | Custom UUID            |
| **Medisana** BS430 / BS440 / BS444                   | Custom (78B2)          |
| **Trisa** Body Analyze                               | Custom (7802)          |
| **Excelvan** CF369 (Electronic Scale)                | Custom (FFF0)          |
| **Hesley** (YunChen)                                 | Custom (FFF0)          |
| **Inlife** (fatscale)                                | Custom (FFF0)          |
| **Digoo** DG-SO38H (Mengii)                          | Custom (FFF0)          |
| **Senssun Fat**                                      | Custom (FFF0)          |
| **ES-CS20M**                                         | Custom (1A10)          |
| **Exingtech Y1** (vscale)                            | Custom UUID            |
| **1byone** / Eufy C1 / Eufy P1                       | Custom (FFF0 / FFB0)   |
| **Active Era** BS-06                                 | Custom (FFB0)          |
| **MGB** (Swan / Icomon / YG)                         | Custom (FFB0)          |
| **Hoffen** BS-8107                                   | Custom (FFB0)          |
| Any **standard BT SIG BCS/WSS** scale                | Standard (181B / 181D) |

> 💡 Don't see your scale? It might still work via the **Standard GATT** catch-all adapter. Try `npm run scan` first.

---

## 🛠️ Prerequisites

### All Platforms

- [Node.js](https://nodejs.org/) v20+
- [Python](https://python.org/) 3.9+ (for Garmin upload)
- Bluetooth Low Energy (BLE) adapter

### 🐧 Linux (Debian / Ubuntu / Raspberry Pi OS)

```bash
sudo apt-get update
sudo apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev build-essential python3-pip

# Install Node.js v20 (skip if already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Allow Node.js to access BLE without root
sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))
```

### 🍎 macOS

```bash
xcode-select --install          # Xcode command-line tools
brew install node@20             # Node.js via Homebrew
```

No additional Bluetooth setup needed — macOS uses CoreBluetooth natively.

### 🪟 Windows

1. Install [Node.js](https://nodejs.org/) v20+ (LTS installer, check "Add to PATH")
2. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) ("Desktop development with C++")
3. Install [Python](https://python.org/) (check "Add to PATH")
4. BLE adapter with [WinUSB driver](https://zadig.akeo.ie/) — see the [noble Windows guide](https://github.com/abandonware/noble#windows)

---

## 📦 Installation

```bash
git clone https://github.com/KristianP26/blescalesync.git
cd blescalesync

# Node.js dependencies
npm install

# Python virtual environment (for Garmin upload)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

> 📝 Modern Linux distros (Debian 12+, Ubuntu 23.04+, Raspberry Pi OS Bookworm) require a venv for pip. Remember to `source venv/bin/activate` before running `npm start`.

---

## ⚙️ Configuration

### 1️⃣ Create your `.env` file

```bash
cp .env.example .env
```

```ini
# 🔑 Garmin credentials
GARMIN_EMAIL=you@example.com
GARMIN_PASSWORD=your_password

# 👤 User profile
USER_HEIGHT=183
USER_BIRTH_DATE=2000-06-15
USER_GENDER=male
USER_IS_ATHLETE=true

# 📏 Units (optional, defaults to metric)
WEIGHT_UNIT=kg
HEIGHT_UNIT=cm
```

### 2️⃣ Find your scale (optional)

```bash
npm run scan
```

Scans for 15 seconds. Recognized scales are tagged (e.g. `[QN Scale]`, `[Mi Scale 2]`). Copy the MAC address into `.env`:

```ini
SCALE_MAC=FF:03:00:13:A1:04
```

> 🔒 **Recommended:** Set `SCALE_MAC` to avoid connecting to a neighbor's scale — BLE signals pass through walls.
>
> 🍎 On macOS, use the CoreBluetooth UUID shown by `npm run scan` instead of a MAC address.

### 3️⃣ Authenticate with Garmin Connect

```bash
npm run setup-garmin
```

One-time login — tokens are saved to `~/.garmin_tokens/` and reused automatically.

> 💡 If auth fails, Garmin may block your IP (cloud/VPN). Try from a different network, then copy `~/.garmin_tokens/` to your target machine.

### 4️⃣ Configure exporters (optional)

By default, only **Garmin Connect** is active:

```ini
EXPORTERS=garmin              # default
EXPORTERS=garmin,mqtt         # both in parallel
EXPORTERS=mqtt                # MQTT only
```

All exporters run in parallel. The app only fails if **all** exporters fail.

#### 📡 MQTT Exporter

Publishes the full body composition payload as JSON — perfect for **Home Assistant**, **Node-RED**, **Grafana**, or any MQTT-compatible system.

```ini
EXPORTERS=garmin,mqtt
MQTT_BROKER_URL=mqtt://localhost:1883
# MQTT_TOPIC=scale/body-composition
# MQTT_QOS=1
# MQTT_RETAIN=true
# MQTT_USERNAME=
# MQTT_PASSWORD=
# MQTT_CLIENT_ID=ble-scale-sync
```

| Variable          | Required                | Default                  | Description                         |
| ----------------- | ----------------------- | ------------------------ | ----------------------------------- |
| `MQTT_BROKER_URL` | Yes (when mqtt enabled) | —                        | Broker URL, e.g. `mqtt://host:1883` |
| `MQTT_TOPIC`      | No                      | `scale/body-composition` | Publish topic                       |
| `MQTT_QOS`        | No                      | `1`                      | QoS level (0, 1, or 2)              |
| `MQTT_RETAIN`     | No                      | `true`                   | Retain last message                 |
| `MQTT_USERNAME`   | No                      | —                        | Broker auth                         |
| `MQTT_PASSWORD`   | No                      | —                        | Broker auth                         |
| `MQTT_CLIENT_ID`  | No                      | `ble-scale-sync`         | Client identifier                   |

---

## 🏃 Usage

### Sync your scale

```bash
npm start
```

1. App scans for your scale (auto-discovery or by `SCALE_MAC`)
2. **Step on the scale** — wait for the reading to stabilize
3. Body composition is calculated and exported to all enabled targets

### Dry run (skip exports)

```bash
DRY_RUN=true npm start                    # Linux / macOS
$env:DRY_RUN="true"; npm start            # Windows PowerShell
```

### Debug mode

```bash
DEBUG=true npm start                      # Linux / macOS
$env:DEBUG="true"; npm start              # Windows PowerShell
```

---

## 🧮 What Gets Exported

| Metric          | Unit  | Formula                                                                |
| --------------- | ----- | ---------------------------------------------------------------------- |
| Weight          | kg    | Raw scale reading                                                      |
| BMI             | —     | `weight / (height_m)²`                                                 |
| Body Fat        | %     | BIA: `LBM = c1·(H²/Z) + c2·W + c3·A + c4`, `BF% = (W - LBM) / W × 100` |
| Water           | %     | `LBM × 0.73 / W × 100` (athlete: 0.74)                                 |
| Bone Mass       | kg    | `LBM × 0.042`                                                          |
| Muscle Mass     | kg    | `LBM × 0.54` (athlete: 0.60)                                           |
| Visceral Fat    | 1–59  | `BF% × 0.55 − 4 + age × 0.08`                                          |
| Physique Rating | 1–9   | Based on BF% and muscle/weight ratio                                   |
| BMR             | kcal  | Mifflin-St Jeor: `10W + 6.25H − 5A + s` (athlete: +5%)                 |
| Metabolic Age   | years | `age + (idealBMR − BMR) / 15`                                          |

<details>
<summary>📊 BIA coefficients</summary>

|                  | c1    | c2    | c3     | c4   |
| ---------------- | ----- | ----- | ------ | ---- |
| Male             | 0.503 | 0.165 | −0.158 | 17.8 |
| Male (athlete)   | 0.637 | 0.205 | −0.180 | 12.5 |
| Female           | 0.490 | 0.150 | −0.130 | 11.5 |
| Female (athlete) | 0.550 | 0.180 | −0.150 | 8.5  |

When impedance is unavailable, body fat uses the **Deurenberg** formula:
`BF% = 1.2 × BMI + 0.23 × age − 10.8 × sex − 5.4` (sex: 1 = male, 0 = female; athlete: ×0.85)

Scales that report their own body composition (Mi Scale 2, Yunmai) use those values directly.

</details>

---

## 🏋️ Athlete Mode

`USER_IS_ATHLETE=true` adjusts the calculation constants for active users:

- 💪 **Lean Body Mass** — higher coefficients
- 💧 **Water** — 74% vs 73% of LBM
- 🦴 **Muscle Mass** — 60% vs 54% of LBM
- 🔥 **BMR** — +5% boost
- 📅 **Metabolic Age** — capped at actual age − 5

---

## 🧑‍💻 Development

### Testing

```bash
npm test                    # All 500+ tests (Vitest)
npx vitest run tests/calculator.test.ts   # Single file
```

Covers: body comp math, env validation, all 23 scale adapters, exporter config/Garmin/MQTT/registry.

### Linting & Formatting

```bash
npm run lint                # ESLint
npm run lint:fix            # ESLint auto-fix
npm run format              # Prettier format
npm run format:check        # Prettier check (CI)
```

---

## 🗂️ Project Structure

```
blescalesync/
├── src/
│   ├── index.ts                    # 🎯 Main orchestrator
│   ├── ble/                        # 📶 BLE layer (OS-specific handlers)
│   │   ├── index.ts                #    OS detection + dynamic import
│   │   ├── handler-node-ble.ts     #    🐧 Linux (BlueZ D-Bus)
│   │   ├── handler-noble.ts        #    🍎🪟 macOS / Windows (noble)
│   │   ├── shared.ts               #    Shared BLE abstractions
│   │   └── types.ts                #    Types, constants, utilities
│   ├── exporters/                   # 📤 Modular export system
│   │   ├── index.ts                #    Exporter registry
│   │   ├── config.ts               #    EXPORTERS env parsing
│   │   ├── garmin.ts               #    ⭐ Garmin Connect (Python subprocess)
│   │   └── mqtt.ts                 #    📡 MQTT broker
│   ├── scales/                      # ⚖️ 23 scale adapters
│   │   ├── index.ts                #    Adapter registry
│   │   ├── body-comp-helpers.ts    #    Shared BIA formulas
│   │   └── *.ts                    #    One file per scale brand
│   ├── interfaces/                  # 📝 TypeScript interfaces
│   │   ├── scale-adapter.ts        #    ScaleAdapter + types
│   │   └── exporter.ts             #    Exporter interface
│   ├── calculator.ts               # 🧮 Body composition math
│   ├── validate-env.ts             # ✅ .env validation
│   └── scan.ts                     # 🔍 BLE scanner utility
├── tests/                           # 🧪 500+ tests (Vitest)
├── garmin-scripts/                  # 🐍 Python (Garmin upload + setup)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## ➕ Adding a New Scale

1. Create `src/scales/your-brand.ts` implementing `ScaleAdapter`
2. Define `matches()` to recognize the device by BLE name
3. Implement `parseNotification()` for the brand's data protocol
4. Register in `src/scales/index.ts` (before the Standard GATT catch-all)
5. Add tests in `tests/scales/`

## ➕ Adding a New Exporter

1. Create `src/exporters/your-exporter.ts` implementing `Exporter`
2. Add the name to `ExporterName` type in `src/exporters/config.ts`
3. Add env var parsing in `config.ts`
4. Add a case in `createExporters()` in `src/exporters/index.ts`
5. Add tests in `tests/exporters/`
6. Update `.env.example`

---

## 🔧 Troubleshooting

<details>
<summary>🐧 "Permission denied" on Linux</summary>

```bash
sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))
```

</details>

<details>
<summary>🔍 Scale not found</summary>

- Step on the scale to wake it up
- Verify `SCALE_MAC` matches (`npm run scan`)
- On Linux: `sudo systemctl start bluetooth`
- Auto-discovery works on all platforms — `SCALE_MAC` is never required

</details>

<details>
<summary>🍇 Connection errors on Raspberry Pi (le-connection-abort-by-local)</summary>

The app automatically stops discovery before connecting. If issues persist:

```bash
sudo systemctl restart bluetooth
```

</details>

<details>
<summary>🔍 Scale was found before but now isn't discovered (Linux)</summary>

BlueZ can get into a stale state. Fix:

```bash
sudo systemctl restart bluetooth
```

Step on the scale, then run `npm start`. Re-apply setcap after Node.js updates.

</details>

<details>
<summary>⭐ Garmin upload fails</summary>

- Re-run `npm run setup-garmin` to refresh tokens
- Check credentials in `.env`
- Try authenticating from a non-VPN network

</details>

<details>
<summary>🪟 Windows BLE issues</summary>

- Bluetooth adapter must use WinUSB driver ([Zadig](https://zadig.akeo.ie/))
- Run terminal as Administrator if needed

</details>

---

## 🏅 Recommended Setup

| Component   | Recommendation                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| 🖥️ Computer | [Raspberry Pi Zero 2W](https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/) — $15, tiny, built-in BLE, ~0.4W idle |
| ⚖️ Scale    | Any supported BLE scale (see table above)                                                                                 |
| 💿 OS       | Raspberry Pi OS Lite (headless)                                                                                           |

---

## 🙏 Credits

**Scale Protocols** — Ported from [openScale](https://github.com/oliexdev/openScale) by oliexdev. All 23 adapters cross-referenced against the Java/Kotlin source.

**Garmin Connect** — Powered by [garminconnect](https://github.com/cyberjunky/python-garminconnect) by cyberjunky (Ron Klinkien).

**Formulas** — BIA (Lukaski 1986), Mifflin-St Jeor (1990), Deurenberg (1991).

---

## 📄 License

GPL-3.0 — see [LICENSE](LICENSE) for details.
