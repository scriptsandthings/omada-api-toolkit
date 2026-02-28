#!/usr/bin/env node

/**
 * Example: Security Audit — check your controller's security posture
 *
 * Reviews attack defense settings, WIDS/WIPS status, rogue APs,
 * SNMP configuration, and IP-MAC bindings.
 *
 * Usage:
 *   export OMADA_URL="https://192.168.x.x"
 *   export OMADA_PASS="your-password"
 *   export NODE_TLS_REJECT_UNAUTHORIZED=0
 *   node examples/security-audit.js
 */

const omada = require('../omada-api-helper.js');

async function run() {
  await omada.connect();

  // --- Attack Defense ---
  console.log('=== Attack Defense ===');
  const ad = await omada.getAttackDefense();
  if (ad.errorCode === 0) {
    const r = ad.result;
    // Count enabled protections
    const fields = Object.entries(r).filter(([k, v]) => typeof v === 'boolean');
    const enabled = fields.filter(([k, v]) => v).length;
    console.log(`  Protections enabled: ${enabled}/${fields.length}`);
    // Show disabled ones as warnings
    const disabled = fields.filter(([k, v]) => !v);
    if (disabled.length > 0) {
      console.log('  Disabled:');
      for (const [k] of disabled) {
        console.log(`    - ${k}`);
      }
    }
  } else {
    console.log(`  (could not fetch: ${ad.msg})`);
  }

  // --- Wireless IDS ---
  console.log('\n=== Wireless IDS (WIDS) ===');
  const wids = await omada.getWids();
  if (wids.errorCode === 0) {
    const r = wids.result;
    console.log(`  Status: ${JSON.stringify(r)}`);
  } else if (wids.errorCode === -1001) {
    console.log('  Not supported on this hardware (OC220 limitation — Pitfall #22)');
  } else {
    console.log(`  (error ${wids.errorCode}: ${wids.msg})`);
  }

  // --- Wireless IPS ---
  console.log('\n=== Wireless IPS (WIPS) ===');
  const wips = await omada.getWips();
  if (wips.errorCode === 0) {
    const r = wips.result;
    console.log(`  Status: ${JSON.stringify(r)}`);
  } else if (wips.errorCode === -1001) {
    console.log('  Not supported on this hardware (OC220 limitation — Pitfall #22)');
  } else {
    console.log(`  (error ${wips.errorCode}: ${wips.msg})`);
  }

  // --- Rogue AP Scan ---
  console.log('\n=== Rogue AP Detection ===');
  console.log('  Triggering scan...');
  const scan = await omada.scanRogueAps();
  if (scan.errorCode === 0) {
    // Wait a few seconds for scan to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    const rogues = await omada.getRogueAps();
    const rogueList = rogues.result?.data || rogues.result || [];
    if (rogueList.length === 0) {
      console.log('  No rogue APs detected.');
    } else {
      console.log(`  Found ${rogueList.length} rogue AP(s):`);
      for (const r of rogueList) {
        console.log(`    ${r.mac || 'unknown'} — SSID: ${r.ssid || 'hidden'}, Ch: ${r.channel || '?'}, RSSI: ${r.rssi || '?'}`);
      }
    }
  } else {
    console.log(`  Scan failed: ${scan.msg}`);
  }

  // --- SNMP ---
  console.log('\n=== SNMP Configuration ===');
  const snmp = await omada.getSnmp();
  if (snmp.errorCode === 0) {
    const r = snmp.result;
    console.log(`  Enabled: ${r.snmpEnable ?? r.enable ?? 'unknown'}`);
    if (r.snmpV1Enable !== undefined) console.log(`  SNMPv1: ${r.snmpV1Enable}`);
    if (r.snmpV2cEnable !== undefined) console.log(`  SNMPv2c: ${r.snmpV2cEnable}`);
    if (r.snmpV3Enable !== undefined) console.log(`  SNMPv3: ${r.snmpV3Enable}`);
  } else {
    console.log(`  (could not fetch: ${snmp.msg})`);
  }

  // --- IP-MAC Bindings ---
  console.log('\n=== IP-MAC Bindings ===');
  const bindings = await omada.getIpMacBindings();
  const bindList = bindings.result?.data || bindings.result || [];
  if (bindList.length === 0) {
    console.log('  No IP-MAC bindings configured.');
  } else {
    console.log(`  ${bindList.length} binding(s):`);
    for (const b of bindList) {
      console.log(`    ${(b.ip || '').padEnd(16)} ${b.mac || ''} — ${b.name || ''}`);
    }
  }

  // --- Alert Logs ---
  console.log('\n=== Recent Alerts ===');
  const alerts = await omada.getAlertLogs();
  const alertList = alerts.result?.data || alerts.result || [];
  if (alertList.length === 0) {
    console.log('  No recent alerts.');
  } else {
    const recent = alertList.slice(0, 10);
    for (const a of recent) {
      const time = a.timestamp ? new Date(a.timestamp).toISOString() : '';
      console.log(`  ${time}  ${a.msg || a.content || JSON.stringify(a)}`);
    }
    if (alertList.length > 10) {
      console.log(`  ... and ${alertList.length - 10} more`);
    }
  }
}

run().catch(e => console.error('Error:', e));
