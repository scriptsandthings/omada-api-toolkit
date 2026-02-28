# Pitfalls & Undocumented Behavior

Hard-won lessons from reverse-engineering the Omada Controller Web API v2. Each one cost us hours — so you don't have to.

> **See also:** [API-REFERENCE.md](API-REFERENCE.md) (v2 endpoints) | [CHANGELOG.md](CHANGELOG.md) (version history)

## 1. `protocols: []` Does Not Mean "All Protocols"

You might assume an empty array means "match everything". It doesn't — the behavior is undefined and varies by controller version. **Always specify protocols explicitly:**

```javascript
// BAD — unreliable
protocols: []

// GOOD — explicit TCP + UDP + ICMP
protocols: [6, 17, 1]

// Protocol numbers:
// 6  = TCP
// 17 = UDP
// 1  = ICMP
```

## 2. PATCH Requires the Full Payload

Unlike REST conventions, the Omada Controller **does not support partial updates**. If you send only the fields you want to change, the missing fields get reset to defaults.

```javascript
// WRONG — will wipe all other settings
await omada.apiCall('PATCH', '/setting/service/mdns/RULE_ID', {
  status: false,
});

// CORRECT — GET first, modify, then PATCH with everything
const existing = await omada.apiCall('GET', '/setting/service/mdns');
const rule = existing.result.data[0];
rule.status = false;
await omada.apiCall('PATCH', `/setting/service/mdns/${rule.id}`, rule);
```

## 3. Self-Signed SSL Certificate

The Omada Controller (especially hardware controllers like OC220) uses a self-signed HTTPS certificate. Node.js will reject the connection by default.

```bash
# Option A: Environment variable (recommended)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Option B: In code (set before any requests)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

**Note:** This disables certificate verification for the entire Node.js process. In production, consider importing the controller's certificate instead.

## 4. Source and Destination Cannot Be Identical

The controller silently rejects ACL rules where `sourceIds` and `destinationIds` contain the same network ID. No error message — the rule just doesn't get created.

```javascript
// FAILS SILENTLY — same network in source and destination
{
  sourceIds: ['NETWORK_ID_A'],
  destinationIds: ['NETWORK_ID_A', 'NETWORK_ID_B'],
}

// WORKS — filter out the source network
const allNetworks = [ID_A, ID_B, ID_C, ID_D];
const sourceId = ID_A;
const destinations = allNetworks.filter(id => id !== sourceId);
```

## 5. Session Expires After ~30 Minutes

The `TPOMADA_SESSIONID` cookie and CSRF token expire after approximately 30 minutes of inactivity. Error code: `-1`.

```javascript
// For long-running scripts, re-authenticate periodically
try {
  const result = await omada.apiCall('GET', '/devices');
} catch (e) {
  // Session expired — reconnect
  await omada.connect();
  const result = await omada.apiCall('GET', '/devices');
}
```

## 6. Token Must Be Sent in Two Places

The CSRF token must be included **both** as a header and as a URL parameter. Missing either one results in a redirect to the login page (HTML response instead of JSON).

```
Header:    Csrf-Token: {token}
URL param: ?token={token}
```

The `omada-api-helper.js` handles this automatically, but if you're building your own client, don't forget either one.

## 7. `type` Has Different Meanings in Different Contexts

In the **URL query parameter** `?type=...`:
- `gateway` or `0` = Gateway/router-level ACL
- `switch` = Switch-level ACL
- `eap` = Access point-level ACL

In the **request body** `type: 0`:
- `0` = Gateway ACL (the only observed value for gateway rules)

Don't confuse the two — the query parameter selects which ACL table to operate on, the body field describes the rule type.

## 8. All List Endpoints Require Pagination

Every GET endpoint that returns a list **requires** pagination parameters. Omitting them may return empty results or errors.

```javascript
// BAD — may return nothing
await omada.apiCall('GET', '/setting/lan/networks');

