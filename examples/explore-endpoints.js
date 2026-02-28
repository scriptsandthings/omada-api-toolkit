#!/usr/bin/env node

/**
 * Example: Explore Endpoints — discover what your controller supports
 *
 * Probes 33 endpoint categories and reports which ones work on your
 * hardware. Useful for discovering capabilities before writing automation.
 *
 * Some endpoints return -1001 (unsupported) or -1600 (not available)
 * on certain hardware — this script maps out what works for you.
 *
 * Usage:
 *   export OMADA_URL="https://192.168.x.x"
 *   export OMADA_PASS="your-password"
 *   export NODE_TLS_REJECT_UNAUTHORIZED=0
 *   node examples/explore-endpoints.js
 */

const omada = require('../omada-api-helper.js');

async function run() {
  await omada.connect();

  console.log('=== Endpoint Discovery ===');
  console.log('Probing 33 endpoint categories...\n');

  const results = await omada.exploreSettings();

  // Group by status
  const working = [];
  const unsupported = [];
  const errors = [];

  for (const [endpoint, result] of Object.entries(results)) {
    if (result.errorCode === 0) {
      // Count items in response
      let count = '?';
      if (result.result?.data) {
        count = Array.isArray(result.result.data) ? result.result.data.length : 1;
      } else if (Array.isArray(result.result)) {
        count = result.result.length;
      } else if (result.result && typeof result.result === 'object') {
        count = 'obj';
      }
      working.push({ endpoint, count });
    } else if (result.errorCode === -1001) {
      unsupported.push(endpoint);
    } else {
      errors.push({ endpoint, code: result.errorCode, msg: result.msg });
    }
  }

  // Print working endpoints
  console.log(`Working (${working.length}):`);
  for (const { endpoint, count } of working) {
    console.log(`  OK    ${endpoint.padEnd(55)} items: ${count}`);
  }

  // Print unsupported
  if (unsupported.length > 0) {
    console.log(`\nUnsupported on this hardware (${unsupported.length}):`);
    for (const ep of unsupported) {
      console.log(`  -1001 ${ep}`);
    }
  }

  // Print errors
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const { endpoint, code, msg } of errors) {
      console.log(`  ${String(code).padEnd(6)} ${endpoint.padEnd(55)} ${msg || ''}`);
    }
  }

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`  Working:     ${working.length}`);
  console.log(`  Unsupported: ${unsupported.length}`);
  console.log(`  Errors:      ${errors.length}`);
  console.log(`  Total:       ${working.length + unsupported.length + errors.length}`);
}

run().catch(e => console.error('Error:', e));
