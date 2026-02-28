#!/usr/bin/env node

/**
 * Example: Network Audit — full overview of your Omada network
 *
 * Lists all networks/VLANs, devices, active clients, and dashboard stats.
 * Useful as a quick health check or inventory snapshot.
 *
 * Usage:
 *   export OMADA_URL="https://192.168.x.x"
 *   export OMADA_PASS="your-password"
 *   export NODE_TLS_REJECT_UNAUTHORIZED=0
 *   node examples/network-audit.js
 */

const omada = require('../omada-api-helper.js');

async function run() {
  await omada.connect();

  // --- Dashboard Stats ---
  console.log('=== Dashboard Stats ===');
  const stats = await omada.getDashboardStats();
  if (stats.errorCode === 0) {
    const s = stats.result;
    console.log(`  Connected APs:      ${s.connectedAp ?? 'N/A'}`);
    console.log(`  Connected Switches: ${s.connectedSwitch ?? 'N/A'}`);
    console.log(`  Connected Gateways: ${s.connectedGateway ?? 'N/A'}`);
    console.log(`  Active Clients:     ${s.totalClientNum ?? 'N/A'}`);
  } else {
    console.log(`  (could not fetch: ${stats.msg})`);
  }

  // --- Networks / VLANs ---
  console.log('\n=== Networks ===');
  const networks = await omada.getNetworks();
  const nets = networks.result?.data || networks.result || [];
  for (const n of nets) {
    const vlan = n.vlanId ?? n.vlan ?? 'none';
    const gw = n.gatewayIp || 'no gateway';
    const purpose = n.purpose || 'unknown';
    console.log(`  ${n.name.padEnd(24)} VLAN ${String(vlan).padEnd(6)} ${gw.padEnd(16)} (${purpose})`);
  }
  console.log(`  Total: ${nets.length} networks`);

  // --- Devices ---
  console.log('\n=== Devices ===');
  const devices = await omada.getDevices();
  const devs = devices.result?.data || devices.result || [];
  const statusLabel = (d) => {
    if (d.statusCategory === 1 || d.status === 14) return 'online';
    if (d.status === 20) return 'discovered';
    return `status:${d.status}`;
  };
  for (const d of devs) {
    const name = (d.name || d.mac).padEnd(28);
    const type = (d.type || 'unknown').padEnd(8);
    const model = (d.model || '').padEnd(16);
    console.log(`  ${name} ${type} ${model} ${statusLabel(d)}`);
  }
  console.log(`  Total: ${devs.length} devices`);

  // --- Active Clients ---
  console.log('\n=== Active Clients ===');
  const clients = await omada.getClients();
  const cls = clients.result?.data || clients.result || [];
  for (const c of cls) {
    const name = (c.name || c.hostName || c.mac).padEnd(28);
    const ip = (c.ip || '').padEnd(16);
    const network = c.networkName || '';
    console.log(`  ${name} ${ip} ${network}`);
  }
  console.log(`  Total: ${cls.length} active clients`);

  // --- WLAN Groups / SSIDs ---
  console.log('\n=== SSIDs ===');
  const wlanGroups = await omada.getWlanGroups();
  const groups = wlanGroups.result?.data || wlanGroups.result || [];
  const bandMap = { 1: '2.4G', 2: '5G', 3: '2.4+5G' };
  for (const g of groups) {
    const ssids = await omada.getSsids(g.id);
    const ssidList = ssids.result?.data || ssids.result || [];
    for (const s of ssidList) {
      const vlan = s.vlanSetting?.customConfig?.vlanId || 'default';
      const band = bandMap[s.band] || s.band;
      const vis = s.broadcast ? 'visible' : 'hidden';
      console.log(`  ${s.name.padEnd(24)} VLAN ${String(vlan).padEnd(6)} ${band.padEnd(8)} ${vis}`);
    }
  }
}

run().catch(e => console.error('Error:', e));
