# API Reference — Omada Controller Web API v2

All endpoints are relative to the base URL:

```
https://{controllerIp}/{controllerId}/api/v2/sites/{siteId}
```

Every request must include:
- **Header:** `Csrf-Token: {token}`
- **Cookie:** `TPOMADA_SESSIONID={value}`
- **URL param:** `?token={token}` (append with `&token=` if other params exist)

### Related Docs
- **[PITFALLS.md](PITFALLS.md)** — 31 hard-won pitfalls for this API
- **[CHANGELOG.md](CHANGELOG.md)** — version history and what's new

---

## Authentication

These endpoints are called **before** obtaining the site ID.

### Get Controller Info

```
GET https://{controllerIp}/api/info
```

No authentication required.

**Response:**
```json
{
  "errorCode": 0,
  "result": {
    "omadacId": "YOUR_CONTROLLER_ID",
    "controllerVer": "6.1.0.19",
    "apiVer": "1.0",
    "type": 1
  }
}
```

### Login

```
POST https://{controllerIp}/{controllerId}/api/v2/login
Content-Type: application/json
```

**Request body:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response:**
```json
{
  "errorCode": 0,
  "result": {
    "token": "csrf-token-value"
  }
}
```

The response also includes a `Set-Cookie` header with `TPOMADA_SESSIONID`. Store it for all subsequent requests.

### List Sites

```
GET https://{controllerIp}/{controllerId}/api/v2/sites?token={token}&currentPage=1&currentPageSize=100
```

**Response:**
```json
{
  "errorCode": 0,
  "result": {
    "data": [
      {
        "id": "YOUR_SITE_ID",
        "name": "Default"
      }
    ]
  }
}
```

---

## Networks / VLANs

### List Networks

```
GET /setting/lan/networks?currentPage=1&currentPageSize=100
```

**Response item:**
```json
{
  "id": "YOUR_NETWORK_ID",
  "name": "Trusted",
  "purpose": "Interface",
  "vlanId": 10,
  "subnet": "192.168.10.0",
  "cidr": 24,
  "gatewayIp": "192.168.10.1",
  "dhcpEnabled": true,
  "dhcpStart": "192.168.10.100",
  "dhcpEnd": "192.168.10.254",
  "domain": ""
}
```

### Create Network

```
POST /setting/lan/networks
```

**Request body:**
```json
{
  "name": "Trusted",
  "purpose": "Interface",
  "vlanId": 10,
  "subnet": "192.168.10.0",
  "cidr": 24,
  "gatewayIp": "192.168.10.1",
  "dhcpEnabled": true,
  "dhcpStart": "192.168.10.100",
  "dhcpEnd": "192.168.10.254",
  "domain": ""
}
```

### Modify Network (DHCP, etc.)

```
PATCH /setting/lan/networks/{networkId}
```

**Important:** Send the full network object, not just changed fields. GET first, modify, then PATCH.

---

## Gateway ACL Rules (Firewall)

Gateway ACLs control traffic between VLANs at the router/firewall level.

### List Gateway ACLs

```
GET /setting/firewall/acls?type=0&currentPage=1&currentPageSize=100
```

**Response structure:**
```json
{
  "errorCode": 0,
  "result": {
    "totalRows": 14,
    "currentPage": 1,
    "currentSize": 100,
    "data": [ /* array of ACL rule objects */ ],
    "aclDisable": false
  }
}
```

**Note:** `aclDisable: true` means ACLs are **globally disabled** — rules exist but are not enforced.

**ACL rule object:**
```json
{
  "id": "rule-id-here",
  "type": 0,
  "index": 1,
  "name": "Allow-AirPlay",
  "status": true,
  "policy": 1,
  "protocols": [6, 17],
  "sourceType": 0,
  "sourceIds": ["YOUR_NETWORK_ID_TRUSTED"],
  "destinationType": 2,
  "destinationIds": ["YOUR_IPGROUP_ID"],
  "customAclPorts": [],
  "customAclDevices": [],
  "direction": {
    "lanToWan": false,
    "lanToLan": true,
    "wanInIds": [],
    "vpnInIds": []
  },
  "stateMode": 0,
  "syslog": false,
  "resource": 0
}
```

### Create Gateway ACL

```
POST /setting/firewall/acls
```

#### Example: Deny inter-VLAN traffic (Network → Network)

```json
{
  "name": "Deny-IoT-InterVLAN",
  "status": true,
  "policy": 0,
  "protocols": [6, 17, 1],
  "sourceType": 0,
  "sourceIds": ["YOUR_NETWORK_ID_IOT"],
  "destinationType": 0,
  "destinationIds": [
    "YOUR_NETWORK_ID_TRUSTED",
    "YOUR_NETWORK_ID_WORK",
    "YOUR_NETWORK_ID_ENTERTAINMENT",
    "YOUR_NETWORK_ID_GUESTS"
  ],
  "direction": {
    "wanInIds": [],
    "vpnInIds": [],
    "lanToWan": false,
    "lanToLan": true
  },
  "type": 0,
  "biDirectional": false,
  "stateMode": 0,
  "ipSec": 0,
  "syslog": false,
  "customAclDevices": [],
  "customAclOsws": [],
  "customAclStacks": []
}
```

