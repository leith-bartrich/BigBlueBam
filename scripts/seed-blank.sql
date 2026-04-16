-- Seed Blank (Forms & Surveys) demo data
-- Run via orchestrator: node scripts/seed-all.mjs (substitutes :org_id / :user_N)
-- idempotent: skip-if-any-form-already-present

DO $$
DECLARE
  v_org UUID := :org_id;
  v_u1 UUID := :user_1;
  v_u2 UUID := :user_2;

  -- Forms
  f1 UUID; f2 UUID; f3 UUID; f4 UUID; f5 UUID;

  -- Fields
  fl UUID;

BEGIN
  -- Idempotency guard
  IF EXISTS (SELECT 1 FROM blank_forms WHERE organization_id = v_org LIMIT 1) THEN
    RAISE NOTICE 'Blank seed: forms already exist for this org, skipping.';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- Form 1: Customer Feedback Survey (published)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO blank_forms (organization_id, name, description, slug, form_type, status, published_at, theme_color, confirmation_message, created_by)
  VALUES (v_org, 'Customer Feedback Survey', 'Help us improve our products and services', 'customer-feedback', 'public', 'published', NOW() - INTERVAL '14 days', '#3b82f6', 'Thank you for your feedback! We review every submission.', v_u1)
  RETURNING id INTO f1;

  INSERT INTO blank_form_fields (form_id, field_key, label, field_type, required, sort_order, page_number, placeholder)
  VALUES
    (f1, 'name', 'Your Name', 'short_text', true, 0, 1, 'Enter your full name'),
    (f1, 'email', 'Email Address', 'email', true, 1, 1, 'you@company.com'),
    (f1, 'nps_score', 'How likely are you to recommend us to a friend?', 'nps', true, 2, 1, NULL),
    (f1, 'satisfaction', 'Overall Satisfaction', 'rating', true, 3, 1, NULL),
    (f1, 'best_feature', 'What do you like most about our product?', 'dropdown', false, 4, 1, NULL),
    (f1, 'feedback', 'Additional Comments', 'long_text', false, 5, 1, 'Tell us more...');

  -- Set NPS scale
  UPDATE blank_form_fields SET scale_min = 0, scale_max = 10, scale_min_label = 'Not at all likely', scale_max_label = 'Extremely likely' WHERE form_id = f1 AND field_key = 'nps_score';

  -- Set dropdown options
  UPDATE blank_form_fields SET options = '[{"value":"ui","label":"User Interface"},{"value":"speed","label":"Performance"},{"value":"support","label":"Customer Support"},{"value":"features","label":"Feature Set"},{"value":"pricing","label":"Pricing"}]'::jsonb WHERE form_id = f1 AND field_key = 'best_feature';

  -- Add submissions
  INSERT INTO blank_submissions (form_id, organization_id, response_data, submitted_by_email, submitted_at) VALUES
    (f1, v_org, '{"name":"Alice Johnson","email":"alice@acme.com","nps_score":9,"satisfaction":5,"best_feature":"features","feedback":"Amazing product, love the automation features!"}', 'alice@acme.com', NOW() - INTERVAL '12 days'),
    (f1, v_org, '{"name":"Bob Smith","email":"bob@techcorp.io","nps_score":7,"satisfaction":4,"best_feature":"ui","feedback":"Clean interface but could use more integrations."}', 'bob@techcorp.io', NOW() - INTERVAL '10 days'),
    (f1, v_org, '{"name":"Carol Davis","email":"carol@startup.co","nps_score":10,"satisfaction":5,"best_feature":"support","feedback":"Best customer support I have ever experienced."}', 'carol@startup.co', NOW() - INTERVAL '8 days'),
    (f1, v_org, '{"name":"Dave Wilson","email":"dave@enterprise.com","nps_score":6,"satisfaction":3,"best_feature":"speed","feedback":"Performance could be better with large datasets."}', 'dave@enterprise.com', NOW() - INTERVAL '5 days'),
    (f1, v_org, '{"name":"Eve Chen","email":"eve@design.studio","nps_score":8,"satisfaction":4,"best_feature":"ui","feedback":"Intuitive design, great for onboarding new team members."}', 'eve@design.studio', NOW() - INTERVAL '3 days'),
    (f1, v_org, '{"name":"Frank Garcia","email":"frank@dev.io","nps_score":9,"satisfaction":5,"best_feature":"features","feedback":"The API integration is top-notch."}', 'frank@dev.io', NOW() - INTERVAL '1 day'),
    (f1, v_org, '{"name":"Grace Lee","email":"grace@consulting.com","nps_score":8,"satisfaction":4,"best_feature":"pricing","feedback":"Good value for the price."}', 'grace@consulting.com', NOW() - INTERVAL '6 hours');

  -- ══════════════════════════════════════════════════════════════
  -- Form 2: Bug Report Form (published)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO blank_forms (organization_id, name, description, slug, form_type, status, published_at, theme_color, created_by)
  VALUES (v_org, 'Bug Report', 'Report a bug or issue with our product', 'bug-report', 'public', 'published', NOW() - INTERVAL '30 days', '#ef4444', v_u1)
  RETURNING id INTO f2;

  INSERT INTO blank_form_fields (form_id, field_key, label, field_type, required, sort_order, page_number, placeholder)
  VALUES
    (f2, 'reporter_email', 'Your Email', 'email', true, 0, 1, 'you@company.com'),
    (f2, 'severity', 'Severity', 'single_select', true, 1, 1, NULL),
    (f2, 'component', 'Component', 'dropdown', true, 2, 1, NULL),
    (f2, 'title', 'Bug Title', 'short_text', true, 3, 1, 'Brief description of the issue'),
    (f2, 'steps', 'Steps to Reproduce', 'long_text', true, 4, 1, '1. Go to...\n2. Click on...\n3. See error'),
    (f2, 'expected', 'Expected Behavior', 'long_text', false, 5, 1, 'What should have happened?'),
    (f2, 'actual', 'Actual Behavior', 'long_text', true, 6, 1, 'What actually happened?');

  UPDATE blank_form_fields SET options = '[{"value":"critical","label":"Critical"},{"value":"high","label":"High"},{"value":"medium","label":"Medium"},{"value":"low","label":"Low"}]'::jsonb WHERE form_id = f2 AND field_key = 'severity';
  UPDATE blank_form_fields SET options = '[{"value":"frontend","label":"Frontend"},{"value":"backend","label":"Backend"},{"value":"mobile","label":"Mobile App"},{"value":"api","label":"API"},{"value":"other","label":"Other"}]'::jsonb WHERE form_id = f2 AND field_key = 'component';

  INSERT INTO blank_submissions (form_id, organization_id, response_data, submitted_by_email, submitted_at) VALUES
    (f2, v_org, '{"reporter_email":"dev@company.com","severity":"high","component":"frontend","title":"Dashboard fails to load","steps":"1. Login\n2. Navigate to dashboard\n3. Page hangs","expected":"Dashboard loads","actual":"Blank white screen"}', 'dev@company.com', NOW() - INTERVAL '7 days'),
    (f2, v_org, '{"reporter_email":"qa@company.com","severity":"medium","component":"api","title":"API returns 500 on large payload","steps":"1. POST /api/tasks with 1000 items","expected":"200 OK","actual":"500 Internal Server Error"}', 'qa@company.com', NOW() - INTERVAL '3 days');

  -- ══════════════════════════════════════════════════════════════
  -- Form 3: Event Registration (published)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO blank_forms (organization_id, name, description, slug, form_type, status, published_at, theme_color, show_progress_bar, created_by)
  VALUES (v_org, 'Q2 Product Launch Event', 'Register for our upcoming product launch event', 'q2-launch-event', 'public', 'published', NOW() - INTERVAL '7 days', '#7c3aed', true, v_u2)
  RETURNING id INTO f3;

  INSERT INTO blank_form_fields (form_id, field_key, label, field_type, required, sort_order, page_number)
  VALUES
    (f3, 'attendee_name', 'Full Name', 'short_text', true, 0, 1),
    (f3, 'attendee_email', 'Email', 'email', true, 1, 1),
    (f3, 'company', 'Company', 'short_text', true, 2, 1),
    (f3, 'role', 'Job Title', 'short_text', false, 3, 1),
    (f3, 'dietary', 'Dietary Requirements', 'multi_select', false, 4, 2),
    (f3, 'session_interest', 'Interested Sessions', 'multi_select', false, 5, 2),
    (f3, 'newsletter', 'Subscribe to newsletter?', 'checkbox', false, 6, 2);

  UPDATE blank_form_fields SET options = '[{"value":"none","label":"None"},{"value":"vegetarian","label":"Vegetarian"},{"value":"vegan","label":"Vegan"},{"value":"gluten_free","label":"Gluten-free"},{"value":"halal","label":"Halal"}]'::jsonb WHERE form_id = f3 AND field_key = 'dietary';
  UPDATE blank_form_fields SET options = '[{"value":"keynote","label":"Keynote Presentation"},{"value":"demo","label":"Product Demo"},{"value":"workshop","label":"Hands-on Workshop"},{"value":"networking","label":"Networking Session"}]'::jsonb WHERE form_id = f3 AND field_key = 'session_interest';

  INSERT INTO blank_submissions (form_id, organization_id, response_data, submitted_by_email, submitted_at) VALUES
    (f3, v_org, '{"attendee_name":"Alice Johnson","attendee_email":"alice@acme.com","company":"Acme Corp","role":"CTO","dietary":["none"],"session_interest":["keynote","demo"],"newsletter":true}', 'alice@acme.com', NOW() - INTERVAL '5 days'),
    (f3, v_org, '{"attendee_name":"Bob Smith","attendee_email":"bob@techcorp.io","company":"TechCorp","role":"Engineer","dietary":["vegetarian"],"session_interest":["workshop","demo"],"newsletter":false}', 'bob@techcorp.io', NOW() - INTERVAL '4 days'),
    (f3, v_org, '{"attendee_name":"Carol Davis","attendee_email":"carol@startup.co","company":"StartupCo","role":"Product Manager","dietary":["vegan"],"session_interest":["keynote","networking"],"newsletter":true}', 'carol@startup.co', NOW() - INTERVAL '2 days');

  -- ══════════════════════════════════════════════════════════════
  -- Form 4: Feature Request (draft)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO blank_forms (organization_id, name, description, slug, form_type, status, theme_color, created_by)
  VALUES (v_org, 'Feature Request', 'Submit your feature ideas and suggestions', 'feature-request', 'internal', 'draft', '#10b981', v_u2)
  RETURNING id INTO f4;

  INSERT INTO blank_form_fields (form_id, field_key, label, field_type, required, sort_order, page_number)
  VALUES
    (f4, 'feature_title', 'Feature Title', 'short_text', true, 0, 1),
    (f4, 'priority', 'Priority', 'single_select', true, 1, 1),
    (f4, 'description', 'Detailed Description', 'long_text', true, 2, 1),
    (f4, 'use_case', 'Use Case', 'long_text', false, 3, 1),
    (f4, 'impact', 'Business Impact (1-5)', 'scale', false, 4, 1);

  UPDATE blank_form_fields SET options = '[{"value":"critical","label":"Critical"},{"value":"high","label":"High"},{"value":"medium","label":"Medium"},{"value":"low","label":"Nice to have"}]'::jsonb WHERE form_id = f4 AND field_key = 'priority';
  UPDATE blank_form_fields SET scale_min = 1, scale_max = 5, scale_min_label = 'Low impact', scale_max_label = 'High impact' WHERE form_id = f4 AND field_key = 'impact';

  -- ══════════════════════════════════════════════════════════════
  -- Form 5: Employee Onboarding Checklist (closed)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO blank_forms (organization_id, name, description, slug, form_type, status, published_at, closed_at, accept_responses, theme_color, created_by)
  VALUES (v_org, 'Q1 Onboarding Survey', 'How was your onboarding experience?', 'q1-onboarding', 'internal', 'closed', NOW() - INTERVAL '60 days', NOW() - INTERVAL '15 days', false, '#f59e0b', v_u1)
  RETURNING id INTO f5;

  INSERT INTO blank_form_fields (form_id, field_key, label, field_type, required, sort_order, page_number)
  VALUES
    (f5, 'onboarding_rating', 'Rate your onboarding experience', 'rating', true, 0, 1),
    (f5, 'mentor_helpful', 'Was your onboarding mentor helpful?', 'single_select', true, 1, 1),
    (f5, 'suggestions', 'Suggestions for improvement', 'long_text', false, 2, 1);

  UPDATE blank_form_fields SET options = '[{"value":"very_helpful","label":"Very Helpful"},{"value":"helpful","label":"Helpful"},{"value":"neutral","label":"Neutral"},{"value":"not_helpful","label":"Not Helpful"}]'::jsonb WHERE form_id = f5 AND field_key = 'mentor_helpful';

  INSERT INTO blank_submissions (form_id, organization_id, response_data, submitted_by_email, submitted_at) VALUES
    (f5, v_org, '{"onboarding_rating":5,"mentor_helpful":"very_helpful","suggestions":"Everything was great!"}', 'newbie1@mage.inc', NOW() - INTERVAL '45 days'),
    (f5, v_org, '{"onboarding_rating":4,"mentor_helpful":"helpful","suggestions":"More documentation for the internal tools would help."}', 'newbie2@mage.inc', NOW() - INTERVAL '40 days'),
    (f5, v_org, '{"onboarding_rating":3,"mentor_helpful":"neutral","suggestions":"First week was confusing, second week was much better."}', 'newbie3@mage.inc', NOW() - INTERVAL '35 days');

  RAISE NOTICE 'Seeded 5 forms with fields and 15 submissions for Blank.';
END $$;
