// Shared BBB table stubs (auth, users, orgs, projects)
export {
  organizations,
  users,
  sessions,
  apiKeys,
  organizationMemberships,
  projects,
} from './bbb-refs.js';

// Bill-specific tables
export { billClients } from './bill-clients.js';
export { billRates } from './bill-rates.js';
export { billInvoiceSequences } from './bill-invoice-sequences.js';
export { billInvoices } from './bill-invoices.js';
export { billLineItems } from './bill-line-items.js';
export { billPayments } from './bill-payments.js';
export { billExpenses } from './bill-expenses.js';
export { billSettings } from './bill-settings.js';