#### Example: Allow specific traffic with IP/Port Group

```json
{
  "name": "Allow-AirPlay",
  "status": true,
  "policy": 1,
  "protocols": [6, 17],
  "sourceType": 0,
  "sourceIds": ["YOUR_NETWORK_ID_TRUSTED"],
  "destinationType": 2,
  "destinationIds": ["YOUR_IPGROUP_ID_AIRPLAY"],
  "direction": {
    "wanInIds": [],
    "vpnInIds": [],
    "lanToWan": false,
    "lanToLan": true
  },
  "type": 0,
  "biDirectional": false,
  "stateMode": 0,
  "ipSec": 0,
  "syslog": false,
  "customAclDevices": [],
  "customAclOsws": [],
  "customAclStacks": []
}
```

### ACL Field Reference

| Field | Type | Values |
|-------|------|--------|
| `name` | string | Rule name (display only) |
| `status` | boolean | `true` = enabled, `false` = disabled |
| `policy` | integer | `0` = Deny, `1` = Permit |
| `protocols` | int[] | `[6]` = TCP, `[17]` = UDP, `[1]` = ICMP, `[6,17,1]` = all three |
| `sourceType` | integer | `0` = Network |
| `sourceIds` | string[] | Array of network IDs |
| `destinationType` | integer | `0` = Network, `2` = IP/Port Group |
| `destinationIds` | string[] | Array of network IDs or IP/Port group IDs |
| `direction.lanToLan` | boolean | `true` = LAN-to-LAN rule |
| `direction.lanToWan` | boolean | `true` = LAN-to-WAN rule |
| `direction.wanInIds` | string[] | WAN interface IDs for WAN-in rules |
| `direction.vpnInIds` | string[] | VPN interface IDs for VPN-in rules |
| `type` | integer | `0` = Gateway ACL |
| `biDirectional` | boolean | Apply rule in both directions |
| `stateMode` | integer | `0` = Auto (stateful: new/established/related) |
| `ipSec` | integer | `0` = no IPSec filter |
| `syslog` | boolean | Log matches to syslog |
| `index` | integer | Rule position (read-only, first match wins) |

---

## IP/Port Groups

IP/Port Groups allow port-based filtering in Gateway ACLs (which otherwise only support protocol filtering).

### How It Works

1. Create an IP/Port Group with target IPs and ports
2. Reference the group ID in ACL rules using `destinationType: 2`

### Create IP/Port Group

```
POST /setting/firewall/ipGroups
```

**Request body:**
```json
{
  "name": "AirPlay-Ports",
  "type": 1,
  "ipList": [
    {
      "ip": "192.168.40.0/24",
      "portList": ["7000-7100", "5353"]
    }
  ]
}
```

**Field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Group name |
| `type` | integer | `1` = IP/Port Group |
| `ipList` | array | List of IP + port combinations |
| `ipList[].ip` | string | Target IP or CIDR subnet |
| `ipList[].portList` | string[] | **Strings, not numbers.** Port ranges use hyphen: `"7000-7100"` |

### List IP/Port Groups

```
GET /setting/firewall/ipGroups?currentPage=1&currentPageSize=100
```

---

## mDNS Reflector

The mDNS reflector enables service discovery (Bonjour, AirPlay, Chromecast, etc.) across VLANs.

### List mDNS Rules

```
GET /setting/service/mdns
```

**Response:**
```json
{
  "errorCode": 0,
  "result": {
    "totalRows": 1,
    "data": [
      {
        "id": "rule-id-here",
        "name": "AirPlay-mDNS",
        "status": true,
        "type": 1,
        "osg": {
          "profileIds": ["buildIn-1"],
          "serviceNetworks": ["YOUR_NETWORK_ID_ENTERTAINMENT"],
          "clientNetworks": ["YOUR_NETWORK_ID_TRUSTED"]
        },
        "resource": 0
      }
    ],
    "apRuleNum": 0,
    "osgRuleNum": 1,
    "apRuleLimit": 16,
    "osgRuleLimit": 20
  }
}
```

### mDNS Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Rule name |
| `status` | boolean | Enable/disable |
| `type` | integer | `1` = OSG (gateway) rule, `0` = AP rule |
| `osg.profileIds` | string[] | Service profiles. Known values: `"buildIn-1"` = AirPlay |
| `osg.serviceNetworks` | string[] | Network IDs where services are **provided** (e.g., TVs, speakers) |
| `osg.clientNetworks` | string[] | Network IDs where clients **discover** services (e.g., phones, laptops) |
| `resource` | integer | `0` observed (meaning unknown) |

**Limits:** `osgRuleLimit: 20` (max 20 gateway mDNS rules), `apRuleLimit: 16` (max 16 AP mDNS rules).

---

## WLANs / SSIDs

