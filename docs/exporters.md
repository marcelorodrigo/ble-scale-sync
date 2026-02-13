# Exporters

BLE Scale Sync supports 5 export targets. Each exporter is configured as an entry in `global_exporters` (shared by all users) or per-user `exporters` (overrides global for that user). All enabled exporters run in parallel. The process reports an error only if **every** exporter fails.

> **Per-user exporters:** If a user defines their own `exporters` list, it completely replaces `global_exporters` for that user. Exporters are deduped by type — if the same type appears in both global and per-user, the per-user config wins.

## Export Targets

| Target             | Description                                                         | Protocol          | Auth                             |
| ------------------ | ------------------------------------------------------------------- | ----------------- | -------------------------------- |
| **Garmin Connect** | Automatic body composition upload — no phone app needed             | Python subprocess | Email + password (tokens cached) |
| **MQTT**           | Home automation integration with **Home Assistant auto-discovery**  | MQTT 5.0          | Optional username/password       |
| **Webhook**        | Generic HTTP endpoint — n8n, Make, Zapier, custom APIs              | HTTP POST/PUT     | Custom headers                   |
| **InfluxDB**       | Time-series database (v2 write API, line protocol)                  | HTTP              | Token                            |
| **Ntfy**           | Push notifications to phone/desktop via [ntfy.sh](https://ntfy.sh) | HTTP              | Optional Bearer/Basic            |

## Garmin Connect

Uploads body composition to Garmin Connect via Python subprocess with saved tokens.

| Field       | Required | Default               | Description                      |
| ----------- | -------- | --------------------- | -------------------------------- |
| `email`     | No       | `GARMIN_EMAIL` env    | Garmin account email             |
| `password`  | No       | `GARMIN_PASSWORD` env | Garmin account password          |
| `token_dir` | No       | `~/.garmin_tokens`    | Directory for cached auth tokens |

**First-time setup:** Run `npm run setup-garmin` to authenticate and cache tokens. You only need to do this once — tokens are reused for subsequent syncs.

> **If authentication fails:** Garmin may block requests from certain IPs (especially cloud/VPN IPs). Try running the setup from a different network, then copy the `~/.garmin_tokens/` directory to your target machine.

### Token Storage

By default, Garmin tokens are stored in `~/.garmin_tokens/`. You can change this with the `token_dir` field:

```yaml
global_exporters:
  - type: garmin
    token_dir: /custom/path/to/tokens
```

## MQTT

Publishes the full body composition payload as JSON to the configured topic. **Home Assistant auto-discovery** is enabled by default — all 11 metrics appear as sensors grouped under a single device. Includes availability tracking (LWT), display precision per metric, and diagnostic entity categories.

| Field            | Required | Default                  | Description                                           |
| ---------------- | -------- | ------------------------ | ----------------------------------------------------- |
| `broker_url`     | Yes      | —                        | Broker URL (`mqtt://host:1883` or `mqtts://` for TLS) |
| `topic`          | No       | `scale/body-composition` | Publish topic                                         |
| `qos`            | No       | `1`                      | QoS level (0, 1, or 2)                                |
| `retain`         | No       | `true`                   | Retain last message on broker                         |
| `username`       | No       | —                        | Broker auth username                                  |
| `password`       | No       | —                        | Broker auth password                                  |
| `client_id`      | No       | `ble-scale-sync`         | MQTT client identifier                                |
| `ha_discovery`   | No       | `true`                   | Home Assistant auto-discovery                         |
| `ha_device_name` | No       | `BLE Scale`              | Device name in Home Assistant                         |

## Webhook

Sends the full body composition payload as JSON to any HTTP endpoint. Useful for automation platforms (n8n, Make, Zapier, custom APIs).

| Field     | Required | Default | Description                  |
| --------- | -------- | ------- | ---------------------------- |
| `url`     | Yes      | —       | Target URL                   |
| `method`  | No       | `POST`  | HTTP method                  |
| `headers` | No       | —       | Custom headers (YAML object) |
| `timeout` | No       | `10000` | Request timeout in ms        |

## InfluxDB

Writes body composition metrics to InfluxDB v2 using line protocol. Float fields use 2 decimal places, integer fields use InfluxDB's `i` suffix.

| Field         | Required | Default            | Description                 |
| ------------- | -------- | ------------------ | --------------------------- |
| `url`         | Yes      | —                  | InfluxDB server URL         |
| `token`       | Yes      | —                  | API token with write access |
| `org`         | Yes      | —                  | Organization name           |
| `bucket`      | Yes      | —                  | Destination bucket          |
| `measurement` | No       | `body_composition` | Measurement name            |

## Ntfy

Sends a human-readable push notification via [ntfy](https://ntfy.sh). Works with ntfy.sh or self-hosted.

| Field      | Required | Default             | Description         |
| ---------- | -------- | ------------------- | ------------------- |
| `url`      | No       | `https://ntfy.sh`   | Ntfy server URL     |
| `topic`    | Yes      | —                   | Topic name          |
| `title`    | No       | `Scale Measurement` | Notification title  |
| `priority` | No       | `3`                 | Priority (1-5)      |
| `token`    | No       | —                   | Bearer token auth   |
| `username` | No       | —                   | Basic auth username |
| `password` | No       | —                   | Basic auth password |

## Full Configuration Example

See [`config.yaml.example`](../config.yaml.example) for an annotated template with all exporters.

```yaml
version: 1

ble:
  scale_mac: 'FF:03:00:13:A1:04' # Optional — omit for auto-discovery
  # noble_driver: abandonware       # Optional — "abandonware" | "stoprocent"

scale:
  weight_unit: kg # kg | lbs (display only — all calculations use kg)
  height_unit: cm # cm | in (for height input)

# Multi-user matching: when weight falls outside all ranges
# "nearest" = assign to closest range midpoint, "log" = log warning + skip, "ignore" = silently skip
unknown_user: nearest

users:
  - name: Alice
    slug: alice
    height: 168
    birth_date: '1995-03-20'
    gender: female
    is_athlete: false
    weight_range: { min: 50, max: 75 }
    last_known_weight: null # Updated automatically after each measurement
    # Per-user exporters (optional — override global_exporters for this user)
    # exporters:
    #   - type: garmin
    #     email: alice@example.com
    #     password: "${GARMIN_PASSWORD}"
    #     token_dir: ./garmin-tokens/alice

  - name: Bob
    slug: bob
    height: 183
    birth_date: '1990-06-15'
    gender: male
    is_athlete: true
    weight_range: { min: 75, max: 100 }
    last_known_weight: 85.5

global_exporters:
  - type: garmin
    email: your_email@example.com
    password: '${GARMIN_PASSWORD}' # ${ENV_VAR} references are resolved at load time
    token_dir: ~/.garmin_tokens

  - type: mqtt
    broker_url: 'mqtt://localhost:1883'
    topic: scale/body-composition
    qos: 1
    retain: true
    username: myuser
    password: '${MQTT_PASSWORD}'
    client_id: ble-scale-sync
    ha_discovery: true
    ha_device_name: BLE Scale

  # - type: webhook
  #   url: "https://example.com/hook"
  #   method: POST
  #   headers:
  #     X-Api-Key: secret123
  #   timeout: 10000

  # - type: influxdb
  #   url: "http://localhost:8086"
  #   token: "${INFLUXDB_TOKEN}"
  #   org: my-org
  #   bucket: my-bucket
  #   measurement: body_composition

  # - type: ntfy
  #   url: "https://ntfy.sh"
  #   topic: my-scale
  #   title: Scale Measurement
  #   priority: 3

runtime:
  continuous_mode: false
  scan_cooldown: 30
  dry_run: false
  debug: false
```

YAML values support `${ENV_VAR}` references — useful for secrets (passwords, tokens). The referenced environment variable must be defined, otherwise config loading fails with an error.

## Environment Overrides

These environment variables always override the corresponding `config.yaml` values:

| Variable          | Overrides                 |
| ----------------- | ------------------------- |
| `CONTINUOUS_MODE` | `runtime.continuous_mode` |
| `DRY_RUN`         | `runtime.dry_run`         |
| `DEBUG`           | `runtime.debug`           |
| `SCAN_COOLDOWN`   | `runtime.scan_cooldown`   |
| `SCALE_MAC`       | `ble.scale_mac`           |
| `NOBLE_DRIVER`    | `ble.noble_driver`        |

> **Legacy:** `.env` is also supported as a fallback — see `.env.example`. If both files exist, `config.yaml` takes priority.

## Healthchecks

At startup, exporters with a healthcheck are tested for connectivity — failures are logged as warnings but don't block the scan.

| Exporter   | Healthcheck              |
| ---------- | ------------------------ |
| MQTT       | Connect + disconnect     |
| Webhook    | HEAD request             |
| InfluxDB   | `/health` endpoint       |
| Ntfy       | `/v1/health` endpoint    |
| Garmin     | None (Python subprocess) |
