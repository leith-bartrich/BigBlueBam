// Admin/SuperUser creation — zero dependencies (uses prompt helpers + platform.runCommand).

import { ask, askPassword } from './prompt.mjs';
import { bold, check, cross, dim, green, red, yellow } from './colors.mjs';

/**
 * Validate an email address (basic check).
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  while (!password) {
    password = await askPassword('Password (min 12 characters):');
    if (password.length < 12) {
      console.log(red('  Password must be at least 12 characters.'));
      password = '';
    }
  }

  // Confirm password
  let confirmed = '';
  while (confirmed !== password) {
    confirmed = await askPassword('Confirm password:');
    if (confirmed !== password) {
      console.log(red('  Passwords do not match. Try again.'));
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