WLANs have a two-level hierarchy: **WLAN Groups** contain **SSIDs**.

### List WLAN Groups

```
GET /setting/wlans?currentPage=1&currentPageSize=100
```

Returns WLAN groups (e.g., "Default"). Each group has an `id` used in SSID endpoints.

### List SSIDs in a WLAN Group

```
GET /setting/wlans/{wlanGroupId}/ssids
```

### Create SSID

```
POST /setting/wlans/{wlanGroupId}/ssids
```

**Full request body (all required fields):**
```json
{
  "name": "MySSID",
  "band": 3,
  "type": 0,
  "guestNetEnable": false,
  "security": 3,
  "broadcast": true,
  "vlanSetting": {
    "mode": 1,
    "customConfig": { "vlanId": 10 }
  },
  "pskSetting": {
    "securityKey": "your-wifi-password",
    "encryptionPsk": 3,
    "versionPsk": 2,
    "gikRekeyPskEnable": false
  },
  "rateLimit": { "rateLimitId": "YOUR_RATE_LIMIT_ID" },
  "ssidRateLimit": { "rateLimitId": "YOUR_RATE_LIMIT_ID" },
  "wlanScheduleEnable": false,
  "rateAndBeaconCtrl": {
    "rate2gCtrlEnable": false,
    "rate5gCtrlEnable": false,
    "rate6gCtrlEnable": false
  },
  "macFilterEnable": false,
  "wlanId": "",
  "enable11r": false,
  "pmfMode": 3,
  "multiCastSetting": {
    "multiCastEnable": true,
    "arpCastEnable": true,
    "filterEnable": false,
    "ipv6CastEnable": true,
    "channelUtil": 100
  },
  "wpaPsk": [2, 3],
  "deviceType": 1,
  "dhcpOption82": { "dhcpEnable": false },
  "greEnable": false,
  "prohibitWifiShare": false,
  "mloEnable": false
}
```

**Key fields:**

| Field | Type | Values |
|-------|------|--------|
| `name` | string | SSID name (broadcast name) |
| `band` | integer | Bitmask: `1` = 2.4 GHz, `2` = 5 GHz, `3` = 2.4 + 5 GHz |
| `security` | integer | `0` = Open, `3` = WPA2/WPA3-Personal. **`2` (WPA2-only) fails on creation — use `3` instead** |
| `broadcast` | boolean | `true` = visible, `false` = hidden SSID |
| `vlanSetting.mode` | integer | `0` = use WLAN Group default, `1` = custom VLAN |
| `vlanSetting.customConfig.vlanId` | integer | VLAN ID (when mode = 1) |
| `enable11r` | boolean | 802.11r Fast Roaming |
| `pmfMode` | integer | Protected Management Frames: `1` = disabled, `2` = optional, `3` = required |
| `wpaPsk` | int[] | WPA versions: `[2]` = WPA2, `[2, 3]` = WPA2/WPA3 |
| `rateLimit.rateLimitId` | string | ID of the rate limit profile (get from existing SSIDs) |

**Important:** The `rateLimitId` references a built-in rate limit profile. Get the "no limit" profile ID by reading an existing SSID.

### Modify SSID

```
PATCH /setting/wlans/{wlanGroupId}/ssids/{ssidId}
```

**Important:** Like all Omada PATCH endpoints, send the **full SSID object**. GET the SSID list first, modify the fields you want, remove read-only fields (`id`, `idInt`, `index`, `site`, `resource`, `vlanEnable`, `portalEnable`, `accessEnable`), then PATCH.

### Delete SSID

```
DELETE /setting/wlans/{wlanGroupId}/ssids/{ssidId}
```

---

## Networks (continued)

### Delete Network

```
DELETE /setting/lan/networks/{networkId}
```

### Batch Delete Networks

```
POST /setting/lan/networks/batch-delete
```

### Network Summary

```
GET /setting/lan/networkSummary
```

Returns a summary view of all networks without full detail.

### Network Check

```
POST /setting/lan/networks/check
```

Validates a network configuration before creating it.

---

## Devices

### List Devices

```
GET /devices?currentPage=1&currentPageSize=100
```

**Response item:**
```json
{
  "mac": "AA-BB-CC-DD-EE-FF",
  "name": "SG3428XMPP",
  "type": "switch",
  "status": 14,
  "statusCategory": 1,
  "model": "SG3428XMPP",
  "firmwareVersion": "1.0.0"
}
```

**Status values:** `statusCategory: 1` or `status: 14` = online. `status: 20` = discovered (ready for adoption).

### Adopt Device

```
POST /cmd/devices/adopt
```

**Request body:**
```json
{
  "mac": "AA-BB-CC-DD-EE-FF"
}
```

**Important:** The MAC is in the **body**, not the URL. Adoption often fails on first attempt (device not yet discovered). Wait 10–30 seconds and retry — usually succeeds after the device reaches "Discovered" state (status 20).

### Reboot Device

```
POST /cmd/devices/{deviceId}/reboot
```

