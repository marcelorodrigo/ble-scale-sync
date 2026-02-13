# Multi-User Support

When using `config.yaml` with multiple users, the app automatically identifies who stepped on the scale based on the measured weight. Each user defines a `weight_range` in their config:

```yaml
users:
  - name: Alice
    weight_range:
      min: 50
      max: 70
    last_known_weight: null
  - name: Bob
    weight_range:
      min: 75
      max: 100
    last_known_weight: 85.5
```

## Weight Matching Algorithm

### Matching Priority (4 tiers)

1. **Single user** — always matches (warns if weight is outside the configured range)
2. **Exact range match** — one user's range contains the weight
3. **Overlapping ranges** — multiple users match; tiebreak by `last_known_weight` proximity, then config order
4. **No range match** — matches the user with the closest `last_known_weight`

If none of the above produce a match, the `unknown_user` strategy applies:

| Strategy            | Behavior                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| `nearest` (default) | Picks the user whose range midpoint is closest to the weight (with a warning) |
| `log`               | Logs a warning and skips the measurement                                      |
| `ignore`            | Silently skips the measurement                                                |

## Drift Detection

After matching, the app checks if the weight falls in the outer 10% of the user's range and logs a warning. This helps you notice when a user's typical weight is drifting toward a range boundary, so you can adjust the config before mismatches occur.

## Automatic Weight Tracking

After each successful measurement, the user's `last_known_weight` is automatically updated in `config.yaml`. This improves future matching accuracy for overlapping ranges. Updates are debounced (5 seconds) and skipped if the change is less than 0.5 kg.

## Execution Flow

When 2+ users are configured, the main loop uses a different execution path:

1. **Raw scan** — `scanAndReadRaw()` reads weight + impedance without computing body composition
2. **User matching** — `matchUserByWeight()` identifies who stepped on the scale (4-tier priority)
3. **Drift detection** — warns if weight is near the boundary of the matched user's range
4. **Body composition** — computes metrics using the matched user's profile (height, age, gender, athlete)
5. **Per-user exporters** — resolves and caches exporters for the matched user (user-level + global, deduped by type)
6. **Export with context** — dispatches to all exporters with `ExportContext` (user name, slug, config, drift warning)
7. **Weight tracking** — updates `last_known_weight` in `config.yaml` (debounced, atomic write)

## Per-Exporter Multi-User Behavior

| Exporter     | Multi-user behavior                                                       |
| ------------ | ------------------------------------------------------------------------- |
| **MQTT**     | Publishes to `{topic}/{slug}`, per-user HA device discovery + LWT        |
| **InfluxDB** | Adds `user={slug}` tag to line protocol                                  |
| **Webhook**  | Adds `user_name` + `user_slug` fields to JSON payload                    |
| **Ntfy**     | Prepends `[{name}]` to notification, appends drift warning if present    |
| **Garmin**   | Unchanged (one Garmin account per user via per-user exporter config)      |

## SIGHUP Config Reload

On Linux/macOS, sending `SIGHUP` to the process triggers a config reload between scan cycles:

```bash
kill -HUP $(pgrep -f "ble-scale-sync")
```

The reload acquires the write lock (to avoid conflicting with `last_known_weight` writes), re-validates the YAML via Zod, and clears the exporter cache. If validation fails, the previous config is kept.

## Heartbeat

At the start of each scan cycle, the process writes the current ISO timestamp to `/tmp/.ble-scale-sync-heartbeat`. This can be used for Docker health checks or monitoring.
