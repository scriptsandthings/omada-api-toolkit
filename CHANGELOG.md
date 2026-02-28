# Changelog

All notable changes to the Omada API Toolkit.

## [Unreleased] - 2026-02-27

### Added

**API-REFERENCE.md — 200+ endpoints documented (up from ~40)**

New endpoint sections:
- **Clients** — list active clients (with required `filters.active=true`), block/unblock, delete, history
- **Switches** — rename (`PATCH /switches/{mac}`), LAGs, network overview, general/services config
- **Gateway** — get/update config, general/network/services settings
- **Attack Defense** — current settings and factory defaults
- **Wireless IDS/IPS** — endpoints documented (noted as unsupported on OC220 hardware)
- **URL Filtering** — CRUD endpoints (noted as unsupported on OC220 hardware)
- **IP-MAC Binding** — CRUD + batch delete for IP spoofing prevention
- **Rogue AP Detection** — trigger scans, retrieve results, delete entries
- **SNMP** — get/update SNMP agent configuration
- **SSH, NTP** — server configuration endpoints
- **DDNS** — dynamic DNS management
- **UPnP** — enable/disable
- **IGMP/IPTV** — proxy and IPTV settings
- **PoE Schedules** — power scheduling for PoE ports
- **Reboot Schedules** — automated device reboots
- **Scheduled Upgrade** — firmware upgrade scheduling
- **DHCP** — per-interface DHCP server config + export
- **Bandwidth Controls** — traffic shaping rules
- **Port Forwarding** — NAT port forwarding rules
- **Static Routes** (via Transmission) — alternative routing endpoint
- **Policy Routing** — policy-based routing rules
- **Session Limits** — connection limit configuration
- **One-to-One NAT** — 1:1 NAT mappings
- **ALG** — Application Layer Gateway settings
- **VPN** — IPsec tunnels, GRE, PPTP/L2TP, VPN users, tunnel stats
- **SSL VPN** — 16 endpoints (server, resources, resource groups, users, user groups, locked tunnels, RADIUS)
- **WireGuard** — dashboard stats
- **QoS** — dot1p queue mappings, DSCP mappings, queue scheduler
- **802.1X / RADIUS** — dot1x settings, RADIUS profiles CRUD
- **MAC Auth** — MAC authentication and SSID bindings
- **LDAP** — brief LDAP config
- **Portals / Guest Access** — portal CRUD + candidates
- **Rate Limits** — rate limit profile management
- **Profile Groups** — group management
- **Time Ranges** — time-based schedule profiles
- **PPSK** — Private Pre-Shared Key management + generation
- **WAN** — WAN networks, bandwidth, ports, load balance, virtual WANs (CRUD + delete-check)
- **WAN/LAN Status** — interface status
- **Dashboard** — all 43 GET endpoints (stats, clients, wireless, switching, traffic, VPN, alerts)
- **Insight** — 11 endpoints (rogue APs, clients, DDNS, past connections, port forwarding, routing, switch details)
- **Statistics** — switch stats, WAN speeds, OLT DDM info
- **RF Planning** — planning CRUD, exclude APs, results, trigger/cancel scan
- **Speed Test** — trigger and get results
- **Anomaly Detection** — anomaly settings get/modify
- **Experience Index** — network experience scoring
- **Controller System** (global, no site ID) — controller settings, maintenance/backup (prepare/result/cancel/restore), auto backup (task/files/restore), firmware (check/status/upgrade), users, cloud binding, system reboot

Additional error codes: `-1600`, `-39000`, `-39304`, `-39701`

**PITFALLS.md — 11 new pitfalls (20 → 31)**

- **#21** Switch rename requires `/switches/{mac}`, not `/devices/{mac}`
- **#22** WIDS/WIPS/URL filtering endpoints exist but return -1001 on OC220 hardware
- **#23** Clients endpoint requires `filters.active=true` parameter
- **#24** `proto` field lives inside `lanNetworkIpv6Config`, not at top level
- **#25** `purpose: 'Interface'` (L3, limited on ER7206) vs `purpose: 'vlan'` (L2, unlimited)
- **#26** GET single network (`/setting/lan/networks/{id}`) returns -1600 on OC220
- **#27** IP Groups (`/setting/firewall/ipGroups`) returns -1600 on OC220
- **#28** Controller auto-creates per-VLAN access port profiles when VLANs are created
- **#29** Response format varies: `result.data` (paginated), `result` (array), or `result` (object)
- **#30** Device status uses both `statusCategory` (1=online) and `status` (14=online, 20=discovered)
- **#31** Port profile creation requires full field set including `spanningTreeSetting` object

**omada-api-helper.js — 15 new helper functions (20 → 35+)**

- `getClients()` — list active clients
- `blockClient(clientId)` / `unblockClient(clientId)` — client access control
- `renameSwitch(mac, name)` — rename a switch
- `getSwitchLags(mac)` — get switch LAG configuration
- `getSwitchNetworkOverview(mac)` — get switch network overview
- `getGateway()` / `updateGateway(config)` — gateway configuration
- `getAttackDefense()` — attack defense settings
- `getIpMacBindings()` — IP-MAC binding list
- `getWids()` / `getWips()` — wireless IDS/IPS settings
- `scanRogueAps()` / `getRogueAps()` — rogue AP scanning
- `getSnmp()` / `updateSnmp(config)` — SNMP configuration
- `deleteNetwork(id)` / `updateNetwork(id, config)` — network CRUD
- `getDashboardStats()` — dashboard overview
- `getAlertLogs()` — alert log retrieval
- `getActiveClients()` — dashboard active client count
- `exploreSettings()` expanded from 10 to 33 probed endpoints

**README.md**

- Updated feature counts and description
- Expanded top pitfalls list from 5 to 10

---

## [0.1.2] - 2026-02-27

### Added
- SSID override documentation: `PUT /eaps/{mac}/config/wlans` (the correct endpoint — `PATCH /eaps/{mac}` silently ignores `ssidOverrides`)
- Pitfall #20: SSID overrides must use PUT, not PATCH

## [0.1.1] - 2026-02-27

### Added
- AP radio settings documentation: channel via `freq` (not `channel`), TX power ranges, min-RSSI roaming
- Pitfall #19: AP channel controlled via `freq` field in MHz, `channel` field is read-only
- Frequency-to-channel mapping table for 2.4 GHz and 5 GHz bands

## [0.1.0] - 2026-02-27

### Added
- SSID creation/modification/deletion documentation with full 24-field payload
- EAP (Access Point) configuration: radio settings, SSID overrides
- Switch port management: list ports, modify port profiles
- Port profile (LAN profile) creation: trunk and access profiles
- Pitfalls #13-18: SSID security value, port profiles endpoint, trunk native VLAN, switch port PATCH, device adoption retry, band bitmask

## [0.0.2] - 2026-02-26

### Changed
- Clarified hardware compatibility: tested on OC220 only, software controller not yet verified

## [0.0.1] - 2026-02-26

### Added
- Initial release
- Zero-dependency Node.js API client (`omada-api-helper.js`)
- 3-step authentication flow (controller ID → login → site ID)
- Core helpers: networks/VLANs, gateway ACLs, devices, WLAN groups
- API-REFERENCE.md with authentication, networks, ACLs, IP/Port groups, mDNS
- PITFALLS.md with 12 initial pitfalls
- Example scripts: create-ssid.js, create-deny-intervlan.js