### Upgrade Device Firmware

```
POST /cmd/devices/upgrade
```

### Check for Firmware Updates

```
GET /cmd/devices/onlineCheckUpgrade
```

---

## Clients

### List Active Clients

```
GET /clients?filters.active=true&currentPage=1&currentPageSize=100
```

**Important:** The `filters.active=true` parameter is **required** on OC220. Without it, the endpoint returns errorCode -1.

### Block Client

```
POST /cmd/clients/{clientId}/block
```

### Unblock Client

```
POST /cmd/clients/{clientId}/unblock
```

### Delete Client

```
POST /cmd/clients/delete
```

### Client History

```
GET /clientHistory
```

---

## Switches

### Rename Switch

```
PATCH /switches/{mac}
```

**Request body:**
```json
{
  "name": "Core-SG3428"
}
```

**Important:** Use `/switches/{mac}` NOT `/devices/{mac}`. The generic devices endpoint returns -1600 for PATCH operations. See Pitfall #21.

### Get Switch Config

```
GET /cmd/switches/
```

### Update Switch General Config

```
PUT /cmd/switches/config/general
```

### Get Switch Services Config

```
GET /cmd/switches/config/services
```

### Get Switch Port Config

```
GET /cmd/switches/ports/config
```

### Switch LAGs

```
GET /switches/{switchMac}/lags
```

### Switch Network Overview

```
GET /switches/{switchMac}/networkOverview
```

---

## Gateway

### Get Gateway Config

```
GET /gateways
```

or

```
GET /gateways/
```

### Update Gateway

```
PATCH /gateways
```

### Gateway General Settings

```
GET /gateways/{deviceId}/setting/general
```

### Gateway Network Settings

```
GET /gateways/{deviceId}/setting/network
```

### Gateway Services Settings

```
GET /gateways/{deviceId}/setting/services
```

---

## Access Points (EAPs)

### Get AP Details

```
GET /eaps/{mac}
```

Returns full AP configuration including radio settings, IP settings, and SSID overrides.

### SSID Override per AP

Each AP has an `ssidOverrides` array that controls which SSIDs are enabled/disabled on that specific AP.

**IMPORTANT:** `PATCH /eaps/{mac}` silently ignores `ssidOverrides` (returns success but discards changes). You **must** use the dedicated WLAN config endpoint:

```
PUT /eaps/{mac}/config/wlans
```

**Request body:**
```json
{
  "wlanId": "YOUR_WLAN_GROUP_ID",
  "ssidOverrides": [
    {
      "index": 311881680,
      "globalSsid": "HomeNet",
      "supportBands": [0, 1],
      "security": 3,
      "enable": false,
      "ssidEnable": true,
      "vlanEnable": false,
      "vlanId": 1,
      "ssid": "HomeNet",
      "psk": "wifi-password"
    }
  ]
}
```

**Override fields:**

| Field | Type | Description |
|-------|------|-------------|
| `ssidEnable` | boolean | `true` = SSID broadcasts on this AP, `false` = disabled on this AP |
| `enable` | boolean | Must be `false`! Setting `true` causes `-39304 SSID name already exists` |
| `globalSsid` | string | The SSID name (read-only, used for matching) |
| `supportBands` | int[] | `[0]` = 2.4G, `[1]` = 5G, `[0,1]` = both (read-only, from SSID band setting) |
| `wlanId` | string | **Required.** The WLAN group ID from `GET /setting/wlans` |

**Workflow:**
1. `GET /eaps/{mac}` — get full AP object with `ssidOverrides`
2. `GET /setting/wlans?currentPage=1&currentPageSize=100` — get WLAN group ID
3. For each SSID override entry, set `ssidEnable: true/false` (keep `enable: false`)
4. `PUT /eaps/{mac}/config/wlans` with `{ wlanId: "...", ssidOverrides: [...] }`

### Radio Settings (Channel, TX Power, RSSI)

The EAP object includes `radioSetting2g` and `radioSetting5g` for radio configuration:

```json
{
  "radioSetting2g": {
    "radioEnable": true,
    "channelWidth": "4",
    "channel": "0",
    "txPower": 20,
    "txPowerLevel": 4,
    "freq": 2412,
    "wirelessMode": -2
  },
  "radioSetting5g": {
    "radioEnable": true,
    "channelWidth": "6",
    "channel": "0",
    "txPower": 28,
    "txPowerLevel": 4,
    "freq": 5180,
    "wirelessMode": -2
  }
}
```

**Setting the channel:**

The channel is controlled via the `freq` field (frequency in MHz), **NOT** the `channel` field. The `channel` field always reads `"0"` regardless of what you set — it's a display value for "auto" and is effectively read-only.

```
PATCH /eaps/{mac}
```

```json
{
  "radioSetting2g": { "radioEnable": true, "channelWidth": "4", "channel": "0", "txPower": 14, "txPowerLevel": 4, "freq": 2437, "wirelessMode": -2 },
  "radioSetting5g": { "radioEnable": true, "channelWidth": "6", "channel": "0", "txPower": 28, "txPowerLevel": 4, "freq": 5260, "wirelessMode": -2 }
}
```

