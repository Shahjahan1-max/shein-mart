#!/usr/bin/env node

/**
 * Import Ad Groups to Firebase Firestore
 * 
 * This script:
 * 1. Reads backend/scripts/catalogs_adGroups_firestore_document.json
 * 2. Validates data structure (29 groups, 725 ads, required fields)
 * 3. Creates backup of existing catalogs/adGroups document
 * 4. Replaces Firestore document: catalogs/adGroups
 * 5. Verifies upload and prints final report
 * 
 * Usage: npm run import:adgroups
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, firebaseEnabled } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_FILE_PATH = path.join(__dirname, 'catalogs_adGroups_firestore_document.json');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

/**
 * Validate JSON data structure
 */
function validateData(data) {
  const errors = [];
  const warnings = [];

  // Check if codeGroups exists and is an array
  if (!data.codeGroups || !Array.isArray(data.codeGroups)) {
    errors.push('Missing or invalid "codeGroups" array');
    return { valid: false, errors, warnings };
  }

  const groups = data.codeGroups;
  let totalAds = 0;
  const codes = new Set();

  // Validate each group
  groups.forEach((group, groupIndex) => {
    const groupNum = groupIndex + 1;

    // Check required group fields
    if (!group.code) {
      errors.push(`Group ${groupNum}: Missing "code" field`);
    } else {
      if (codes.has(group.code)) {
        errors.push(`Group ${groupNum}: Duplicate code "${group.code}"`);
      }
      codes.add(group.code);
    }

    // Check ads array
    if (!group.ads || !Array.isArray(group.ads)) {
      errors.push(`Group ${groupNum} (${group.code}): Missing or invalid "ads" array`);
      return;
    }

    const adsCount = group.ads.length;
    totalAds += adsCount;

    // Validate ads count (should be exactly 25)
    if (adsCount !== 25) {
      errors.push(`Group ${groupNum} (${group.code}): Expected 25 ads, found ${adsCount}`);
    }

    // Validate each ad
    group.ads.forEach((ad, adIndex) => {
      const adNum = adIndex + 1;
      const requiredFields = [
        'adNo',
        'amount',
        'commissionRate',
        'commissionAmount',
        'afterCommission',
        'contentUrl',
        'title',
        'productId'
      ];

      requiredFields.forEach(field => {
        if (ad[field] === undefined || ad[field] === null || ad[field] === '') {
          errors.push(`Group ${groupNum} (${group.code}), Ad ${adNum}: Missing "${field}"`);
        }
      });

      // Validate numeric fields
      if (typeof ad.amount !== 'number' || ad.amount < 0) {
        errors.push(`Group ${groupNum} (${group.code}), Ad ${adNum}: Invalid "amount" (${ad.amount})`);
      }
      if (typeof ad.commissionRate !== 'number' || ad.commissionRate < 0) {
        errors.push(`Group ${groupNum} (${group.code}), Ad ${adNum}: Invalid "commissionRate" (${ad.commissionRate})`);
      }
      if (typeof ad.commissionAmount !== 'number' || ad.commissionAmount < 0) {
        errors.push(`Group ${groupNum} (${group.code}), Ad ${adNum}: Invalid "commissionAmount" (${ad.commissionAmount})`);
      }
      if (typeof ad.afterCommission !== 'number' || ad.afterCommission < 0) {
        errors.push(`Group ${groupNum} (${group.code}), Ad ${adNum}: Invalid "afterCommission" (${ad.afterCommission})`);
      }

      // Validate adNo matches index
      if (ad.adNo !== adNum) {
        warnings.push(`Group ${groupNum} (${group.code}), Ad ${adNum}: adNo is ${ad.adNo}, expected ${adNum}`);
      }
    });
  });

  // Check expected counts
  if (groups.length !== 29) {
    warnings.push(`Expected 29 groups, found ${groups.length}`);
  }
  if (totalAds !== 725) {
    warnings.push(`Expected 725 total ads, found ${totalAds}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      groupCount: groups.length,
      totalAds,
      codes: Array.from(codes).sort()
    }
  };
}

/**
 * Create backup of existing document
 */
async function createBackup() {
  try {
    const docRef = db.collection('catalogs').doc('adGroups');
    const doc = await docRef.get();

    if (!doc.exists) {
      log('No existing document to backup', 'yellow');
      return { ok: true, existed: false };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupRef = db.collection('catalogBackups').doc(`adGroups_${timestamp}`);
    
    await backupRef.set({
      ...doc.data(),
      backedUpAt: new Date().toISOString(),
      originalDocPath: 'catalogs/adGroups'
    });

    log(`✓ Backup created: catalogBackups/adGroups_${timestamp}`, 'green');
    return { ok: true, existed: true, backupId: `adGroups_${timestamp}` };
  } catch (error) {
    log(`✗ Backup failed: ${error.message}`, 'red');
    return { ok: false, error: error.message };
  }
}

/**
 * Upload data to Firestore
 */
async function uploadToFirestore(data) {
  try {
    const docRef = db.collection('catalogs').doc('adGroups');
    
    // Prepare document with metadata
    const document = {
      createdAt: data.metadata?.extracted_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      importedAt: new Date().toISOString(),
      importedByScript: 'import-adgroups.js',
      source: data.metadata?.source_file_in_zip || 'unknown',
      schema: data.metadata?.schema || 'firebase_master_ads_code_groups_v1',
      groups: data.codeGroups.map(group => {
        const code = group.code;
        const setCode = group.setCode || parseInt(code, 10);
        const ads = group.ads.map(ad => ({
          adNo: ad.adNo,
          amount: ad.amount,
          commissionRate: ad.commissionRate,
          commissionAmount: ad.commissionAmount,
          afterCommission: ad.afterCommission,
          contentUrl: ad.contentUrl,
          title: ad.title,
          productId: ad.productId,
          imageUrl: ad.imageUrl || ad.contentUrl,
          code: ad.code || code,
          setCode: ad.setCode || setCode,
          taskOrder: ad.taskOrder || ad.adNo,
          status: ad.status || 'active'
        }));
        
        // Calculate totals for group
        const totalAmount = parseFloat(ads.reduce((s, a) => s + a.amount, 0).toFixed(2));
        const totalComm = parseFloat(ads.reduce((s, a) => s + a.commissionAmount, 0).toFixed(2));
        const avgRate = totalAmount > 0 ? totalComm / totalAmount : 0.04;
        
        return {
          code,
          urlPath: code,
          label: `Code ${code}`,
          setCode,
          adsCount: ads.length,
          status: group.status || 'active',
          sheetName: group.sheetName || code,
          amount: totalAmount,
          commissionRate: avgRate,
          commissionAmount: totalComm,
          afterCommission: totalComm,
          tier: determineTier(code),
          ads,
          isActive: true
        };
      })
    };

    // Replace document (full overwrite)
    await docRef.set(document);

    log('✓ Document uploaded successfully', 'green');
    return { ok: true };
  } catch (error) {
    log(`✗ Upload failed: ${error.message}`, 'red');
    return { ok: false, error: error.message };
  }
}

/**
 * Determine tier based on code
 */
function determineTier(code) {
  const codeNum = parseInt(code, 10);
  if (isNaN(codeNum)) return 'Starter';
  
  if (codeNum >= 201 && codeNum <= 299) return 'Starter';
  if (codeNum >= 301 && codeNum <= 399) return 'Bronze';
  if (codeNum >= 401 && codeNum <= 499) return 'Silver';
  if (codeNum >= 501 && codeNum <= 599) return 'Gold';
  if (codeNum >= 601 && codeNum <= 699) return 'Diamond';
  if (codeNum >= 701 && codeNum <= 799) return 'Elite';
  if (codeNum >= 801 && codeNum <= 899) return 'Platinum';
  if (codeNum >= 901 && codeNum <= 999) return 'Royal';
  
  return 'Starter';
}

/**
 * Verify uploaded document
 */
async function verifyUpload() {
  try {
    const docRef = db.collection('catalogs').doc('adGroups');
    const doc = await docRef.get();

    if (!doc.exists) {
      return { ok: false, error: 'Document not found after upload' };
    }

    const data = doc.data();
    const groups = data.groups || [];
    const totalAds = groups.reduce((sum, g) => sum + (g.ads?.length || 0), 0);
    const codes = groups.map(g => g.code).sort();

    return {
      ok: true,
      stats: {
        groupCount: groups.length,
        totalAds,
        codes,
        importedAt: data.importedAt,
        importedByScript: data.importedByScript
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  logSection('Firebase Ad Groups Import Script');

  // Check Firebase connection
  if (!firebaseEnabled()) {
    log('✗ Firebase is not initialized', 'red');
    log('Check your Firebase credentials in .env file', 'yellow');
    process.exit(1);
  }
  log('✓ Firebase connection established', 'green');

  // Step 1: Read JSON file
  logSection('Step 1: Reading JSON File');
  log(`File: ${JSON_FILE_PATH}`, 'cyan');

  if (!fs.existsSync(JSON_FILE_PATH)) {
    log(`✗ File not found: ${JSON_FILE_PATH}`, 'red');
    process.exit(1);
  }

  let jsonData;
  try {
    const fileContent = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    jsonData = JSON.parse(fileContent);
    log('✓ JSON file loaded successfully', 'green');
  } catch (error) {
    log(`✗ Failed to read/parse JSON: ${error.message}`, 'red');
    process.exit(1);
  }

  // Step 2: Validate data
  logSection('Step 2: Validating Data');
  const validation = validateData(jsonData);

  if (validation.warnings.length > 0) {
    log('\nWarnings:', 'yellow');
    validation.warnings.forEach(w => log(`  ⚠ ${w}`, 'yellow'));
  }

  if (!validation.valid) {
    log('\nValidation Errors:', 'red');
    validation.errors.forEach(e => log(`  ✗ ${e}`, 'red'));
    log(`\nValidation failed with ${validation.errors.length} error(s)`, 'red');
    process.exit(1);
  }

  log('\n✓ Validation passed', 'green');
  log(`  Groups: ${validation.stats.groupCount}`, 'cyan');
  log(`  Total Ads: ${validation.stats.totalAds}`, 'cyan');
  log(`  Codes: ${validation.stats.codes.join(', ')}`, 'cyan');

  // Step 3: Create backup
  logSection('Step 3: Creating Backup');
  const backup = await createBackup();
  if (!backup.ok) {
    log('✗ Backup failed, aborting import', 'red');
    process.exit(1);
  }

  // Step 4: Upload to Firestore
  logSection('Step 4: Uploading to Firestore');
  log('Target: catalogs/adGroups', 'cyan');
  
  const upload = await uploadToFirestore(jsonData);
  if (!upload.ok) {
    log('✗ Upload failed', 'red');
    if (backup.existed) {
      log(`Backup available at: catalogBackups/${backup.backupId}`, 'yellow');
    }
    process.exit(1);
  }

  // Step 5: Verify upload
  logSection('Step 5: Verifying Upload');
  const verify = await verifyUpload();
  
  if (!verify.ok) {
    log(`✗ Verification failed: ${verify.error}`, 'red');
    process.exit(1);
  }

  log('✓ Verification passed', 'green');
  log(`  Groups uploaded: ${verify.stats.groupCount}`, 'cyan');
  log(`  Ads uploaded: ${verify.stats.totalAds}`, 'cyan');
  log(`  Imported at: ${verify.stats.importedAt}`, 'cyan');

  // Final report
  logSection('Import Complete ✓');
  log('Summary:', 'bright');
  log(`  ✓ ${verify.stats.groupCount} code groups imported`, 'green');
  log(`  ✓ ${verify.stats.totalAds} ads imported`, 'green');
  log(`  ✓ Validation issues: 0`, 'green');
  log(`  ✓ Document path: catalogs/adGroups`, 'green');
  if (backup.existed) {
    log(`  ✓ Backup created: catalogBackups/${backup.backupId}`, 'green');
  }
  
  log('\nNext Steps:', 'cyan');
  log('  1. Verify in Admin Ads page that new code groups appear', 'cyan');
  log('  2. Test assigning a code to a user', 'cyan');
  log('  3. Verify user receives exactly 25 ads from assigned code', 'cyan');
  log('  4. Confirm product IDs remain stable during task', 'cyan');
  log('  5. Test that refresh does not change product IDs', 'cyan');

  console.log('\n');
}

// Run script
main().catch(error => {
  log(`\n✗ Script failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
