-- Seed Bond (CRM) demo data for Mage Inc
-- Run: docker compose exec -T postgres psql -U bigbluebam < scripts/seed-bond.sql

DO $$
DECLARE
  v_org UUID := '57158e52-227d-4903-b0d8-d9f3c4910f61';
  v_u1 UUID := '65429e63-65c7-4f74-a19e-977217128edc';  -- Eddie
  v_u2 UUID := 'cffb3330-4868-4741-95f4-564efe27836a';  -- Sarah
  v_u3 UUID := 'f290dd98-65fa-403a-9778-6dbda873fc98';  -- Dev
  v_u4 UUID := '138894b9-58ef-4eb4-9d27-bf36fff48885';  -- Alex
  v_u5 UUID := 'baa36964-d672-4271-ae96-b0cf5b1062a4';  -- Morgan
  v_u6 UUID := '5e77088e-6d83-4821-8f9d-7857d2aefb68';  -- Jordan

  -- Pipelines
  p_sales UUID; p_partner UUID;

  -- Sales pipeline stages
  s_prospect UUID; s_qualify UUID; s_proposal UUID; s_negotiate UUID; s_commit UUID;
  s_sales_won UUID; s_sales_lost UUID;

  -- Partnership pipeline stages
  s_outreach UUID; s_eval UUID; s_terms UUID; s_legal UUID; s_launch UUID;
  s_partner_won UUID; s_partner_lost UUID;

  -- Companies
  co1 UUID; co2 UUID; co3 UUID; co4 UUID; co5 UUID;
  co6 UUID; co7 UUID; co8 UUID; co9 UUID; co10 UUID;

  -- Contacts
  ct1 UUID; ct2 UUID; ct3 UUID; ct4 UUID; ct5 UUID;
  ct6 UUID; ct7 UUID; ct8 UUID; ct9 UUID; ct10 UUID;
  ct11 UUID; ct12 UUID; ct13 UUID; ct14 UUID; ct15 UUID;
  ct16 UUID; ct17 UUID; ct18 UUID; ct19 UUID; ct20 UUID;
  ct21 UUID; ct22 UUID; ct23 UUID; ct24 UUID; ct25 UUID;
  ct26 UUID; ct27 UUID; ct28 UUID; ct29 UUID; ct30 UUID;

  -- Deals
  d1 UUID; d2 UUID; d3 UUID; d4 UUID; d5 UUID;
  d6 UUID; d7 UUID; d8 UUID; d9 UUID; d10 UUID;
  d11 UUID; d12 UUID; d13 UUID; d14 UUID; d15 UUID;

