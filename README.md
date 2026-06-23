# ioBroker.ta

<p align="center">
  <img src="admin/ta.png" alt="ioBroker.ta adapter icon" width="160">
</p>

[![NPM version](https://img.shields.io/npm/v/iobroker.ta.svg)](https://www.npmjs.com/package/iobroker.ta)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ta.svg)](https://www.npmjs.com/package/iobroker.ta)
![Number of Installations](https://iobroker.live/badges/ta-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/ta-stable.svg)

**Tests:** ![Test and Release](https://github.com/dude2k/ioBroker.ta/workflows/Test%20and%20Release/badge.svg)

## Technische Alternative adapter for ioBroker

This adapter reads values from CAN devices through a Technische Alternative C.M.I. JSON API endpoint and exposes them as read-only ioBroker states.

The repository is named `ioBroker.ta`, the npm package is `iobroker.ta`, and the internal ioBroker adapter ID is `ta`. Object IDs therefore use the namespace `ta.0`, for example `ta.0.info.connection`.

This is an unofficial, community-maintained adapter. It is neither an official ioBroker adapter nor an official adapter or official software from Technische Alternative. Product and project names are used only to describe compatibility.

The project does not include copied manufacturer documentation, manufacturer logos, ioBroker logos or other third-party brand assets. The adapter icon is a generic project asset and must not be replaced with protected logos unless the required rights are available.

## Supported source

- Technische Alternative C.M.I. JSON API at `/INCLUDE/api.cgi`
- UVR16x2 and further x2/CAN devices recognized by the C.M.I. API
- Device ID mapping currently includes UVR1611, UVR16x2, RSM610, CAN-I/O45, CAN-EZ2, CAN-MTx2, CAN-BC2, UVR65, CAN-EZ3, UVR610 and UVR67
- The C.M.I. itself is used as the gateway. Its own CAN node number should not be configured as a data node.

Version 1.x focuses only on read-only C.M.I. JSON API polling and a stable generic ioBroker state model. It does not implement C.M.I. control commands, output switching, fixed value changes, dashboards, VIS widgets or a custom web server.

## Configuration

- `host`: C.M.I. hostname or IP address
- `port`: C.M.I. HTTP/HTTPS port, default `80`
- `protocol`: `http` or `https`
- `username`: C.M.I. expert user
- `password`: C.M.I. expert password, stored as protected/encrypted native config
- `timeoutMs`: request timeout, default `10000`
- `rejectUnauthorized`: reject invalid HTTPS certificates
- `requestSpacingSec`: global spacing between requests to the same C.M.I., minimum `61`, default `65`
- `startupDelaySec`: delay before the first poll
- `retryDelaySec`: delay after network errors or CAN busy responses
- `nodes`: CAN nodes to query. Enter the node numbers of the controllers/devices that deliver values, for example UVR16x2, UVR610 or RSM610. Do not enter the C.M.I. own CAN node number; the C.M.I. is the gateway, not a data node for this adapter.
- `jsonparam`: C.M.I. JSON API parameter list, default `I,O,Sg,Sd,St,Ss`
- `useDesignation`: adds `jsondesignation=1` and uses designations for `common.name`
- `createRawJson`: stores the raw response below the node info channel for debugging

The C.M.I. JSON API allows only one request per minute. This adapter enforces a global request queue per adapter instance. If three nodes are enabled and `requestSpacingSec` is `65`, each node is updated roughly every `195` seconds.

## Object tree example

```text
ta.0.info.connection
ta.0.info.lastUpdate
ta.0.info.lastSuccessfulUpdate
ta.0.info.lastError
ta.0.info.lastStatusCode
ta.0.info.lastStatusText
ta.0.info.effectiveNodeIntervalSec
ta.0.node_002.info.apiVersion
ta.0.node_002.info.deviceId
ta.0.node_002.info.deviceName
ta.0.node_002.info.timestamp
ta.0.node_002.input_001.value
ta.0.node_002.input_001.unitId
ta.0.node_002.input_001.ad
ta.0.node_002.input_001.designation
ta.0.node_002.output_001.value
ta.0.node_002.output_001.state
ta.0.node_002.output_001.unitId
ta.0.node_002.output_001.ad
ta.0.node_002.system_general_001.value
ta.0.node_002.logging_analog_001.value
```

State IDs are stable and never depend on C.M.I. designations. Designations only update `common.name`.

## Troubleshooting

- `Authentication failed; C.M.I. expert credentials required`: check the expert user credentials in the C.M.I.
- `SYNTAX ERROR` or `NODE ERROR` for the C.M.I. own CAN node: remove or disable that node from the adapter configuration and configure only the CAN node numbers of the target controllers/devices.
- `NODE ERROR`: the configured CAN node did not answer or is not reachable through the C.M.I.
- `DEVICE NOT SUPPORTED`: the target device is not supported by this C.M.I. API response.
- `TOO MANY REQUESTS`: another client or adapter instance may be polling too quickly. Increase `requestSpacingSec`.
- `CAN BUSY`: the CAN bus is busy. The adapter waits for `retryDelaySec` before the next request.
- HTTP errors: verify protocol, host, port and firewall settings.
- If the admin test connection succeeds but `ta.0.info.lastError` reports one CAN node, check whether that node really exposes values through the C.M.I. JSON API. Other successfully polled nodes keep `ta.0.info.connection` true.

## Development

```bash
npm run lint
npm run build
npm run test:unit
npm run test:integration
npm test
```

Tests use mocked HTTP servers and fixtures under `test/fixtures/`. No real C.M.I. hardware or credentials are required.

The CI workflow runs linting, type checks, builds and adapter tests on Linux, Windows and macOS for the Node.js LTS versions supported by the generated ioBroker template.

## Similar adapters

There are existing ioBroker adapters and integrations around BL-NET/C.M.I. devices. This adapter deliberately focuses on the official C.M.I. JSON API and creates a generic, stable, read-only ioBroker object model for C.M.I. CAN/x2 data.

## Manufacturer/API references

- Technische Alternative: https://www.ta.co.at/
- C.M.I. product and documentation pages: https://www.ta.co.at/x2-frei-programmierbare-regelung/cmi/

## Changelog

### 0.0.7

- Replace the adapter icon and show it in the README.

### 0.0.6

- Clarify that the C.M.I. is the gateway and should not be configured as a data node.
- Add explicit unofficial-project and third-party asset/copyright notes.

### 0.0.5

- Map plain C.M.I. system group names like `general`, `date`, `time` and `sun`.
- Keep the global connection state true when at least one configured CAN node polls successfully.

### 0.0.4

- Send `jsonparam` with literal commas to avoid C.M.I. `SYNTAX ERROR` responses.

### 0.0.3

- Document that the configured nodes are target CAN devices, not the C.M.I. own CAN address.

### 0.0.2

- Log C.M.I. status errors with CAN node context.

### 0.0.1

- Initial release.

## License

MIT License. See [LICENSE](LICENSE).