**Frequency → Channel mapping:**

| Band | Channel | Frequency (MHz) |
|------|---------|----------------|
| 2.4 GHz | 1 | 2412 |
| 2.4 GHz | 6 | 2437 |
| 2.4 GHz | 11 | 2462 |
| 5 GHz | 36 | 5180 |
| 5 GHz | 52 | 5260 |
| 5 GHz | 100 | 5500 |
| 5 GHz | 132 | 5660 |
| Auto | — | 0 |

**Radio field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `freq` | integer | **Channel frequency in MHz.** `0` = auto. This is the actual channel control. |
| `channel` | string | Always `"0"`. Read-only display value — **setting this has no effect**. |
| `txPower` | integer | Transmit power in dBm. EAP650: 2.4G range 7–20, 5G range 7–28. |
| `txPowerLevel` | integer | `4` observed (likely auto/max level) |
| `channelWidth` | string | `"4"` = 20/40 MHz auto (2.4G), `"6"` = 20/40/80 MHz auto (5G) |
| `radioEnable` | boolean | Enable/disable this radio band |
| `wirelessMode` | integer | `-2` observed (auto mode) |

**Transmit power ranges** (from `deviceMisc` in AP response):

| Model | 2.4 GHz | 5 GHz |
|-------|---------|-------|
| EAP650 (indoor) | 7–20 dBm | 7–28 dBm |
| EAP650-Outdoor | 6–20 dBm | 7–28 dBm |

### Minimum RSSI (Roaming Threshold)

Controls when the AP disconnects clients with weak signal, encouraging them to roam to a closer AP.

```
PATCH /eaps/{mac}
```

```json
{
  "rssiSetting2g": { "rssiEnable": true, "threshold": -75 },
  "rssiSetting5g": { "rssiEnable": true, "threshold": -75 }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `rssiEnable` | boolean | Enable minimum RSSI enforcement |
| `threshold` | integer | Signal threshold in dBm (e.g., `-75`). Clients below this are disconnected. |

**Recommended values:** `-75 dBm` is a good starting point for dense deployments with multiple APs. Lower values (e.g., `-80`) are more permissive, higher values (e.g., `-70`) are more aggressive.

---

## Port Profiles (LAN Profiles)

### List Port Profiles

```
GET /setting/lan/profiles?currentPage=1&currentPageSize=100
```

**Important:** The endpoint is `/setting/lan/profiles`, NOT `/setting/switching/portProfiles`.

### Create Port Profile

```
POST /setting/lan/profiles
```

**Request body (Trunk profile example):**
```json
{
  "name": "Trunk-All",
  "nativeNetworkId": "YOUR_MGMT_NETWORK_ID",
  "tagNetworkIds": [
    "YOUR_TRUSTED_NETWORK_ID",
    "YOUR_WORK_NETWORK_ID",
    "YOUR_IOT_NETWORK_ID"
  ],
  "poe": 1,
  "dot1x": 0,
  "spanningTreeEnable": true,
  "duplex": 0,
  "linkSpeed": 0,
  "lldpMedEnable": false,
  "topologyNotifyEnable": false,
  "type": 0
}
```

**Important:** The `nativeNetworkId` cannot appear in `tagNetworkIds` (error). Also, every port **must** have a native network — profiles without `nativeNetworkId` can be created but cannot be assigned to ports.

---

## Switch Ports

### List Switch Ports

```
GET /switches/{mac}/ports
```

Returns all ports with their current configuration, status, and assigned profiles.

### Modify Switch Port

```
PATCH /switches/{mac}/ports/{portNumber}
```

**Important notes:**
- Use port **number** in the URL, not port ID
- Requires the **full port object** (GET first, clone, modify, PATCH)
- Remove read-only fields: `portStatus`, `portCap`
- SFP+ ports may have different port numbers (e.g., SFP+1 = port 9, SFP+2 = port 10 on SG2210XMP-M2)

**Workflow:**
```javascript
// 1. GET all ports
const ports = await omada.apiCall('GET', `/switches/${mac}/ports`);

// 2. Find the port you want to modify
const port = ports.result.find(p => p.port === 1);

// 3. Clone and modify
const payload = { ...port };
delete payload.portStatus;  // read-only
delete payload.portCap;     // read-only
payload.profileId = 'YOUR_PROFILE_ID';