BEGIN
  -- ══════════════════════════════════════════════════════════════
  -- Clean existing Bond data for this org
  -- ══════════════════════════════════════════════════════════════
  DELETE FROM bond_lead_scoring_rules WHERE organization_id = v_org;
  DELETE FROM bond_activities WHERE organization_id = v_org;
  DELETE FROM bond_deal_stage_history WHERE deal_id IN (SELECT id FROM bond_deals WHERE organization_id = v_org);
  DELETE FROM bond_deal_contacts WHERE deal_id IN (SELECT id FROM bond_deals WHERE organization_id = v_org);
  DELETE FROM bond_deals WHERE organization_id = v_org;
  DELETE FROM bond_contact_companies WHERE contact_id IN (SELECT id FROM bond_contacts WHERE organization_id = v_org);
  DELETE FROM bond_pipeline_stages WHERE pipeline_id IN (SELECT id FROM bond_pipelines WHERE organization_id = v_org);
  DELETE FROM bond_pipelines WHERE organization_id = v_org;
  DELETE FROM bond_contacts WHERE organization_id = v_org;
  DELETE FROM bond_companies WHERE organization_id = v_org;
  DELETE FROM bond_custom_field_definitions WHERE organization_id = v_org;

  -- ══════════════════════════════════════════════════════════════
  -- 1. PIPELINES (2)
  -- ══════════════════════════════════════════════════════════════
  p_sales := gen_random_uuid();
  p_partner := gen_random_uuid();

  INSERT INTO bond_pipelines (id, organization_id, name, description, is_default, currency, created_by) VALUES
    (p_sales,   v_org, 'Sales',        'Standard B2B sales pipeline',           true,  'USD', v_u1),
    (p_partner, v_org, 'Partnerships', 'Strategic partnership deal pipeline',   false, 'USD', v_u1);

  -- ── Sales pipeline stages (5 active + won + lost) ──
  s_prospect  := gen_random_uuid();
  s_qualify   := gen_random_uuid();
  s_proposal  := gen_random_uuid();
  s_negotiate := gen_random_uuid();
  s_commit    := gen_random_uuid();
  s_sales_won := gen_random_uuid();
  s_sales_lost := gen_random_uuid();

  INSERT INTO bond_pipeline_stages (id, pipeline_id, name, sort_order, stage_type, probability_pct, rotting_days, color) VALUES
    (s_prospect,    p_sales, 'Prospect',     0, 'active', 10, 14, '#6366F1'),
    (s_qualify,     p_sales, 'Qualification', 1, 'active', 25, 10, '#3B82F6'),
    (s_proposal,    p_sales, 'Proposal',      2, 'active', 50, 7,  '#F59E0B'),
    (s_negotiate,   p_sales, 'Negotiation',   3, 'active', 75, 7,  '#F97316'),
    (s_commit,      p_sales, 'Commitment',    4, 'active', 90, 5,  '#10B981'),
    (s_sales_won,   p_sales, 'Closed Won',    5, 'won',   100, NULL, '#22C55E'),
    (s_sales_lost,  p_sales, 'Closed Lost',   6, 'lost',    0, NULL, '#EF4444');

  -- ── Partnership pipeline stages (5 active + won + lost) ──
  s_outreach     := gen_random_uuid();
  s_eval         := gen_random_uuid();
  s_terms        := gen_random_uuid();
  s_legal        := gen_random_uuid();
  s_launch       := gen_random_uuid();
  s_partner_won  := gen_random_uuid();
  s_partner_lost := gen_random_uuid();

  INSERT INTO bond_pipeline_stages (id, pipeline_id, name, sort_order, stage_type, probability_pct, rotting_days, color) VALUES
    (s_outreach,      p_partner, 'Outreach',         0, 'active', 10, 21, '#8B5CF6'),
    (s_eval,          p_partner, 'Evaluation',        1, 'active', 30, 14, '#6366F1'),
    (s_terms,         p_partner, 'Terms Discussion',  2, 'active', 55, 10, '#3B82F6'),
    (s_legal,         p_partner, 'Legal Review',      3, 'active', 80, 14, '#F59E0B'),
    (s_launch,        p_partner, 'Launch Planning',   4, 'active', 95,  7, '#10B981'),
    (s_partner_won,   p_partner, 'Partnership Live',  5, 'won',   100, NULL, '#22C55E'),
    (s_partner_lost,  p_partner, 'Declined',          6, 'lost',    0, NULL, '#EF4444');

  -- ══════════════════════════════════════════════════════════════
  -- 2. COMPANIES (10)
  -- ══════════════════════════════════════════════════════════════
  co1 := gen_random_uuid();  co2 := gen_random_uuid();  co3 := gen_random_uuid();
  co4 := gen_random_uuid();  co5 := gen_random_uuid();  co6 := gen_random_uuid();
  co7 := gen_random_uuid();  co8 := gen_random_uuid();  co9 := gen_random_uuid();
  co10 := gen_random_uuid();

  INSERT INTO bond_companies (id, organization_id, name, domain, industry, size_bucket, annual_revenue, phone, website, created_by) VALUES
    (co1,  v_org, 'Acme Corp',           'acme.com',           'Technology',      '201-1000',  50000000,  '+1-555-0101', 'https://acme.com',           v_u1),
    (co2,  v_org, 'Globex Industries',    'globex.io',          'Manufacturing',   '1001-5000', 120000000, '+1-555-0102', 'https://globex.io',          v_u2),
    (co3,  v_org, 'Initech Solutions',    'initech.dev',        'Technology',      '51-200',    15000000,  '+1-555-0103', 'https://initech.dev',        v_u3),
    (co4,  v_org, 'Stark Dynamics',       'starkdyn.com',       'Aerospace',       '5000+',     800000000, '+1-555-0104', 'https://starkdyn.com',       v_u1),
    (co5,  v_org, 'Wayne Financial',      'waynefin.com',       'Financial Services', '1001-5000', 250000000, '+1-555-0105', 'https://waynefin.com',    v_u4),
    (co6,  v_org, 'Umbrella Health',      'umbrellahealth.org', 'Healthcare',      '201-1000',  35000000,  '+1-555-0106', 'https://umbrellahealth.org', v_u5),
    (co7,  v_org, 'Cyberdyne Analytics',  'cyberdyne.ai',       'Technology',      '11-50',     4000000,   '+1-555-0107', 'https://cyberdyne.ai',       v_u3),
    (co8,  v_org, 'Oscorp Biotech',       'oscorp.bio',         'Biotechnology',   '51-200',    22000000,  '+1-555-0108', 'https://oscorp.bio',         v_u6),
    (co9,  v_org, 'Pied Piper Cloud',     'piedpiper.cloud',    'Technology',      '11-50',     2500000,   '+1-555-0109', 'https://piedpiper.cloud',    v_u2),
    (co10, v_org, 'Soylent Logistics',    'soylent.supply',     'Logistics',       '201-1000',  40000000,  '+1-555-0110', 'https://soylent.supply',     v_u4);

  -- ══════════════════════════════════════════════════════════════
  -- 3. CONTACTS (30)
  -- ══════════════════════════════════════════════════════════════
  ct1  := gen_random_uuid(); ct2  := gen_random_uuid(); ct3  := gen_random_uuid();
  ct4  := gen_random_uuid(); ct5  := gen_random_uuid(); ct6  := gen_random_uuid();
  ct7  := gen_random_uuid(); ct8  := gen_random_uuid(); ct9  := gen_random_uuid();
  ct10 := gen_random_uuid(); ct11 := gen_random_uuid(); ct12 := gen_random_uuid();
  ct13 := gen_random_uuid(); ct14 := gen_random_uuid(); ct15 := gen_random_uuid();
  ct16 := gen_random_uuid(); ct17 := gen_random_uuid(); ct18 := gen_random_uuid();
  ct19 := gen_random_uuid(); ct20 := gen_random_uuid(); ct21 := gen_random_uuid();
  ct22 := gen_random_uuid(); ct23 := gen_random_uuid(); ct24 := gen_random_uuid();
  ct25 := gen_random_uuid(); ct26 := gen_random_uuid(); ct27 := gen_random_uuid();
  ct28 := gen_random_uuid(); ct29 := gen_random_uuid(); ct30 := gen_random_uuid();

  INSERT INTO bond_contacts (id, organization_id, first_name, last_name, email, phone, title, lifecycle_stage, lead_source, lead_score, owner_id, last_contacted_at, created_by) VALUES
    (ct1,  v_org, 'Lena',     'Park',      'lena.park@acme.com',            '+1-555-1001', 'VP of Engineering',    'customer',            'referral',    85, v_u1, NOW() - INTERVAL '2 days',  v_u1),
    (ct2,  v_org, 'Marcus',   'Webb',      'marcus@acme.com',               '+1-555-1002', 'CTO',                  'customer',            'conference',  92, v_u1, NOW() - INTERVAL '1 day',   v_u1),
    (ct3,  v_org, 'Priya',    'Sharma',    'priya.sharma@globex.io',        '+1-555-1003', 'Head of Product',      'sales_qualified',     'website',     71, v_u2, NOW() - INTERVAL '3 days',  v_u2),
    (ct4,  v_org, 'James',    'Thornton',  'jthornton@globex.io',           '+1-555-1004', 'Procurement Manager',  'opportunity',         'outbound',    58, v_u2, NOW() - INTERVAL '5 days',  v_u2),
    (ct5,  v_org, 'Sofia',    'Chen',      'sofia.chen@initech.dev',        '+1-555-1005', 'CEO',                  'lead',                'website',     45, v_u3, NOW() - INTERVAL '10 days', v_u3),
    (ct6,  v_org, 'Daniel',   'Kim',       'dkim@initech.dev',              '+1-555-1006', 'Engineering Lead',     'marketing_qualified', 'webinar',     38, v_u3, NULL,                        v_u3),
    (ct7,  v_org, 'Aisha',    'Johnson',   'aisha.j@starkdyn.com',         '+1-555-1007', 'VP of IT',             'opportunity',         'referral',    78, v_u1, NOW() - INTERVAL '1 day',   v_u1),
    (ct8,  v_org, 'Robert',   'Mueller',   'rmueller@starkdyn.com',        '+1-555-1008', 'CISO',                 'sales_qualified',     'conference',  65, v_u4, NOW() - INTERVAL '4 days',  v_u4),
    (ct9,  v_org, 'Yuki',     'Tanaka',    'yuki@waynefin.com',            '+1-555-1009', 'Director of Ops',      'customer',            'inbound',     88, v_u4, NOW() - INTERVAL '1 day',   v_u4),
    (ct10, v_org, 'Elena',    'Volkov',    'elena.v@waynefin.com',          '+1-555-1010', 'CFO',                  'customer',            'referral',    95, v_u4, NOW() - INTERVAL '6 hours', v_u4),
    (ct11, v_org, 'Carlos',   'Mendez',    'carlos@umbrellahealth.org',     '+1-555-1011', 'CIO',                  'lead',                'website',     32, v_u5, NULL,                        v_u5),
    (ct12, v_org, 'Hannah',   'Reeves',    'hreeves@umbrellahealth.org',    '+1-555-1012', 'IT Manager',           'subscriber',          'newsletter',  18, v_u5, NULL,                        v_u5),
    (ct13, v_org, 'Oscar',    'Nguyen',    'oscar@cyberdyne.ai',            '+1-555-1013', 'Founder & CEO',        'sales_qualified',     'outbound',    55, v_u3, NOW() - INTERVAL '7 days',  v_u3),
    (ct14, v_org, 'Fatima',   'Al-Rashid', 'fatima@cyberdyne.ai',           '+1-555-1014', 'Head of Engineering',  'marketing_qualified', 'webinar',     42, v_u3, NOW() - INTERVAL '14 days', v_u3),
    (ct15, v_org, 'William',  'Hart',      'whart@oscorp.bio',              '+1-555-1015', 'VP of R&D',            'opportunity',         'conference',  67, v_u6, NOW() - INTERVAL '2 days',  v_u6),
    (ct16, v_org, 'Nina',     'Petrov',    'nina.p@oscorp.bio',             '+1-555-1016', 'Lab Director',         'lead',                'website',     28, v_u6, NULL,                        v_u6),
    (ct17, v_org, 'Richard',  'Hendricks', 'richard@piedpiper.cloud',       '+1-555-1017', 'CEO',                  'evangelist',          'referral',    98, v_u2, NOW() - INTERVAL '1 day',   v_u2),
    (ct18, v_org, 'Dinesh',   'Chugtai',   'dinesh@piedpiper.cloud',        '+1-555-1018', 'CTO',                  'customer',            'referral',    82, v_u2, NOW() - INTERVAL '3 days',  v_u2),
    (ct19, v_org, 'Grace',    'Hopper',    'grace@soylent.supply',          '+1-555-1019', 'Director of Tech',     'sales_qualified',     'outbound',    60, v_u4, NOW() - INTERVAL '5 days',  v_u4),
    (ct20, v_org, 'Sam',      'Bridges',   'sam.b@soylent.supply',          '+1-555-1020', 'Logistics Lead',       'lead',                'website',     22, v_u4, NULL,                        v_u4),
    (ct21, v_org, 'Zara',     'Khan',      'zara.khan@acme.com',            '+1-555-1021', 'Product Manager',      'customer',            'inbound',     76, v_u1, NOW() - INTERVAL '8 hours', v_u1),
    (ct22, v_org, 'Tobias',   'Funke',     'tobias@globex.io',              '+1-555-1022', 'Sales Director',       'opportunity',         'conference',  63, v_u2, NOW() - INTERVAL '2 days',  v_u2),
    (ct23, v_org, 'Ivy',      'Chang',     'ivy.chang@starkdyn.com',        '+1-555-1023', 'Software Architect',   'marketing_qualified', 'webinar',     47, v_u1, NOW() - INTERVAL '9 days',  v_u1),
    (ct24, v_org, 'Leo',      'Rossi',     'leo.r@waynefin.com',            '+1-555-1024', 'Head of Compliance',   'customer',            'referral',    83, v_u4, NOW() - INTERVAL '1 day',   v_u4),
    (ct25, v_org, 'Mei',      'Lin',       'mei@cyberdyne.ai',              '+1-555-1025', 'ML Engineer',          'subscriber',          'newsletter',  15, v_u3, NULL,                        v_u3),
    (ct26, v_org, 'Andre',    'Dupont',    'andre@oscorp.bio',              '+1-555-1026', 'Clinical Lead',        'lead',                'outbound',    35, v_u6, NULL,                        v_u6),
    (ct27, v_org, 'Nora',     'Ahmed',     'nora@umbrellahealth.org',       '+1-555-1027', 'Dept Head Radiology',  'marketing_qualified', 'webinar',     41, v_u5, NOW() - INTERVAL '12 days', v_u5),
    (ct28, v_org, 'Viktor',   'Kozlov',    'viktor@initech.dev',            '+1-555-1028', 'Backend Lead',         'lead',                'website',     29, v_u3, NULL,                        v_u3),
    (ct29, v_org, 'Bella',    'Santos',    'bella.s@piedpiper.cloud',       '+1-555-1029', 'Head of Sales',        'customer',            'inbound',     80, v_u2, NOW() - INTERVAL '2 days',  v_u2),
    (ct30, v_org, 'Kai',      'Nakamura',  'kai@soylent.supply',            '+1-555-1030', 'CTO',                  'sales_qualified',     'conference',  57, v_u4, NOW() - INTERVAL '6 days',  v_u4);

  -- ── Link contacts to companies ──
  INSERT INTO bond_contact_companies (contact_id, company_id, role_at_company, is_primary) VALUES
    (ct1,  co1, 'VP of Engineering',   true),
    (ct2,  co1, 'CTO',                 true),
    (ct21, co1, 'Product Manager',     true),
    (ct3,  co2, 'Head of Product',     true),
    (ct4,  co2, 'Procurement Manager', true),
    (ct22, co2, 'Sales Director',      true),
    (ct5,  co3, 'CEO',                 true),
    (ct6,  co3, 'Engineering Lead',    true),
    (ct28, co3, 'Backend Lead',        true),
    (ct7,  co4, 'VP of IT',            true),
    (ct8,  co4, 'CISO',               true),
    (ct23, co4, 'Software Architect',  true),
    (ct9,  co5, 'Director of Ops',     true),
    (ct10, co5, 'CFO',                true),
    (ct24, co5, 'Head of Compliance',  true),
    (ct11, co6, 'CIO',                true),
    (ct12, co6, 'IT Manager',         true),
    (ct27, co6, 'Dept Head Radiology', true),
    (ct13, co7, 'Founder & CEO',      true),
    (ct14, co7, 'Head of Engineering', true),
    (ct25, co7, 'ML Engineer',        true),
    (ct15, co8, 'VP of R&D',          true),
    (ct16, co8, 'Lab Director',       true),
    (ct26, co8, 'Clinical Lead',      true),
    (ct17, co9, 'CEO',                true),
    (ct18, co9, 'CTO',               true),
    (ct29, co9, 'Head of Sales',      true),
    (ct19, co10, 'Director of Tech',  true),
    (ct20, co10, 'Logistics Lead',    true),
    (ct30, co10, 'CTO',              true);

  -- ══════════════════════════════════════════════════════════════
  -- 4. DEALS (15)
  -- ══════════════════════════════════════════════════════════════
  d1  := gen_random_uuid(); d2  := gen_random_uuid(); d3  := gen_random_uuid();
  d4  := gen_random_uuid(); d5  := gen_random_uuid(); d6  := gen_random_uuid();
  d7  := gen_random_uuid(); d8  := gen_random_uuid(); d9  := gen_random_uuid();
  d10 := gen_random_uuid(); d11 := gen_random_uuid(); d12 := gen_random_uuid();
  d13 := gen_random_uuid(); d14 := gen_random_uuid(); d15 := gen_random_uuid();

  INSERT INTO bond_deals (id, organization_id, pipeline_id, stage_id, name, description, value, currency, expected_close_date, probability_pct, closed_at, close_reason, lost_to_competitor, owner_id, company_id, stage_entered_at, last_activity_at, created_by, created_at) VALUES
    -- Sales pipeline deals
    (d1,  v_org, p_sales, s_prospect,    'Acme Enterprise Expansion',         'Expand to 500 seats',               12000000, 'USD', '2026-07-15', 10,   NULL, NULL, NULL,           v_u1, co1,  NOW() - INTERVAL '3 days',  NOW() - INTERVAL '1 day',  v_u1, NOW() - INTERVAL '5 days'),
    (d2,  v_org, p_sales, s_qualify,     'Globex Platform Migration',         'Migrate from legacy to our stack',   8500000, 'USD', '2026-06-30', 25,   NULL, NULL, NULL,           v_u2, co2,  NOW() - INTERVAL '7 days',  NOW() - INTERVAL '2 days', v_u2, NOW() - INTERVAL '14 days'),
    (d3,  v_org, p_sales, s_proposal,    'Initech Dev Tools License',         'Annual license for dev tooling',     3200000, 'USD', '2026-05-30', 50,   NULL, NULL, NULL,           v_u3, co3,  NOW() - INTERVAL '5 days',  NOW() - INTERVAL '1 day',  v_u3, NOW() - INTERVAL '21 days'),
    (d4,  v_org, p_sales, s_negotiate,   'Stark Dynamics Security Suite',     'Enterprise security platform',      25000000, 'USD', '2026-06-15', 75,   NULL, NULL, NULL,           v_u1, co4,  NOW() - INTERVAL '4 days',  NOW() - INTERVAL '6 hours', v_u1, NOW() - INTERVAL '30 days'),
    (d5,  v_org, p_sales, s_commit,      'Wayne Financial Analytics',         'Custom analytics dashboard',        18000000, 'USD', '2026-05-15', 90,   NULL, NULL, NULL,           v_u4, co5,  NOW() - INTERVAL '2 days',  NOW() - INTERVAL '3 hours', v_u4, NOW() - INTERVAL '45 days'),
    (d6,  v_org, p_sales, s_sales_won,   'Pied Piper Full Platform',         'Full platform + support',            6500000, 'USD', '2026-03-20', 100,  NOW() - INTERVAL '18 days', 'Champion drove internal adoption', NULL, v_u2, co9, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', v_u2, NOW() - INTERVAL '60 days'),
    (d7,  v_org, p_sales, s_sales_won,   'Wayne Compliance Add-on',          'Compliance module upsell',           4200000, 'USD', '2026-03-01', 100,  NOW() - INTERVAL '37 days', 'Regulatory requirement', NULL, v_u4, co5, NOW() - INTERVAL '37 days', NOW() - INTERVAL '37 days', v_u4, NOW() - INTERVAL '90 days'),
    (d8,  v_org, p_sales, s_sales_lost,  'Umbrella EHR Integration',         'Electronic health records plugin',   7800000, 'USD', '2026-04-01', 0,    NOW() - INTERVAL '7 days',  'Budget frozen by board', 'MedTech Corp', v_u5, co6, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', v_u5, NOW() - INTERVAL '45 days'),
    (d9,  v_org, p_sales, s_prospect,    'Cyberdyne ML Pipeline',            'ML ops tooling license',             1500000, 'USD', '2026-08-01', 10,   NULL, NULL, NULL,           v_u3, co7,  NOW() - INTERVAL '2 days',  NOW() - INTERVAL '1 day',  v_u3, NOW() - INTERVAL '4 days'),
    (d10, v_org, p_sales, s_qualify,     'Oscorp Lab Management',            'Lab instrument management suite',    5500000, 'USD', '2026-07-15', 25,   NULL, NULL, NULL,           v_u6, co8,  NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days', v_u6, NOW() - INTERVAL '20 days'),
    (d11, v_org, p_sales, s_proposal,    'Soylent Fleet Tracker',            'IoT fleet tracking solution',        9200000, 'USD', '2026-06-20', 50,   NULL, NULL, NULL,           v_u4, co10, NOW() - INTERVAL '6 days',  NOW() - INTERVAL '2 days', v_u4, NOW() - INTERVAL '25 days'),
    (d12, v_org, p_sales, s_sales_lost,  'Initech Support Tier',             'Premium support package',            1200000, 'USD', '2026-03-15', 0,    NOW() - INTERVAL '23 days', 'Chose in-house solution', NULL, v_u3, co3, NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days', v_u3, NOW() - INTERVAL '50 days'),

    -- Partnership pipeline deals
    (d13, v_org, p_partner, s_outreach,  'Acme Technology Partnership',      'Co-marketing + integration',         0,       'USD', '2026-09-01', 10,   NULL, NULL, NULL,           v_u1, co1,  NOW() - INTERVAL '5 days',  NOW() - INTERVAL '2 days', v_u1, NOW() - INTERVAL '7 days'),
    (d14, v_org, p_partner, s_terms,     'Stark Dynamics OEM Deal',          'White-label OEM agreement',         35000000, 'USD', '2026-07-01', 55,   NULL, NULL, NULL,           v_u1, co4,  NOW() - INTERVAL '8 days',  NOW() - INTERVAL '1 day',  v_u1, NOW() - INTERVAL '30 days'),
    (d15, v_org, p_partner, s_partner_won,'Pied Piper Integration',          'Marketplace integration live',       0,       'USD', '2026-02-15', 100,  NOW() - INTERVAL '52 days', 'Mutual customer demand', NULL, v_u2, co9, NOW() - INTERVAL '52 days', NOW() - INTERVAL '52 days', v_u2, NOW() - INTERVAL '90 days'));

  -- ── Link deals to contacts ──
  INSERT INTO bond_deal_contacts (deal_id, contact_id, role) VALUES
    (d1,  ct1,  'Champion'),      (d1,  ct2,  'Decision Maker'),
    (d2,  ct3,  'Evaluator'),     (d2,  ct4,  'Budget Holder'),
    (d3,  ct5,  'Decision Maker'),(d3,  ct6,  'Technical Evaluator'),
    (d4,  ct7,  'Champion'),      (d4,  ct8,  'Technical Reviewer'),
    (d5,  ct9,  'Champion'),      (d5,  ct10, 'Decision Maker'),
    (d6,  ct17, 'Champion'),      (d6,  ct18, 'Technical Lead'),
    (d7,  ct10, 'Sponsor'),       (d7,  ct24, 'Compliance Lead'),
    (d8,  ct11, 'Evaluator'),     (d8,  ct12, 'End User'),
    (d9,  ct13, 'Decision Maker'),(d9,  ct14, 'Evaluator'),
    (d10, ct15, 'Sponsor'),       (d10, ct16, 'End User'),
    (d11, ct19, 'Technical Lead'),(d11, ct30, 'Decision Maker'),
    (d13, ct1,  'Partner Lead'),  (d13, ct21, 'Product Liaison'),
    (d14, ct7,  'Executive Sponsor'), (d14, ct23, 'Integration Lead'),
    (d15, ct17, 'Partner Champion');

  -- ══════════════════════════════════════════════════════════════
  -- 5. ACTIVITIES (25)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO bond_activities (organization_id, contact_id, deal_id, company_id, activity_type, subject, body, performed_by, performed_at) VALUES
    -- Acme Enterprise Expansion (d1)
    (v_org, ct1,  d1,  co1,  'email_sent',      'Intro to Enterprise Plan',         'Hi Lena, following up on our conversation about expanding to 500 seats...', v_u1, NOW() - INTERVAL '4 days'),
    (v_org, ct2,  d1,  co1,  'call',            'Discovery call with Marcus',       'Discussed timeline, budget approval expected Q2. Main concern: data migration.', v_u1, NOW() - INTERVAL '2 days'),
    (v_org, ct1,  d1,  co1,  'meeting',         'On-site demo at Acme HQ',          'Presented platform to 8 stakeholders. Good reception, follow-up scheduled.', v_u1, NOW() - INTERVAL '1 day'),

    -- Globex Platform Migration (d2)
    (v_org, ct3,  d2,  co2,  'email_sent',      'Migration assessment shared',      'Attached the migration assessment document for review.',                      v_u2, NOW() - INTERVAL '10 days'),
    (v_org, ct4,  d2,  co2,  'call',            'Budget discussion with James',     'James confirmed $85k budget ceiling. Needs board sign-off above that.',       v_u2, NOW() - INTERVAL '5 days'),

    -- Initech Dev Tools (d3)
    (v_org, ct5,  d3,  co3,  'meeting',         'Product demo for Sofia',           'One-hour demo. Sofia wants trial access for her team of 12.',                 v_u3, NOW() - INTERVAL '8 days'),
    (v_org, ct6,  d3,  co3,  'email_received',  'Trial feedback from Daniel',       'Team loves the CI integration. Questions about SSO support.',                 v_u3, NOW() - INTERVAL '3 days'),

    -- Stark Dynamics Security Suite (d4)
    (v_org, ct7,  d4,  co4,  'meeting',         'Security review meeting',          'Walked through SOC2 compliance docs. Aisha is pushing internally.',           v_u1, NOW() - INTERVAL '12 days'),
    (v_org, ct8,  d4,  co4,  'call',            'CISO deep-dive call',             'Robert reviewed our encryption approach. Needs pen-test results.',              v_u1, NOW() - INTERVAL '4 days'),
    (v_org, ct7,  d4,  co4,  'note',            'Negotiation checkpoint',           'Down to pricing and SLA terms. Expect to close within 2 weeks.',              v_u1, NOW() - INTERVAL '6 hours'),

    -- Wayne Financial Analytics (d5)
    (v_org, ct9,  d5,  co5,  'email_sent',      'Contract draft sent',              'Sent MSA + SOW v3 for final review by legal.',                                v_u4, NOW() - INTERVAL '3 days'),
    (v_org, ct10, d5,  co5,  'call',            'CFO sign-off call',               'Elena verbally approved. Waiting on signed PO.',                               v_u4, NOW() - INTERVAL '3 hours'),

    -- Cyberdyne ML Pipeline (d9)
    (v_org, ct13, d9,  co7,  'email_sent',      'ML Pipeline intro deck',           'Shared capabilities deck and pricing for ML pipeline tooling.',                v_u3, NOW() - INTERVAL '3 days'),
    (v_org, ct14, d9,  co7,  'email_received',  'Fatima requesting demo',           'Team wants to see GPU cluster integration demo.',                              v_u3, NOW() - INTERVAL '1 day'),

    -- Oscorp Lab Management (d10)
    (v_org, ct15, d10, co8,  'meeting',         'Lab walkthrough at Oscorp',        'Toured the lab, identified 3 integration points for instrument mgmt.',         v_u6, NOW() - INTERVAL '8 days'),
    (v_org, ct15, d10, co8,  'note',            'Technical requirements doc',       'William shared a 12-page requirements doc. Reviewing with eng team.',          v_u6, NOW() - INTERVAL '3 days'),

    -- Soylent Fleet Tracker (d11)
    (v_org, ct19, d11, co10, 'call',            'IoT requirements call',            'Grace outlined fleet of 2,000 vehicles. Need real-time GPS + maintenance alerts.', v_u4, NOW() - INTERVAL '6 days'),
    (v_org, ct30, d11, co10, 'email_sent',      'Proposal v1 sent to Kai',          'Sent initial proposal with 3 pricing tiers.',                                  v_u4, NOW() - INTERVAL '2 days'),

    -- Partnership deals
    (v_org, ct1,  d13, co1,  'email_sent',      'Co-marketing proposal',            'Sent partnership deck outlining co-marketing opportunities.',                   v_u1, NOW() - INTERVAL '5 days'),
    (v_org, ct7,  d14, co4,  'meeting',         'OEM terms workshop',               'Full-day workshop to define white-label scope and revenue share.',              v_u1, NOW() - INTERVAL '8 days'),
    (v_org, ct23, d14, co4,  'note',            'Integration spec review',          'Ivy shared their API docs. Good alignment with our webhook model.',             v_u1, NOW() - INTERVAL '1 day'),

    -- General activities (no deal)
    (v_org, ct17, NULL, co9,  'note',           'Pied Piper quarterly check-in',    'Richard reports 98% satisfaction. Willing to do a case study.',                 v_u2, NOW() - INTERVAL '1 day'),
    (v_org, ct11, NULL, co6,  'email_sent',     'Umbrella re-engagement',           'Sent new product update to re-engage after lost deal.',                         v_u5, NOW() - INTERVAL '3 days'),
    (v_org, ct22, NULL, co2,  'call',           'Globex cross-sell exploration',     'Tobias interested in analytics module. Setting up demo.',                       v_u2, NOW() - INTERVAL '2 days'),
    (v_org, ct26, NULL, co8,  'form_submission','Oscorp webinar registration',       'Andre registered for "Lab Automation in 2026" webinar.',                        v_u6, NOW() - INTERVAL '5 days');

  -- ══════════════════════════════════════════════════════════════
  -- 6. DEAL STAGE HISTORY (sample transitions)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO bond_deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by, changed_at, duration_in_stage) VALUES
    -- d2: Prospect -> Qualification
    (d2, s_prospect,  s_qualify,     v_u2, NOW() - INTERVAL '7 days',  INTERVAL '7 days'),
    -- d3: Prospect -> Qualification -> Proposal
    (d3, s_prospect,  s_qualify,     v_u3, NOW() - INTERVAL '14 days', INTERVAL '7 days'),
    (d3, s_qualify,   s_proposal,    v_u3, NOW() - INTERVAL '5 days',  INTERVAL '9 days'),
    -- d4: Prospect -> Qualification -> Proposal -> Negotiation
    (d4, s_prospect,  s_qualify,     v_u1, NOW() - INTERVAL '24 days', INTERVAL '6 days'),
    (d4, s_qualify,   s_proposal,    v_u1, NOW() - INTERVAL '16 days', INTERVAL '8 days'),
    (d4, s_proposal,  s_negotiate,   v_u1, NOW() - INTERVAL '4 days',  INTERVAL '12 days'),
    -- d5: full journey
    (d5, s_prospect,  s_qualify,     v_u4, NOW() - INTERVAL '38 days', INTERVAL '7 days'),
    (d5, s_qualify,   s_proposal,    v_u4, NOW() - INTERVAL '24 days', INTERVAL '14 days'),
    (d5, s_proposal,  s_negotiate,   v_u4, NOW() - INTERVAL '10 days', INTERVAL '14 days'),
    (d5, s_negotiate, s_commit,      v_u4, NOW() - INTERVAL '2 days',  INTERVAL '8 days'),
    -- d6: won
    (d6, s_prospect,  s_qualify,     v_u2, NOW() - INTERVAL '50 days', INTERVAL '10 days'),
    (d6, s_qualify,   s_proposal,    v_u2, NOW() - INTERVAL '38 days', INTERVAL '12 days'),
    (d6, s_proposal,  s_negotiate,   v_u2, NOW() - INTERVAL '28 days', INTERVAL '10 days'),
    (d6, s_negotiate, s_commit,      v_u2, NOW() - INTERVAL '22 days', INTERVAL '6 days'),
    (d6, s_commit,    s_sales_won,   v_u2, NOW() - INTERVAL '18 days', INTERVAL '4 days'),
    -- d8: lost
    (d8, s_prospect,  s_qualify,     v_u5, NOW() - INTERVAL '35 days', INTERVAL '10 days'),
    (d8, s_qualify,   s_proposal,    v_u5, NOW() - INTERVAL '20 days', INTERVAL '15 days'),
    (d8, s_proposal,  s_sales_lost,  v_u5, NOW() - INTERVAL '7 days',  INTERVAL '13 days'),
    -- d14: partnership pipeline
    (d14, s_outreach, s_eval,        v_u1, NOW() - INTERVAL '20 days', INTERVAL '10 days'),
    (d14, s_eval,     s_terms,       v_u1, NOW() - INTERVAL '8 days',  INTERVAL '12 days');

  -- ══════════════════════════════════════════════════════════════
  -- 7. LEAD SCORING RULES
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO bond_lead_scoring_rules (organization_id, name, description, condition_field, condition_operator, condition_value, score_delta, enabled) VALUES
    (v_org, 'Email opened',          'Contact opened a marketing email',       'activity_type',   'equals',    'campaign_opened',  5,   true),
    (v_org, 'Email clicked',         'Contact clicked a link in email',        'activity_type',   'equals',    'campaign_clicked', 10,  true),
    (v_org, 'Form submitted',        'Contact submitted a web form',           'activity_type',   'equals',    'form_submission',  15,  true),
    (v_org, 'Meeting held',          'A meeting was logged with the contact',  'activity_type',   'equals',    'meeting',          20,  true),
    (v_org, 'Referral source',       'Contact came via referral',              'lead_source',     'equals',    'referral',         25,  true),
    (v_org, 'Conference source',     'Contact met at conference/event',        'lead_source',     'equals',    'conference',        15,  true),
    (v_org, 'C-level title',         'Contact holds C-level title',            'title',           'contains',  'C',                30,  true),
    (v_org, 'VP title',              'Contact holds VP title',                 'title',           'contains',  'VP',               20,  true),
    (v_org, 'Large company',         'Company has 1000+ employees',            'company_size',    'gte',       '1001',             15,  true),
    (v_org, 'Inactive for 30 days',  'No activity in 30 days (decay)',         'days_since_last_activity', 'gt', '30',            -10,  true);

  RAISE NOTICE 'Seeded Bond CRM: 2 pipelines (14 stages), 10 companies, 30 contacts, 15 deals, 25 activities, 20 stage history entries, 10 lead scoring rules';
END $$;
