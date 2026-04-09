-- 0038_bill_tables.sql
-- Why: Create schema for Bill (Invoicing & Billing) — clients, invoices, line items,
--       payments, expenses, rates, invoice sequences, and org billing settings.
-- Client impact: additive only

-- ============================================================
-- BILL: Invoicing & Billing
-- ============================================================

-- 1. Billing clients (may map to Bond companies or standalone)
CREATE TABLE IF NOT EXISTS bill_clients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255),
    phone               VARCHAR(50),
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state_region        VARCHAR(100),
    postal_code         VARCHAR(20),
    country             VARCHAR(2),
    tax_id              VARCHAR(50),
    bond_company_id     UUID,
    default_payment_terms_days INTEGER NOT NULL DEFAULT 30,
    default_payment_instructions TEXT,
    notes               TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_clients_org ON bill_clients(organization_id);

-- 2. Billing rates
CREATE TABLE IF NOT EXISTS bill_rates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    rate_amount         BIGINT NOT NULL,
    rate_type           VARCHAR(10) NOT NULL DEFAULT 'hourly'
                        CHECK (rate_type IN ('hourly', 'daily', 'fixed')),
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_rates_org ON bill_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_bill_rates_resolve ON bill_rates(organization_id, project_id, user_id, effective_from);

-- 3. Invoice number sequence (per org, gap-free)
CREATE TABLE IF NOT EXISTS bill_invoice_sequences (
    organization_id     UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    prefix              VARCHAR(20) NOT NULL DEFAULT 'INV',
    next_number         INTEGER NOT NULL DEFAULT 1,
    format_pattern      VARCHAR(50) NOT NULL DEFAULT '{prefix}-{number:05d}'
);

-- 4. Invoices
CREATE TABLE IF NOT EXISTS bill_invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id           UUID NOT NULL REFERENCES bill_clients(id) ON DELETE RESTRICT,
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    invoice_number      VARCHAR(50) NOT NULL,
    invoice_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date            DATE NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'void', 'written_off')),
    subtotal            BIGINT NOT NULL DEFAULT 0,
    tax_rate            NUMERIC(5,2) DEFAULT 0,
    tax_amount          BIGINT NOT NULL DEFAULT 0,
    discount_amount     BIGINT NOT NULL DEFAULT 0,
    total               BIGINT NOT NULL DEFAULT 0,
    amount_paid         BIGINT NOT NULL DEFAULT 0,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    from_name           VARCHAR(255),
    from_email          VARCHAR(255),
    from_address        TEXT,
    from_logo_url       TEXT,
    from_tax_id         VARCHAR(50),
    to_name             VARCHAR(255),
    to_email            VARCHAR(255),
    to_address          TEXT,
    to_tax_id           VARCHAR(50),
    payment_terms_days  INTEGER NOT NULL DEFAULT 30,
    payment_instructions TEXT,
    notes               TEXT,
    footer_text         TEXT,
    terms_text          TEXT,
    bond_deal_id        UUID,
    pdf_url             TEXT,
    public_view_token   VARCHAR(64) DEFAULT encode(gen_random_bytes(32), 'hex'),
    sent_at             TIMESTAMPTZ,
    viewed_at           TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    overdue_reminder_sent_at TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_invoices_org ON bill_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_bill_invoices_client ON bill_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_bill_invoices_project ON bill_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_bill_invoices_status ON bill_invoices(status);
CREATE INDEX IF NOT EXISTS idx_bill_invoices_number ON bill_invoices(organization_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_bill_invoices_token ON bill_invoices(public_view_token);

-- 5. Invoice line items
CREATE TABLE IF NOT EXISTS bill_line_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES bill_invoices(id) ON DELETE CASCADE,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    description         TEXT NOT NULL,
    quantity            NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit                VARCHAR(20) DEFAULT 'hours',
    unit_price          BIGINT NOT NULL,
    amount              BIGINT NOT NULL,
    time_entry_ids      UUID[],
    task_id             UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_invoice ON bill_line_items(invoice_id, sort_order);

-- 6. Payments received
CREATE TABLE IF NOT EXISTS bill_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES bill_invoices(id) ON DELETE CASCADE,
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount              BIGINT NOT NULL,
    payment_method      VARCHAR(30)
                        CHECK (payment_method IN ('bank_transfer', 'credit_card', 'check', 'cash', 'stripe', 'paypal', 'other')),
    reference           VARCHAR(255),
    notes               TEXT,
    paid_at             DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by         UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_invoice ON bill_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_org ON bill_payments(organization_id, paid_at DESC);

-- 7. Expenses
CREATE TABLE IF NOT EXISTS bill_expenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    description         TEXT NOT NULL,
    amount              BIGINT NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    category            VARCHAR(60),
    vendor              VARCHAR(255),
    expense_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url         TEXT,
    receipt_filename    VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    approved_by         UUID REFERENCES users(id),
    billable            BOOLEAN NOT NULL DEFAULT false,
    invoiced            BOOLEAN NOT NULL DEFAULT false,
    invoice_id          UUID REFERENCES bill_invoices(id) ON DELETE SET NULL,
    submitted_by        UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_expenses_org ON bill_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_bill_expenses_project ON bill_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_bill_expenses_status ON bill_expenses(status);
CREATE INDEX IF NOT EXISTS idx_bill_expenses_date ON bill_expenses(expense_date DESC);

-- 8. Organization billing settings
CREATE TABLE IF NOT EXISTS bill_settings (
    organization_id     UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    company_name        VARCHAR(255),
    company_email       VARCHAR(255),
    company_phone       VARCHAR(50),
    company_address     TEXT,
    company_logo_url    TEXT,
    company_tax_id      VARCHAR(50),
    default_currency    VARCHAR(3) NOT NULL DEFAULT 'USD',
    default_tax_rate    NUMERIC(5,2) DEFAULT 0,
    default_payment_terms_days INTEGER NOT NULL DEFAULT 30,
    default_payment_instructions TEXT,
    default_footer_text TEXT,
    default_terms_text  TEXT,
    invoice_prefix      VARCHAR(20) NOT NULL DEFAULT 'INV',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