// GOOD — always include pagination
await omada.apiCall('GET', '/setting/lan/networks?currentPage=1&currentPageSize=100');
```

## 9. Port-Based Filtering Requires IP/Port Groups

Gateway ACLs **cannot filter by port directly**. You can only filter by protocol (TCP/UDP/ICMP). To create port-specific rules:

1. Create an **IP/Port Group** first (via the web UI or API)
2. Reference it using `destinationType: 2` and the group ID in `destinationIds`

```javascript
// Gateway ACL with IP/Port Group target
{
  sourceType: 0,                        // 0 = Network
  sourceIds: ['YOUR_SOURCE_NETWORK_ID'],
  destinationType: 2,                   // 2 = IP/Port Group
  destinationIds: ['YOUR_IPGROUP_ID'],  // References the group
  // ...
}
```

IP/Port Group creation (observed from DevTools):

```javascript
// POST /setting/firewall/ipGroups
{
  "name": "AirPlay-Ports",
  "type": 1,                           // 1 = IP/Port Group
  "ipList": [
    {
      "ip": "192.168.40.0/24",         // Target subnet
      "portList": ["7000-7100", "5353"] // Port ranges as strings
    }
  ]
}
```

**Important:** `portList` values are **strings**, not numbers. Port ranges use a hyphen: `"7000-7100"`.

## 10. Old API Format vs. New API Format

The API payload structure changed between controller versions. If you find old tutorials or scripts, they may use the **legacy format** which no longer works:

```javascript
// OLD FORMAT (pre-5.x) — DOES NOT WORK on 6.x
{
  srcType: 4,
  srcNetworkId: '...',
  dstType: 4,
  dstNetworkId: '...',
  direction: 0,
}

// NEW FORMAT (5.x / 6.x) — USE THIS
{
  sourceType: 0,
  sourceIds: ['...'],           // Array, not single value
  destinationType: 0,
  destinationIds: ['...'],      // Array, not single value
  direction: {                  // Object, not integer
    lanToWan: false,
    lanToLan: true,
    wanInIds: [],
    vpnInIds: [],
  },
}
```

Key changes:
- `srcType` → `sourceType`, `dstType` → `destinationType`
- Single ID → Array of IDs (`sourceIds`, `destinationIds`)
- `direction: 0` → `direction: { lanToLan: true, ... }`
- Type value `4` → `0` for networks

## 11. Rate Limiting

While there's no documented rate limit, rapid-fire requests can cause the controller to become unresponsive (especially hardware controllers like OC220). Add a small delay between sequential API calls:

```javascript
for (const rule of rules) {
  await omada.apiCall('POST', '/setting/firewall/acls', rule);
  await new Promise(resolve => setTimeout(resolve, 200)); // 200ms pause
}
```

## 12. ACL Rule Order Matters

Gateway ACL rules are evaluated **top to bottom, first match wins**. The `index` field in the API response indicates the rule's position. When creating rules, they're appended at the end by default.

**Best practice:** Create ALLOW rules first, then DENY rules. The controller doesn't provide an API to reorder rules after creation (you'd have to delete and recreate them).

## 13. SSID Creation: `security: 2` (WPA2-Only) Fails

When creating an SSID via `POST /setting/wlans/{wlanGroupId}/ssids`, using `security: 2` (WPA2-only) causes "Invalid request parameters" or "General error". **Always use `security: 3` (WPA2/WPA3-mixed).**

WPA2-only clients still connect fine — the AP negotiates WPA2 with them automatically. If you absolutely need WPA2-only, create with `security: 3` and change via PATCH afterward (untested).

```javascript
// BAD — fails on creation
{ security: 2, wpaPsk: [2], pmfMode: 1 }