// 4. PATCH
await omada.apiCall('PATCH', `/switches/${mac}/ports/1`, payload);
```

---

## Routing

### List Static Routes

```
GET /setting/routing/staticRoutes?currentPage=1&currentPageSize=100
```

---

## Other ACL Types

### Switch ACLs

```
GET  /setting/firewall/acls?type=switch&currentPage=1&currentPageSize=100
POST /setting/firewall/acls?type=switch
```

### EAP (Access Point) ACLs

```
GET  /setting/firewall/acls?type=eap&currentPage=1&currentPageSize=100
POST /setting/firewall/acls?type=eap
```

---

## Security & Attack Defense

### Attack Defense

```
GET /setting/firewall/attackdefense
```

Returns the current attack defense configuration with ~29 features (DoS protection, flood protection, etc.).

```
GET /setting/firewall/attackdefense/default
```

Returns factory default attack defense settings.

**Note:** OC220 has 22/29 features enabled by default.

### Wireless IDS

```
GET /setting/firewall/wids
```

Wireless intrusion detection settings. **Returns -1001 on OC220 hardware** (unsupported).

### Wireless IPS

```
GET /setting/firewall/wips
```

Wireless intrusion prevention settings. **Returns -1001 on OC220 hardware** (unsupported).

### URL Filtering

```
GET /setting/firewall/urlfilterings
DELETE /setting/firewall/urlfilterings/{id}
PUT /setting/firewall/urlfilterings/{id}
POST /cmd/urlfilterings/modifyIndex
```

**Returns -1001 on OC220 hardware** (unsupported).

### IP-MAC Binding

```
GET /setting/firewall/imbs
POST /setting/firewall/imbs/
PUT /setting/firewall/imbs/{id}
DELETE /setting/firewall/imbs/{id}
POST /setting/firewall/imbs/batch-delete
```

Prevents IP spoofing by binding specific MACs to IPs. Useful for critical infrastructure devices.

### Firewall Timeouts

```
GET /setting/firewall/timeout
GET /setting/firewall/timeout/default
```

---

## Rogue AP Detection

### Scan for Rogue APs

```
POST /cmd/rogueaps/scan
```

Triggers a rogue AP scan across all managed APs. Returns immediately; results are retrieved via the insight endpoint.

### Get Rogue AP Results

```
GET /insight/rogueaps
```

Returns list of detected rogue APs from the most recent scan.

### Delete Rogue AP Entry

```
POST /cmd/rogueaps/delete
```

---

## Network Services

### SNMP

```
GET /setting/snmp
PUT /setting/snmp
```

Enable/disable SNMP agent and configure communities.

### SSH

```
PUT /setting/ssh
PATCH /setting/ssh
```

### NTP

```
GET /setting/ntp
```

### DDNS

```
GET /setting/service/ddns
PUT /setting/service/ddns/{id}
DELETE /setting/service/ddns/{id}
```

### UPnP

```
GET /setting/upnp
PUT /setting/upnp
```

### IGMP Proxy

```
GET  /setting/service/igmpProxy
PATCH /setting/service/igmpProxy
```

### IPTV

```
GET /setting/iptv
PUT /setting/iptv
```

### PoE Schedules

```
GET /setting/service/poeSchedules
PUT /setting/service/poeSchedules/{id}
DELETE /setting/service/poeSchedules/{id}
```

### Reboot Schedules

```
PATCH /setting/service/rebootSchedules
PUT /setting/service/rebootSchedules/{id}
DELETE /setting/service/rebootSchedules/{id}
```

### Scheduled Upgrade

```
GET /setting/service/scheduleUpgrade
PUT /setting/service/scheduleUpgrade
```

### DHCP

```
GET /setting/service/dhcp/{id}
PUT /setting/service/dhcp/{id}
DELETE /setting/service/dhcp/{id}
GET /setting/service/dhcp/export
```

---

## Transmission / Traffic Control

### Bandwidth Controls

```
GET /setting/transmission/bandwidthControls
GET /setting/transmission/bandwidthControls/{id}
PUT /setting/transmission/bandwidthControls/{id}
```

### Port Forwarding

```
GET /setting/transmission/portForwardings
GET /setting/transmission/portForwardings/{id}
PUT /setting/transmission/portForwardings/{id}
```

### Static Routes (via Transmission)

```
GET /setting/transmission/staticRoutings
PUT /setting/transmission/staticRoutings/{id}
DELETE /setting/transmission/staticRoutings/{id}
```

### Policy Routing

```
GET /setting/transmission/policyRoutings
GET /setting/transmission/policyRoutings/{id}
PUT /setting/transmission/policyRoutings/{id}
```

### Session Limits

```
GET /setting/transmission/sessionLimits
GET /setting/transmission/sessionLimits/{id}
PUT /setting/transmission/sessionLimits/{id}
```

### One-to-One NAT

```
GET /setting/transmission/otonats
GET /setting/transmission/otonats/{id}
PUT /setting/transmission/otonats/{id}
```

### ALG (Application Layer Gateway)

```
GET /setting/transmission/alg
PUT /setting/transmission/alg
```

---

## VPN

### IPsec / VPN Tunnels

```
GET /setting/vpns
GET /setting/vpns/{id}
GET /setting/vpns/{id}/status
```

### GRE Tunnel

```
GET /setting/vpns/greTunnel
PUT /setting/vpns/greTunnel
```

### IPsec Failovers

```
GET /setting/vpns/ipsec-failovers
DELETE /setting/vpns/ipsec-failovers/{id}
GET /setting/vpns/ipsec-failovers/candidates
```

### PPTP / L2TP

```
GET /setting/vpns/pptpAndL2tp
```

### VPN Users

```
GET /setting/vpns/users
DELETE /setting/vpns/users/{id}
GET /setting/vpns/userServers
```

### VPN Tunnel Stats

```
POST /cmd/vpn/stats/tunnel/terminate
```

### WireGuard Dashboard

```
GET /dashboard/wireguard
```

---

## SSL VPN (16 endpoints)

```
GET /setting/sslvpn/server
PATCH /setting/sslvpn/server
GET /setting/sslvpn/resourcegroups
DELETE /setting/sslvpn/resourcegroups/{id}
GET /setting/sslvpn/resources
DELETE /setting/sslvpn/resources/{id}
GET /setting/sslvpn/usergroups
GET /setting/sslvpn/usergroups/{id}
DELETE /setting/sslvpn/usergroups/{id}
GET /setting/sslvpn/usergroups/{id}/users
POST /setting/sslvpn/users
DELETE /setting/sslvpn/users/{id}
GET /setting/sslvpn/lockedtunnels
DELETE /setting/sslvpn/lockedtunnels/{id}
GET /setting/sslvpn/radius
GET /setting/sslvpn/briefresourcegroups
GET /setting/sslvpn/briefresources
GET /setting/sslvpn/briefusergroups
```

---

## QoS

```
GET /setting/qos/switch/dot1p-queue-mappings/all
GET /setting/qos/switch/dscp-dot1p-mappings/all
GET /setting/qos/switch/queue-scheduler-mappings/all
```

---

## Authentication / 802.1X

### 802.1X Settings

```
GET /setting/dot1x
GET /setting/eap/dot1x
```

### RADIUS Profiles

```
GET /setting/radiusProfiles
POST /setting/radiusProfiles
PATCH /setting/radiusProfiles/{id}
DELETE /setting/radiusProfiles/{id}
```

### MAC Auth

```
GET /setting/macAuth
GET /setting/macAuthSsids
```

### LDAP

```
GET /setting/ldap-brief
```

---

## Portals / Guest Access

```
GET /setting/portals
PATCH /setting/portals
PATCH /setting/portals/{id}
DELETE /setting/portals/{id}
GET /setting/portal/candidates
```

---

## Profiles & Rate Limits

### Rate Limits

```
GET /setting/profiles/rateLimits
DELETE /setting/profiles/rateLimits/{id}
```

### Profile Groups

```
GET /setting/profiles/groups
POST /setting/profiles/groups
PATCH /setting/profiles/groups/{id}
DELETE /setting/profiles/groups/{id}
```

### Time Ranges

```
GET /setting/profiles/timeranges
POST /setting/profiles/timeranges
PATCH /setting/profiles/timeranges/{id}
DELETE /setting/profiles/timeranges/{id}
```

### PPSK (Private Pre-Shared Key)

```
GET /setting/profiles/ppsk
GET /setting/profiles/ppsk/{id}
DELETE /setting/profiles/ppsk/{id}
GET /setting/profiles/ppsk/generate
```

---

## WAN

### WAN Networks

```
GET /wan/networks
POST /wan/networks/
GET /wan/networks/load-balance
GET /setting/wan/networks
PATCH /setting/wan/networks
```

### WAN Bandwidth

```
POST /wan/bandwidth
```

### WAN Ports

```
GET /setting/wan-ports
```

### WAN/LAN Status

```
GET /setting/wanlanstatus
POST /setting/wanlanstatus
```

### Virtual WANs

```
GET /setting/virtual-wans
PATCH /setting/virtual-wans/{id}
GET /setting/virtual-wans/delete-check
DELETE /setting/virtual-wans/{virtualWanId}
GET /setting/available-virtual-wans
```

---

## Dashboard (43 endpoints)

All dashboard endpoints are **GET** requests.

### Overview

```
GET /dashboard/stats
GET /dashboard/snapshot
GET /dashboard/overviewDiagram
GET /dashboard/networks
```

### Clients

```
GET /dashboard/activeClients
GET /dashboard/clientActivity
GET /dashboard/clientsDistribution
GET /dashboard/clientsFreqDistribution
GET /dashboard/clientsRssiDistribution
GET /dashboard/clientsSsidDistribution
GET /dashboard/clientsAssociationActivities
GET /dashboard/clientsAssociationTimeDistribution
GET /dashboard/pastClientNum
```

### Wireless

```
GET /dashboard/wifiSummary
GET /dashboard/activeSsids
GET /dashboard/activeAps
GET /dashboard/channels
GET /dashboard/associationFailures
GET /dashboard/retryDroppedRate
GET /dashboard/topInterference
```

### Switching

```
GET /dashboard/switchSummary
GET /dashboard/switchingSummary
GET /dashboard/activeSwitches
GET /dashboard/portstatedetails
GET /dashboard/poeUtilization
GET /dashboard/longestUptime
GET /dashboard/topDeviceCpuUsage
GET /dashboard/topDeviceMemoryUsage
```

### Traffic

```
GET /dashboard/trafficActivities
GET /dashboard/trafficDistribution
GET /dashboard/activeApplications
GET /dashboard/activeCategories
```

### VPN

```
GET /dashboard/ipsectunnels
GET /dashboard/openvpntunnels
GET /dashboard/sslvpntunnels
GET /dashboard/vpnTunnelStats
GET /dashboard/wireguard
```

### Alerts

```
GET /dashboard/alertLogs
GET /dashboard/allTabs
```

---

## Insight

```
GET /insight/rogueaps
GET /insight/clients
GET /insight/ddns
GET /insight/pastConnection
GET /insight/portForwarding
GET /insight/routing/gateway
GET /insight/routing/switch
GET /insight/switch/detail
GET /insight/switch/port/counters
GET /insight/switch/port/overview
GET /insight/switch/port/poe
```

---

## Statistics

```
GET /stat/switches/{id}
GET /stat/wanSpeeds
GET /stat/olts/{id}/ddm/info
```

---

## RF Planning

```
GET /rfPlanning
PUT /rfPlanning
PUT /rfPlanning/excludeAps
GET /rfPlanning/result
POST /cmd/rfPlanning
POST /cmd/rfPlanning/cancel
```

---

## Speed Test

```
GET /cmd/speedTestPure
GET /cmd/getSpeedTestResult
```

---

## Anomaly Detection

```
GET /anomaly/setting/
PATCH /anomaly/setting
GET /anomaly/setting/modify
PATCH /anomaly/setting/modify
```

---

## Experience Index

```
GET /experienceIndex
```

---

## Controller System (Global, no site ID)

These use `/{controllerId}/api/v2/` (no site in path).

### Controller Settings

```
GET /api/v2/controller/setting
PATCH /api/v2/controller/setting
```

### Maintenance / Backup

```
POST /api/v2/maintenance/backup/prepareBackup
GET /api/v2/maintenance/backup/result
GET /api/v2/maintenance/backup/cancel
GET /api/v2/maintenance/restore/prepareRestore
GET /api/v2/maintenance/controllerStatus
GET /api/v2/maintenance/uiInterface
```

### Auto Backup

```
GET /api/v2/autoBackup/autoBackupTask
PUT /api/v2/autoBackup/autoBackupTask
GET /api/v2/autoBackup/autoBackupFile
DELETE /api/v2/autoBackup/autoBackupFile
GET /api/v2/autoBackup/gridAutoBackupFiles
GET /api/v2/autoBackup/restore
```

### Firmware

```
GET /api/v2/maintenance/hardware/checkFirmware
GET /api/v2/maintenance/hardware/upgradeStatus
GET /api/v2/cmd/upgradeFirmware
```

### Users

```
GET /api/v2/users
GET /api/v2/users/current
POST /api/v2/users/
POST /api/v2/cmd/users/
```

### Cloud

```
GET /api/v2/cloud/status
GET /api/v2/cloud/remote/bind/status
POST /api/v2/cloud/remote/bind/status
GET /api/v2/cmd/cloud/bind
GET /api/v2/cmd/cloud/unbind
```

### System

```
POST /api/v2/cmd/reboot
GET /api/v2/current/user-detail
GET /api/v2/current/view
GET /api/v2/role/current
GET /api/v2/workspace
GET /api/v2/scenarios
```

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `0` | Success | — |
| `-1` | Session expired / general error | Re-authenticate (call `connect()` again) |
| `-1001` | Invalid payload or unsupported on hardware | Check required fields; may mean feature not available on OC220 |
| `-1600` | Unsupported request path | Wrong endpoint (old vs new API) or not available on this controller |
| `-30109` | Invalid username or password | Check credentials |
| `-39000` | Device not found | Wait for discovery, retry adoption |
| `-39304` | SSID name already exists | Check `enable` field in SSID overrides (must be `false`) |
| `-39701` | Port not found | Use port number in URL, not port ID string |
| HTML response | Not authenticated | Complete the 3-step auth flow first |
| `ETIMEDOUT` | Controller unreachable | Check IP, port, and network connectivity |
| `ECONNREFUSED` | Wrong port or controller down | OC220 uses port 443, software controller may use 8043 |

---

## Response Format

All API responses follow this structure:

```json
{
  "errorCode": 0,
  "msg": "Success.",
  "result": {
    "totalRows": 10,
    "currentPage": 1,
    "currentSize": 100,
    "data": [ /* items */ ]
  }
}
```

For single-object responses (e.g., controller info), `result` contains the object directly instead of a paginated wrapper.

---

## Discovering New Endpoints

Since the API is not fully documented, new endpoints are discovered via browser DevTools:

1. Open the Omada Controller web UI
2. Press F12 → Network tab → filter by `XHR` or `Fetch`
3. Perform the desired action in the UI
4. Find the request in the Network tab
5. Copy the URL path, method, and request body
6. Use `omada.apiCall()` with the extracted values
