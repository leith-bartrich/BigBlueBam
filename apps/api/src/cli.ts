import 'dotenv/config';
import argon2 from 'argon2';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { organizations } from './db/schema/organizations.js';
import { users } from './db/schema/users.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function printUsage() {
  console.log(`
BigBlueBam CLI

Usage:
  cli create-admin --email <email> --password <password> --name <name> --org <org-name> [--superuser]

Commands:
  create-admin    Create an admin user and organization

Options:
  --email         User email address
  --password      User password (min 12 characters)
  --name          Display name
  --org           Organization name
  --superuser     Grant SuperUser privileges (no value needed)
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const booleanFlags = new Set(['superuser']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (booleanFlags.has(key)) {
        result[key] = 'true';
      } else if (i + 1 < args.length) {
        result[key] = args[i + 1]!;
        i++;
      }
    }
  }
  return result;
}

async function createAdmin(flags: Record<string, string>) {
  const email = flags.email;
  const password = flags.password;
  const name = flags.name;
  const orgName = flags.org;

  if (!email || !password || !name || !orgName) {
    console.error('Error: --email, --password, --name, and --org are all required');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Error: password must be at least 12 characters');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    const passwordHash = await argon2.hash(password);
    const orgSlug = slugify(orgName);

    const [org] = await db
      .insert(organizations)
      .values({
        name: orgName,
        slug: orgSlug,
      })
      .returning();

    const isSuperuser = flags.superuser === 'true';

    const [user] = await db
      .insert(users)
      .values({
        org_id: org!.id,
        email,
        display_name: name,
        password_hash: passwordHash,
        role: 'owner',
        is_superuser: isSuperuser,
      })
      .returning();

    console.log('Admin user created successfully:');
    console.log(`  User ID: ${user!.id}`);
    console.log(`  Email: ${user!.email}`);
    console.log(`  Org ID: ${org!.id}`);
    console.log(`  Org Slug: ${org!.slug}`);
    if (isSuperuser) {
      console.log(`  SuperUser: yes`);
    }
  } catch (err) {
    console.error('Failed to create admin:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  if (command === 'create-admin') {
    const flags = parseArgs(args.slice(1));
    await createAdmin(flags);
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('CLI error:', err);
  process.exit(1);
});