// GOOD — works, supports both WPA2 and WPA3 clients
{ security: 3, wpaPsk: [2, 3], pmfMode: 3 }
```

## 14. Port Profiles Endpoint: `/setting/lan/profiles`, NOT `/setting/switching/portProfiles`

The correct endpoint for port profiles is:

```
GET/POST /setting/lan/profiles
```

**Not** `/setting/switching/portProfiles` — that's the old endpoint and returns `-1600 Unsupported request path` on newer controllers.

## 15. Trunk Profiles Without Native Network Cannot Be Assigned to Ports

You can create a trunk profile without `nativeNetworkId` (all VLANs tagged, no native/untagged VLAN). The API accepts it. **But you cannot assign it to any switch port** — you'll get `-1001 Invalid request parameters`.

The Omada Controller requires every port to have a native (untagged) network. Use a trunk profile with the management VLAN as native instead:

```javascript
// FAILS when assigned to ports (no native VLAN)
{ name: 'Trunk-noPVID', tagNetworkIds: [...all VLANs...] }

// WORKS (management VLAN as native, rest tagged)
{ name: 'Trunk-All', nativeNetworkId: 'MGMT_NETWORK_ID', tagNetworkIds: [...other VLANs...] }
```

## 16. Switch Port PATCH: Full Object Required, Remove Read-Only Fields

Like all Omada PATCH endpoints, switch ports require the full object. But you must also **remove** two read-only fields or the request fails:

```javascript
const port = existingPorts.find(p => p.port === targetPort);
const payload = { ...port };
delete payload.portStatus;  // read-only — causes "General error"
delete payload.portCap;     // read-only — causes "General error"
payload.profileId = newProfileId;

await omada.apiCall('PATCH', `/switches/${mac}/ports/${targetPort}`, payload);
```

Also: the URL uses the **port number** (1, 2, 3...), not the port ID string. Using the port ID gives `-39701 This port does not exist`.

## 17. Device Adoption Often Fails on First Attempt

After connecting a new device, `POST /cmd/devices/adopt` frequently returns `-39000 This device does not exist` on the first try. The device hasn't been discovered by the controller yet.

**Solution:** Wait 10–30 seconds and retry. The device needs to reach "Discovered" state (status 20) before adoption works. Usually succeeds on the 2nd or 3rd attempt.

```javascript
async function adoptWithRetry(mac, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await omada.apiCall('POST', '/cmd/devices/adopt', { mac });
    if (res.errorCode === 0) return res;
    console.log(`Attempt ${i+1} failed, waiting 15s...`);
    await new Promise(r => setTimeout(r, 15000));
  }
  throw new Error(`Adoption failed after ${maxRetries} attempts`);
}
```

## 18. SSID Band Values Are a Bitmask

The `band` field in SSID configuration is a bitmask, not an enum:

| Value | Meaning |
|-------|---------|
| `1` | 2.4 GHz only |
| `2` | 5 GHz only |
| `3` | 2.4 GHz + 5 GHz (1+2) |

Creating an SSID with `band: 0` returns "Invalid request parameters".

## 19. AP Channel Is Controlled via `freq`, NOT `channel`

The `radioSetting2g` and `radioSetting5g` objects have both a `channel` and a `freq` field. You'd expect `channel` to control the Wi-Fi channel — **it doesn't.**

The `channel` field always reads `"0"` and setting it has no effect. The actual channel is controlled via the `freq` field (frequency in MHz):

```javascript
// BAD — channel stays on Auto regardless
await omada.apiCall('PATCH', `/eaps/${mac}`, {
  radioSetting2g: { ...existing, channel: "6" },
});

// GOOD — actually sets channel 6
await omada.apiCall('PATCH', `/eaps/${mac}`, {
  radioSetting2g: { ...existing, freq: 2437 },
});
```

Common frequency values:

| 2.4 GHz | 5 GHz |
|---------|-------|
| Ch 1 = 2412 MHz | Ch 36 = 5180 MHz |
| Ch 6 = 2437 MHz | Ch 52 = 5260 MHz |
| Ch 11 = 2462 MHz | Ch 100 = 5500 MHz |
| Auto = 0 | Ch 132 = 5660 MHz |

Set `freq: 0` to return to auto channel selection.

## 20. SSID Overrides: Use `PUT /eaps/{mac}/config/wlans`, NOT `PATCH /eaps/{mac}`

You might expect to enable/disable SSIDs on specific APs using the standard EAP PATCH endpoint with `ssidOverrides`. **It doesn't work.** The PATCH returns `errorCode: 0` (success) but silently discards the changes.

The correct endpoint is:

```javascript
// BAD — returns success but ignores ssidOverrides
await omada.apiCall('PATCH', `/eaps/${mac}`, {
  ssidOverrides: modifiedOverrides,
});

