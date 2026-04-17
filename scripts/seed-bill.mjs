#!/usr/bin/env node

/**
 * Seed script for the Bill (Invoicing & Billing) app.
 * Populates the database with realistic demo data including:
 * - 5 billing clients
 * - Billing settings
 * - Billing rates
 * - 10 invoices (various statuses)
 * - Line items, payments, expenses
 *
 * Usage: node scripts/seed-bill.mjs
 *
 * Requires a running PostgreSQL with the Bill schema applied.
 * Uses DATABASE_URL env var or defaults to local dev connection.
 */

import postgres from 'postgres';
import crypto from 'node:crypto';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/bigbluebam';

const sql = postgres(DATABASE_URL);

function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('Bill seed: connecting to database...');

  // 1. Look up an existing organization and user. Honor SEED_ORG_SLUG from the
  //    orchestrator or --org-slug=<slug> CLI arg; otherwise fall back to oldest org.
  const orgSlug = process.env.SEED_ORG_SLUG
    ?? process.argv.find((a) => a.startsWith('--org-slug='))?.split('=')[1];
  const [org] = orgSlug
    ? await sql`SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    : await sql`SELECT id, name FROM organizations ORDER BY created_at LIMIT 1`;
  if (!org) {
    console.error('No organization found. Run create-admin first.');
    process.exit(1);
  }
  console.log(`Bill seed: using org "${org.name}" (${org.id})`);

  const [user] = await sql`SELECT id, display_name FROM users WHERE org_id = ${org.id} ORDER BY created_at LIMIT 1`;
  if (!user) {
    console.error('No users found. Run create-admin first.');
    process.exit(1);
  }
  console.log(`Bill seed: using user "${user.display_name}" (${user.id})`);

  // Idempotency guard: if this org already has bill_invoices, skip the whole seed.
  const [{ count: existingInvoices }] = await sql`SELECT COUNT(*)::int AS count FROM bill_invoices WHERE organization_id = ${org.id}`;
  if (existingInvoices > 0) {
    console.log(`Bill seed: ${existingInvoices} invoices already exist for this org, skipping.`);
    await sql.end();
    return;
  }

  // 2. Create billing settings
  console.log('Bill seed: creating billing settings...');
  await sql`
    INSERT INTO bill_settings (organization_id, company_name, company_email, company_phone, company_address, default_currency, default_tax_rate, default_payment_terms_days, default_payment_instructions, default_footer_text, invoice_prefix)
    VALUES (
      ${org.id},
      ${org.name},
      'billing@bigblueceiling.com',
      '(555) 123-4567',
      '123 Innovation Drive\nSuite 400\nAustin, TX 78701',
      'USD',
      8.25,
      30,
      'Wire transfer to:\nBank of America\nRouting: 026009593\nAccount: 1234567890',
      'Thank you for your business!',
      'INV'
    )
    ON CONFLICT (organization_id) DO NOTHING
  `;

  // 3. Create invoice sequence
  await sql`
    INSERT INTO bill_invoice_sequences (organization_id, prefix, next_number)
    VALUES (${org.id}, 'INV', 11)
    ON CONFLICT (organization_id) DO NOTHING
  `;

  // 4. Create 5 clients
  console.log('Bill seed: creating 5 clients...');
  const clients = [
    { name: 'Acme Corporation', email: 'ap@acme.com', phone: '(555) 100-0001', city: 'San Francisco', state: 'CA', country: 'US', terms: 30 },
    { name: 'TechStart Inc.', email: 'billing@techstart.io', phone: '(555) 200-0002', city: 'Austin', state: 'TX', country: 'US', terms: 15 },
    { name: 'Global Dynamics LLC', email: 'finance@globaldyn.com', phone: '(555) 300-0003', city: 'New York', state: 'NY', country: 'US', terms: 45 },
    { name: 'Sunrise Media Group', email: 'accounts@sunrise.media', phone: '(555) 400-0004', city: 'Los Angeles', state: 'CA', country: 'US', terms: 30 },
    { name: 'Northern Light Consulting', email: 'pay@northernlight.co', phone: '(555) 500-0005', city: 'Chicago', state: 'IL', country: 'US', terms: 60 },
  ];

  const clientIds = [];
  for (const c of clients) {
    const id = uuid();
    clientIds.push(id);
    await sql`
      INSERT INTO bill_clients (id, organization_id, name, email, phone, city, state_region, country, default_payment_terms_days, created_by)
      VALUES (${id}, ${org.id}, ${c.name}, ${c.email}, ${c.phone}, ${c.city}, ${c.state}, ${c.country}, ${c.terms}, ${user.id})
    `;
  }

  // 5. Create billing rates
  console.log('Bill seed: creating billing rates...');
  await sql`
    INSERT INTO bill_rates (organization_id, rate_amount, rate_type, currency, effective_from)
    VALUES
      (${org.id}, 15000, 'hourly', 'USD', '2026-01-01'),
      (${org.id}, 120000, 'daily', 'USD', '2026-01-01')
  `;

  // 6. Create 10 invoices
  console.log('Bill seed: creating 10 invoices...');
  const invoiceData = [
    { clientIdx: 0, number: 'INV-00001', status: 'paid', date: daysAgo(90), due: daysAgo(60), subtotal: 750000, paid: 750000 },
    { clientIdx: 1, number: 'INV-00002', status: 'paid', date: daysAgo(75), due: daysAgo(60), subtotal: 225000, paid: 225000 },
    { clientIdx: 2, number: 'INV-00003', status: 'paid', date: daysAgo(60), due: daysAgo(15), subtotal: 1200000, paid: 1200000 },
    { clientIdx: 0, number: 'INV-00004', status: 'sent', date: daysAgo(30), due: daysFromNow(0), subtotal: 480000, paid: 0 },
    { clientIdx: 3, number: 'INV-00005', status: 'overdue', date: daysAgo(45), due: daysAgo(15), subtotal: 350000, paid: 0 },
    { clientIdx: 4, number: 'INV-00006', status: 'partially_paid', date: daysAgo(40), due: daysAgo(10), subtotal: 600000, paid: 300000 },
    { clientIdx: 1, number: 'INV-00007', status: 'sent', date: daysAgo(10), due: daysFromNow(5), subtotal: 180000, paid: 0 },
    { clientIdx: 2, number: 'INV-00008', status: 'viewed', date: daysAgo(5), due: daysFromNow(40), subtotal: 950000, paid: 0 },
    { clientIdx: 0, number: 'DRAFT', status: 'draft', date: daysAgo(1), due: daysFromNow(29), subtotal: 320000, paid: 0 },
    { clientIdx: 3, number: 'INV-00010', status: 'void', date: daysAgo(50), due: daysAgo(20), subtotal: 100000, paid: 0 },
  ];

  const invoiceIds = [];
  for (const inv of invoiceData) {
    const id = uuid();
    invoiceIds.push(id);
    const clientId = clientIds[inv.clientIdx];
    const [client] = await sql`SELECT name, email FROM bill_clients WHERE id = ${clientId}`;
    const taxAmount = Math.round(inv.subtotal * 0.0825);
    const total = inv.subtotal + taxAmount;

    await sql`
      INSERT INTO bill_invoices (
        id, organization_id, client_id, invoice_number, invoice_date, due_date, status,
        subtotal, tax_rate, tax_amount, total, amount_paid, currency,
        from_name, from_email, from_address,
        to_name, to_email,
        payment_terms_days, created_by,
        sent_at, paid_at
      ) VALUES (
        ${id}, ${org.id}, ${clientId}, ${inv.number}, ${inv.date}, ${inv.due}, ${inv.status},
        ${inv.subtotal}, 8.25, ${taxAmount}, ${total}, ${inv.paid}, 'USD',
        ${org.name}, 'billing@bigblueceiling.com', '123 Innovation Drive\nAustin, TX 78701',
        ${client.name}, ${client.email},
        30, ${user.id},
        ${inv.status !== 'draft' ? new Date() : null},
        ${inv.status === 'paid' ? new Date() : null}
      )
    `;

    // Add 2-4 line items per invoice
    const lineCount = 2 + Math.floor(Math.random() * 3);
    const descriptions = [
      'Software development — sprint work',
      'UI/UX design consultation',
      'API integration development',
      'Code review and architecture',
      'DevOps and deployment',
      'Project management',
      'QA testing and bug fixes',
      'Technical documentation',
    ];

    let remainingSubtotal = inv.subtotal;
    for (let j = 0; j < lineCount; j++) {
      const isLast = j === lineCount - 1;
      const amount = isLast ? remainingSubtotal : Math.round(remainingSubtotal * (0.2 + Math.random() * 0.4));
      remainingSubtotal -= amount;
      const hours = Math.round(amount / 15000 * 100) / 100;

      await sql`
        INSERT INTO bill_line_items (invoice_id, sort_order, description, quantity, unit, unit_price, amount)
        VALUES (${id}, ${j}, ${descriptions[j % descriptions.length]}, ${hours}, 'hours', 15000, ${amount})
      `;
    }
  }

  // 7. Create payments for paid/partially_paid invoices
  console.log('Bill seed: creating payments...');
  for (let i = 0; i < invoiceData.length; i++) {
    const inv = invoiceData[i];
    if (inv.paid > 0) {
      const taxAmount = Math.round(inv.subtotal * 0.0825);
      const total = inv.subtotal + taxAmount;
      await sql`
        INSERT INTO bill_payments (invoice_id, organization_id, amount, payment_method, reference, paid_at, recorded_by)
        VALUES (${invoiceIds[i]}, ${org.id}, ${inv.paid <= total ? inv.paid : total}, 'bank_transfer', ${'REF-' + String(i + 1).padStart(4, '0')}, ${daysAgo(Math.max(0, 30 - i * 5))}, ${user.id})
      `;
    }
  }

  // 8. Create expenses
  console.log('Bill seed: creating expenses...');
  const expenses = [
    { desc: 'GitHub Team subscription', amount: 2500, cat: 'software', vendor: 'GitHub', status: 'approved' },
    { desc: 'AWS hosting — March', amount: 45000, cat: 'software', vendor: 'Amazon', status: 'approved' },
    { desc: 'Client lunch — Acme meeting', amount: 8500, cat: 'meals', vendor: 'Uchiko', status: 'approved' },
    { desc: 'Figma Pro license', amount: 1500, cat: 'software', vendor: 'Figma', status: 'approved' },
    { desc: 'Flight to NYC — Global Dynamics kickoff', amount: 42000, cat: 'travel', vendor: 'United Airlines', status: 'pending' },
    { desc: 'MacBook Pro for new hire', amount: 299900, cat: 'hardware', vendor: 'Apple', status: 'pending' },
    { desc: 'Slack Business+', amount: 1250, cat: 'software', vendor: 'Slack', status: 'approved' },
    { desc: 'Co-working space — April', amount: 35000, cat: 'office', vendor: 'WeWork', status: 'approved' },
  ];

  for (const exp of expenses) {
    await sql`
      INSERT INTO bill_expenses (organization_id, description, amount, currency, category, vendor, expense_date, status, billable, submitted_by, approved_by)
      VALUES (${org.id}, ${exp.desc}, ${exp.amount}, 'USD', ${exp.cat}, ${exp.vendor}, ${daysAgo(Math.floor(Math.random() * 30))}, ${exp.status}, false, ${user.id}, ${exp.status === 'approved' ? user.id : null})
    `;
  }

  console.log('Bill seed: done!');
  console.log(`  - 5 clients`);
  console.log(`  - 10 invoices (3 paid, 2 sent, 1 viewed, 1 overdue, 1 partial, 1 draft, 1 void)`);
  console.log(`  - ${expenses.length} expenses`);
  console.log(`  - 2 billing rates`);
  console.log(`  - billing settings configured`);

  await sql.end();
}

main().catch((err) => {
  console.error('Bill seed failed:', err);
  process.exit(1);
});
