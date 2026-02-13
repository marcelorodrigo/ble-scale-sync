# Troubleshooting

## "Permission denied" on Linux

Make sure you've granted BLE capabilities to Node.js:

```bash
sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))
```

> After a Node.js update, you may need to re-apply this command.

## Scale not found

- Make sure the scale is powered on (step on it to wake it up).
- If using a specific `scale_mac`, verify the address matches (`npm run scan`).
- If using auto-discovery, ensure only one recognized scale is powered on nearby. Auto-discovery works on all platforms (Linux, macOS, Windows) — all adapters match by device name, so `scale_mac` is never required.
- On Linux, ensure the Bluetooth service is running: `sudo systemctl start bluetooth`.

## Connection errors on Raspberry Pi (le-connection-abort-by-local)

The app automatically stops BLE discovery before connecting, which resolves most `le-connection-abort-by-local` errors on low-power devices like Pi Zero 2W. If you still see connection failures, try restarting Bluetooth:

```bash
sudo systemctl restart bluetooth
```

## Scale was found before but now isn't discovered (Linux)

BlueZ (the Linux Bluetooth stack) can sometimes get into a state where it no longer reports a previously-seen device. To fix:

```bash
sudo systemctl restart bluetooth
```

Then step on the scale to wake it up and run `npm start` (or `npm run scan` to verify visibility first).

## Garmin upload fails

- Re-run `npm run setup-garmin` to refresh tokens.
- Check that your Garmin credentials are correct (in `config.yaml` or environment variables).
- If you're behind a VPN or on a restricted network, try authenticating from a different connection.

## Debug BLE output

Set `DEBUG=true` to see detailed BLE discovery logs (advertised services, discovered characteristics, UUID matching):

```bash
# Linux / macOS
DEBUG=true npm start

# Windows (PowerShell)
$env:DEBUG="true"; npm start
```

## Windows BLE issues

- The default BLE driver on Windows is `@abandonware/noble`, which works with the native Windows Bluetooth stack — no special driver setup needed.
- If you set `NOBLE_DRIVER=stoprocent`, you'll need the WinUSB driver (use [Zadig](https://zadig.akeo.ie/) to switch drivers).
- Run your terminal as Administrator if you encounter permission errors.

## Token Storage

By default, Garmin tokens are stored in `~/.garmin_tokens/`. You can change this with the `token_dir` field in the Garmin exporter config:

```yaml
global_exporters:
  - type: garmin
    token_dir: /custom/path/to/tokens
```

See [Exporters](exporters.md#garmin-connect) for full Garmin configuration details.