// GOOD — actually persists SSID enable/disable per AP
await omada.apiCall('PUT', `/eaps/${mac}/config/wlans`, {
  wlanId: 'YOUR_WLAN_GROUP_ID',  // from GET /setting/wlans
  ssidOverrides: modifiedOverrides,
});
```

Key details:
- `ssidEnable: true` = SSID broadcasts on this AP
- `ssidEnable: false` = SSID disabled on this AP
- `enable` field must stay `false` for all entries (it controls custom SSID renaming, not broadcast)
- Setting `enable: true` causes error `-39304 This SSID name already exists`
- The `wlanId` field is **required** in the PUT body

Example: Disable "GuestNetwork" on a specific AP:

```javascript
const ap = await omada.apiCall('GET', `/eaps/${mac}`);
const overrides = ap.result.ssidOverrides.map(o => ({
  ...o,
  ssidEnable: o.globalSsid === 'GuestNetwork' ? false : o.ssidEnable,
}));

const wlanGroups = await omada.apiCall('GET', '/setting/wlans?currentPage=1&currentPageSize=100');
const wlanId = wlanGroups.result.data[0].id;

await omada.apiCall('PUT', `/eaps/${mac}/config/wlans`, {
  wlanId,
  ssidOverrides: overrides,
});
```

## 21. Switch Rename: `PATCH /switches/{mac}`, NOT `/devices/{mac}`

To rename a switch, you must use the switch-specific endpoint:

```javascript
// BAD — returns -1600 Unsupported request path
await omada.apiCall('PATCH', `/devices/${mac}`, { name: 'Core-SG3428' });

// GOOD — works for switches
await omada.apiCall('PATCH', `/switches/${mac}`, { name: 'Core-SG3428' });
```

The generic `/devices/{mac}` endpoint only works for **reading** device info, not modifying. Each device type has its own endpoint: `/switches/{mac}`, `/eaps/{mac}`, `/gateways`.

## 22. WIDS/WIPS/URL Filtering: Endpoints Exist but Return -1001 on OC220

The JS bundles reference wireless IDS (`/setting/firewall/wids`), wireless IPS (`/setting/firewall/wips`), and URL filtering (`/setting/firewall/urlfilterings`). These endpoints **exist in the API** but return error `-1001` on OC220 hardware — the features are not supported.

```javascript
// Returns { errorCode: -1001 } on OC220
await omada.apiCall('GET', '/setting/firewall/wids');
await omada.apiCall('GET', '/setting/firewall/wips');
await omada.apiCall('GET', '/setting/firewall/urlfilterings');
```

These may work on software controllers or newer hardware. Don't assume `-1001` means "wrong endpoint" — it can also mean "unsupported on this hardware."

## 23. Clients Endpoint Requires `filters.active=true`

The clients endpoint returns an error without a filter parameter:

```javascript
// BAD — returns errorCode -1
await omada.apiCall('GET', '/clients?currentPage=1&currentPageSize=100');

// GOOD — filter by active clients
await omada.apiCall('GET', '/clients?filters.active=true&currentPage=1&currentPageSize=100');
```

## 24. `proto` Field Lives Inside `lanNetworkIpv6Config`, Required for PATCH on Interface Networks

When PATCHing a network with `purpose: 'Interface'` (L3 VLAN), the `proto` field is required — but it's **not** at the top level. It's nested inside `lanNetworkIpv6Config`:

```javascript
// BAD — "proto must not be null"
await omada.apiCall('PATCH', `/setting/lan/networks/${id}`, {
  ...network,
  proto: 0,
});

