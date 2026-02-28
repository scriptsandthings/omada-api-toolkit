#!/usr/bin/env node

/**
 * Example: Switch Configuration — rename, inspect ports, LAGs, and profiles
 *
 * Demonstrates switch-specific API calls including the rename endpoint
 * (which requires /switches/{mac}, NOT /devices/{mac}).
 *
 * Usage:
 *   export OMADA_URL="https://192.168.x.x"
 *   export OMADA_PASS="your-password"
 *   export NODE_TLS_REJECT_UNAUTHORIZED=0
 *   node examples/switch-config.js [switch-mac]
 *
 * If no MAC is provided, lists all switches and picks the first one.
 */

const omada = require('../omada-api-helper.js');

async function run() {
  await omada.connect();

  // Find switches
  const devices = await omada.getDevices();
  const devs = devices.result?.data || devices.result || [];
  const switches = devs.filter(d => d.type === 'switch');

  if (switches.length === 0) {
    console.log('No switches found.');
    return;
  }

  console.log('=== Switches ===');
  for (const s of switches) {
    const online = s.statusCategory === 1 || s.status === 14;
    console.log(`  ${(s.name || 'unnamed').padEnd(28)} ${s.mac}  ${s.model || ''}  ${online ? 'online' : 'offline'}`);
  }

  // Pick target switch — from CLI arg or first found
  const targetMac = process.argv[2] || switches[0].mac;
  const sw = switches.find(s => s.mac === targetMac);
  if (!sw) {
    console.log(`\nSwitch ${targetMac} not found.`);
    return;
  }
  console.log(`\nTarget: ${sw.name || sw.mac} (${sw.model})`);

  // --- Rename example (commented out — uncomment to use) ---
  // NOTE: Uses /switches/{mac}, NOT /devices/{mac} (Pitfall #21)
  //
  // const newName = 'Core-SG3428XMP';
  // console.log(`\nRenaming to "${newName}"...`);
  // const rename = await omada.renameSwitch(targetMac, newName);
  // console.log(rename.errorCode === 0 ? '  Done!' : `  Failed: ${rename.msg}`);

  // --- Port Profiles ---
  console.log('\n=== Port Profiles (LAN Profiles) ===');
  const profiles = await omada.getPortProfiles();
  const profList = profiles.result?.data || profiles.result || [];
  for (const p of profList) {
    const type = p.trunk ? 'trunk' : 'access';
    const vlan = p.nativeNetworkId ? `native:${p.nativeNetworkId.substring(0, 8)}...` : '';
    console.log(`  ${p.name.padEnd(28)} ${type.padEnd(8)} ${vlan}`);
  }

  // --- Switch Ports ---
  console.log(`\n=== Ports on ${sw.name || sw.mac} ===`);
  const ports = await omada.getSwitchPorts(targetMac);
  const portList = ports.result?.data || ports.result || [];
  for (const p of portList) {
    const link = p.linkStatus === 1 ? 'up  ' : 'down';
    const speed = p.linkSpeed ? `${p.linkSpeed}Mbps` : '';
    const profile = p.profileName || p.profileId || '';
    const poe = p.poe ? (p.poeEnabled ? 'PoE' : 'PoE-off') : '';
    console.log(`  Port ${String(p.port).padStart(2)}  ${link}  ${speed.padEnd(10)} ${profile.padEnd(20)} ${poe}`);
  }

  // --- LAGs ---
  console.log(`\n=== LAGs on ${sw.name || sw.mac} ===`);
  const lags = await omada.getSwitchLags(targetMac);
  if (lags.errorCode === 0) {
    const lagList = lags.result?.data || lags.result || [];
    if (lagList.length === 0) {
      console.log('  No LAGs configured.');
    }
    for (const l of lagList) {
      console.log(`  ${l.name || 'LAG'} — ports: ${l.ports?.join(', ') || 'none'}`);
    }
  } else {
    console.log(`  (could not fetch: ${lags.msg})`);
  }

  // --- Network Overview ---
  console.log(`\n=== Network Overview for ${sw.name || sw.mac} ===`);
  const overview = await omada.getSwitchNetworkOverview(targetMac);
  if (overview.errorCode === 0) {
    const data = overview.result?.data || overview.result || [];
    const items = Array.isArray(data) ? data : [data];
    for (const n of items) {
      console.log(`  ${JSON.stringify(n)}`);
    }
  } else {
    console.log(`  (could not fetch: ${overview.msg})`);
  }
}

run().catch(e => console.error('Error:', e));
