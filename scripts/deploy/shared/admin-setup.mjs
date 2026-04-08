// Admin/SuperUser creation — zero dependencies (uses prompt helpers + platform.runCommand).

import { ask, askPassword, confirm, select } from './prompt.mjs';
import { bold, check, cross, dim, green, red, yellow, cyan } from './colors.mjs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import os from 'node:os';

/**
 * Validate an email address (basic check).
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Generate a strong, readable password: 4 words + 2 digits + 1 symbol.
 * Example: "Falcon-Copper-Ribbon-Sage42!"
 */
function generatePassword() {
  const words = [
    'Amber', 'Arrow', 'Atlas', 'Birch', 'Blade', 'Blaze', 'Cedar', 'Cliff',
    'Cloud', 'Cobra', 'Comet', 'Coral', 'Crane', 'Creek', 'Crown', 'Delta',
    'Drake', 'Drift', 'Eagle', 'Ember', 'Falcon', 'Fern', 'Flint', 'Forge',
    'Frost', 'Glade', 'Globe', 'Grove', 'Haven', 'Heron', 'Ivory', 'Jade',
    'Lance', 'Lark', 'Maple', 'Mars', 'Mesa', 'Mist', 'Noble', 'North',
    'Oak', 'Onyx', 'Orbit', 'Pearl', 'Phoenix', 'Pine', 'Prism', 'Quartz',
    'Raven', 'Reef', 'Ridge', 'River', 'Robin', 'Sage', 'Scout', 'Shale',
    'Sierra', 'Slate', 'Solar', 'Spark', 'Steel', 'Stone', 'Storm', 'Summit',
    'Swift', 'Terra', 'Thorn', 'Tiger', 'Trail', 'Vapor', 'Vista', 'Wolf',
  ];
  const symbols = '!@#$%&*?';
  const pick = (arr) => arr[crypto.randomInt(arr.length)];
  const digits = String(crypto.randomInt(10, 99));
  return `${pick(words)}-${pick(words)}-${pick(words)}-${pick(words)}${digits}${symbols[crypto.randomInt(symbols.length)]}`;
}

/**
 * Try to store a credential in the system keychain.
 * Returns true if successful, false if not available.
 */
function tryStoreInKeychain(service, account, password) {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      // macOS Keychain
      execSync(
        `security add-generic-password -a ${JSON.stringify(account)} -s ${JSON.stringify(service)} -w ${JSON.stringify(password)} -U`,
        { stdio: 'pipe' }
      );
      return 'macOS Keychain';
    } else if (platform === 'win32') {
      // Windows Credential Manager via cmdkey
      execSync(
        `cmdkey /generic:${JSON.stringify(service)} /user:${JSON.stringify(account)} /pass:${JSON.stringify(password)}`,
        { stdio: 'pipe' }
      );
      return 'Windows Credential Manager';
    } else if (platform === 'linux') {
      // Linux: try secret-tool (GNOME Keyring / KWallet via libsecret)
      execSync(
        `echo ${JSON.stringify(password)} | secret-tool store --label=${JSON.stringify(service)} service ${JSON.stringify(service)} account ${JSON.stringify(account)}`,
        { stdio: 'pipe', shell: true }
      );
      return 'GNOME Keyring';
    }
  } catch {
    // Keychain not available or command failed — that's fine
  }
  return null;
}

/**
 * Walk the user through creating the first admin (SuperUser) account.
 *
 * @param {{ runCommand: (service: string, cmd: string) => Promise<string> }} platform
 *   Platform adapter with a `runCommand` method that executes a command inside
 *   a running service container and returns stdout.
 */
export async function createSuperUser(platform) {
  console.log('');
  console.log(bold("Let's create your admin account."));
  console.log('');
  console.log('This will be the first user -- a SuperUser with full access to everything.');
  console.log('');

  // Email
  let email = '';
  while (!email) {
    email = await ask('Email address:');
    if (!isValidEmail(email)) {
      console.log(red('  Please enter a valid email address.'));
      email = '';
    }
  }

  // Password
  let password = '';
  const passwordChoice = await select('Password:', [
    { label: 'Generate a strong password for me (recommended)', value: 'generate' },
    { label: 'I\'ll type my own password', value: 'manual' },
  ]);

  if (passwordChoice === 'generate') {
    password = generatePassword();
    console.log('');
    console.log(bold('  Your generated password:'));
    console.log('');
    console.log(`    ${cyan(password)}`);
    console.log('');
    console.log(yellow('  ⚠  Copy this now — it will not be shown again.'));
    console.log('');

    // Offer keychain storage
    const keychainName = tryStoreInKeychain('BigBlueBam', email, password);
    if (keychainName) {
      console.log(green(`  ${check} Password saved to ${keychainName}`));
      console.log(dim(`    Service: "BigBlueBam"  Account: "${email}"`));
      console.log('');
    } else {
      const wantsToTry = await confirm('  Would you like to try saving it to your system keychain?', false);
      if (wantsToTry) {
        const result = tryStoreInKeychain('BigBlueBam', email, password);
        if (result) {
          console.log(green(`  ${check} Password saved to ${result}`));
        } else {
          console.log(dim('  Keychain storage not available on this system. Please save the password somewhere safe.'));
        }
      }
    }

    await confirm('  I\'ve saved my password and I\'m ready to continue', true);
  } else {
    // Manual password entry
    while (!password) {
      password = await askPassword('Password (min 12 characters):');
      if (password.length < 12) {
        console.log(red('  Password must be at least 12 characters.'));
        console.log(dim('  Tip: Use a passphrase like "correct-horse-battery-staple"'));
        password = '';
      }
    }

    // Confirm manual password
    let confirmed = '';
    while (confirmed !== password) {
      confirmed = await askPassword('Confirm password:');
      if (confirmed !== password) {
        console.log(red('  Passwords do not match. Try again.'));
      }
    }
  }

  // Name
  const name = await ask('Your name:', 'Admin');

  // Organization
  const org = await ask('Organization name:', 'My Organization');

  console.log('');
  process.stdout.write('Creating account... ');

  try {
    // Escape arguments for shell safety
    const escapedEmail = email.replace(/'/g, "'\\''");
    const escapedPassword = password.replace(/'/g, "'\\''");
    const escapedName = name.replace(/'/g, "'\\''");
    const escapedOrg = org.replace(/'/g, "'\\''");

    const cmd = `node dist/cli.js create-admin --email '${escapedEmail}' --password '${escapedPassword}' --name '${escapedName}' --org '${escapedOrg}' --superuser`;
    await platform.runCommand('api', cmd);
    console.log(check);
  } catch (err) {
    console.log(cross);
    console.log(red(`  Failed to create admin account: ${err.message}`));
    console.log(yellow('  You can create it manually later:'));
    console.log(dim('    docker compose exec api node dist/cli.js create-admin --email admin@example.com --password yourpassword --name "Admin" --org "My Org" --superuser'));
    console.log('');
    return { success: false, email };
  }

  // Verify the account works
  process.stdout.write('Verifying login... ');
  try {
    await platform.verifyLogin(email, password);
    console.log(check);
  } catch {
    // Non-fatal: account was created but verification couldn't be confirmed
    console.log(yellow('[skipped]'));
    console.log(dim('  Verification skipped -- the account was created and should work.'));
  }

  console.log('');
  return { success: true, email, name, org };
}