// GOOD — proto lives inside lanNetworkIpv6Config
await omada.apiCall('PATCH', `/setting/lan/networks/${id}`, {
  ...network,
  lanNetworkIpv6Config: { proto: 0 },
});
```

## 25. `purpose: 'Interface'` vs `purpose: 'vlan'` — L3 vs L2

Networks have two purpose types that behave very differently:

- **`purpose: 'Interface'`** — Creates an L3 VLAN with gateway + subnet + DHCP. The ER7206 has a **hard limit** (~4 interfaces) — creating more returns "General error" with no specific message.
- **`purpose: 'vlan'`** — Creates an L2-only switch VLAN tag with no subnet or gateway. No limit. Use this when the router (OPNsense, ER7206) handles DHCP and routing — you just need the VLAN tag on switches.

```javascript
// L3 VLAN with gateway (limited on ER7206)
{ purpose: 'Interface', vlanId: 40, subnet: '192.168.40.0', cidr: 24, gatewayIp: '192.168.40.1' }

// L2 VLAN tag only (unlimited)
{ purpose: 'vlan', vlan: 40 }
```

**Note:** For L2 VLANs, the field is `.vlan` (not `.vlanId`). The API-REFERENCE.md uses `vlanId` (different controller version).

## 26. GET Single Network Returns -1600 on OC220

The endpoint `GET /setting/lan/networks/{id}` returns `-1600 Unsupported request path` on OC220. Use the list endpoint and filter client-side:

```javascript
// BAD — returns -1600 on OC220
await omada.apiCall('GET', `/setting/lan/networks/${networkId}`);

// GOOD — list all and filter
const networks = await omada.getNetworks();
const target = networks.result.data.find(n => n.id === networkId);
```

## 27. IP Groups Returns -1600 on OC220

`GET /setting/firewall/ipGroups` returns `-1600` on OC220 hardware controllers. IP/Port Groups may only be available on the ER7206 gateway or software controllers. If you need IP-based firewall grouping, defer to your gateway's native tools (e.g., OPNsense aliases).

## 28. Auto-Created Port Profiles

When you create a VLAN, the controller **automatically creates** a per-VLAN access port profile (e.g., "Servers" profile for VLAN 40). You only need to manually create:
- **Renamed VLANs** that didn't get a profile with the right name
- **Trunk/Uplink profiles** with specific tagged VLAN sets

Check `GET /setting/lan/profiles` after creating VLANs — you may already have what you need.

## 29. Response Format: `result` Can Be Array OR `{ data: [...] }`

The API is inconsistent about response format. Some endpoints return:

```javascript
// Paginated (most list endpoints)
{ errorCode: 0, result: { totalRows: 5, data: [...] } }

// Direct array (some endpoints like switch ports)
{ errorCode: 0, result: [...] }

// Direct object (single-item endpoints like controller info)
{ errorCode: 0, result: { omadacId: '...' } }
```

Always handle both: `result.data || result` when extracting results.

## 30. Device Status Values

Devices use `statusCategory` and `status` fields, which have different meanings:

| `statusCategory` | Meaning |
|-------------------|---------|
| `1` | Online |
| `0` | Offline/Pending |

| `status` | Meaning |
|----------|---------|
| `14` | Online (connected) |
| `20` | Discovered (ready for adoption) |
| `0` | Disconnected |

Check `statusCategory === 1` **OR** `status === 14` for online devices. Don't rely on just one field.

## 31. Port Profile Creation Requires Full Field Set

Creating a port profile with a minimal payload (just `name` + `nativeNetworkId`) fails with "must not be null" for 5+ fields. You must include the full set:

```javascript
// BAD — "must not be null" x5
{ name: 'My Profile', nativeNetworkId: '...' }

// GOOD — all required fields
{
  name: 'My Profile',
  nativeNetworkId: '...',
  tagNetworkIds: [],
  poe: 1,
  dot1x: 0,
  spanningTreeSetting: { spanningTreeEnable: true },
  duplex: 0,
  linkSpeed: 0,
  lldpMedEnable: false,
  topologyNotifyEnable: false,
  type: 0
}
```

Note: `spanningTreeSetting` is an object (not the flat `spanningTreeEnable` boolean used in some examples).
