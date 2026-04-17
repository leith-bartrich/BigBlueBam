-- Seed Blast (Email Campaigns) demo data
-- Run via orchestrator: node scripts/seed-all.mjs (substitutes :org_id / :user_N)
-- idempotent: skip-if-any-campaign-already-present

DO $$
DECLARE
  v_org UUID := :org_id;
  v_u1 UUID := :user_1;
  v_u2 UUID := :user_2;

  -- Templates
  t1 UUID; t2 UUID; t3 UUID; t4 UUID; t5 UUID;

  -- Segments
  s1 UUID; s2 UUID; s3 UUID;

  -- Campaigns
  c1 UUID; c2 UUID; c3 UUID; c4 UUID;

  -- Contacts (use existing Bond contacts)
  ct1 UUID; ct2 UUID; ct3 UUID;

BEGIN
  -- Idempotency guard
  IF EXISTS (SELECT 1 FROM blast_campaigns WHERE organization_id = v_org LIMIT 1) THEN
    RAISE NOTICE 'Blast seed: campaigns already exist for this org, skipping.';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 1. TEMPLATES (5)
  -- ══════════════════════════════════════════════════════════════

  INSERT INTO blast_templates (organization_id, name, description, subject_template, html_body, template_type, created_by, updated_by)
  VALUES (v_org, 'Monthly Newsletter', 'Our standard monthly newsletter layout', 'Mage Inc Monthly Update - {{first_name}}',
    '<html><body style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#2563eb">Monthly Update</h1><p>Hello {{first_name}},</p><p>Here is what happened this month at Mage Inc.</p><hr/><p style="font-size:12px;color:#666"><a href="{{unsubscribe_url}}">Unsubscribe</a></p></body></html>',
    'campaign', v_u1, v_u1) RETURNING id INTO t1;

  INSERT INTO blast_templates (organization_id, name, description, subject_template, html_body, template_type, created_by, updated_by)
  VALUES (v_org, 'Product Announcement', 'Template for new feature announcements', 'Exciting News: {{product_name}} is here!',
    '<html><body style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#dc2626">New Feature Alert</h1><p>Hi {{first_name}},</p><p>We just launched {{product_name}}!</p><a href="{{cta_url}}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px">Learn More</a><hr/><p style="font-size:12px;color:#666"><a href="{{unsubscribe_url}}">Unsubscribe</a></p></body></html>',
    'campaign', v_u1, v_u1) RETURNING id INTO t2;

  INSERT INTO blast_templates (organization_id, name, description, subject_template, html_body, template_type, created_by, updated_by)
  VALUES (v_org, 'Welcome Email', 'Onboarding welcome for new contacts', 'Welcome to Mage Inc, {{first_name}}!',
    '<html><body style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px"><h1>Welcome!</h1><p>Hi {{first_name}},</p><p>Thanks for joining Mage Inc. We are excited to have you.</p><hr/><p style="font-size:12px;color:#666"><a href="{{unsubscribe_url}}">Unsubscribe</a></p></body></html>',
    'campaign', v_u2, v_u2) RETURNING id INTO t3;

  INSERT INTO blast_templates (organization_id, name, description, subject_template, html_body, template_type, created_by, updated_by)
  VALUES (v_org, 'Event Invitation', 'Template for webinar/event invitations', 'You are invited: {{event_name}}',
    '<html><body style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#7c3aed">You are Invited</h1><p>Hi {{first_name}},</p><p>Join us for {{event_name}} on {{event_date}}.</p><a href="{{rsvp_url}}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px">RSVP Now</a><hr/><p style="font-size:12px;color:#666"><a href="{{unsubscribe_url}}">Unsubscribe</a></p></body></html>',
    'campaign', v_u1, v_u1) RETURNING id INTO t4;

  INSERT INTO blast_templates (organization_id, name, description, subject_template, html_body, template_type, created_by, updated_by)
  VALUES (v_org, 'Re-engagement', 'Win back inactive contacts', 'We miss you, {{first_name}}!',
    '<html><body style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px"><h1>We Miss You</h1><p>Hi {{first_name}},</p><p>It has been a while since we last connected. Here is what you have been missing.</p><hr/><p style="font-size:12px;color:#666"><a href="{{unsubscribe_url}}">Unsubscribe</a></p></body></html>',
    'campaign', v_u2, v_u2) RETURNING id INTO t5;

  -- ══════════════════════════════════════════════════════════════
  -- 2. SEGMENTS (3)
  -- ══════════════════════════════════════════════════════════════

  INSERT INTO blast_segments (organization_id, name, description, filter_criteria, cached_count, cached_at, created_by)
  VALUES (v_org, 'All Active Leads', 'Leads and MQLs with score > 20',
    '{"conditions":[{"field":"lifecycle_stage","op":"in","value":["lead","marketing_qualified"]},{"field":"lead_score","op":"greater_than","value":20}],"match":"all"}',
    145, now(), v_u1) RETURNING id INTO s1;

  INSERT INTO blast_segments (organization_id, name, description, filter_criteria, cached_count, cached_at, created_by)
  VALUES (v_org, 'Customers', 'All contacts with customer lifecycle stage',
    '{"conditions":[{"field":"lifecycle_stage","op":"equals","value":"customer"}],"match":"all"}',
    89, now(), v_u1) RETURNING id INTO s2;

  INSERT INTO blast_segments (organization_id, name, description, filter_criteria, cached_count, cached_at, created_by)
  VALUES (v_org, 'Technology Companies', 'Contacts at technology companies',
    '{"conditions":[{"field":"custom_fields.industry","op":"equals","value":"technology"}],"match":"all"}',
    67, now(), v_u2) RETURNING id INTO s3;

  -- ══════════════════════════════════════════════════════════════
  -- 3. CAMPAIGNS (4)
  -- ══════════════════════════════════════════════════════════════

  -- Draft campaign
  INSERT INTO blast_campaigns (organization_id, name, template_id, subject, html_body, segment_id, from_name, from_email, status, created_by)
  VALUES (v_org, 'May Product Update', t2, 'Exciting: Mage Board 2.0 is here!', '<h1>Board 2.0</h1><p>Check it out</p>',
    s1, 'Mage Inc', 'updates@mage.inc', 'draft', v_u1) RETURNING id INTO c1;

  -- Scheduled campaign
  INSERT INTO blast_campaigns (organization_id, name, template_id, subject, html_body, segment_id, from_name, from_email, status, scheduled_at, created_by)
  VALUES (v_org, 'Summer Webinar Invite', t4, 'You are invited: Mage Summer Summit', '<h1>Summer Summit</h1><p>Join us</p>',
    s2, 'Mage Events', 'events@mage.inc', 'scheduled', now() + interval '7 days', v_u2) RETURNING id INTO c2;

  -- Sent campaign with stats
  INSERT INTO blast_campaigns (organization_id, name, template_id, subject, html_body, segment_id, from_name, from_email,
    status, sent_at, completed_at, recipient_count, total_sent, total_delivered, total_bounced, total_opened, total_clicked, total_unsubscribed, total_complained, created_by)
  VALUES (v_org, 'April Newsletter', t1, 'Mage Inc April Update', '<h1>April Update</h1><p>Big month!</p>',
    s1, 'Mage Inc', 'newsletter@mage.inc',
    'sent', now() - interval '5 days', now() - interval '5 days',
    142, 142, 138, 4, 87, 34, 2, 0, v_u1) RETURNING id INTO c3;

  -- Analyzing campaign (recently sent)
  INSERT INTO blast_campaigns (organization_id, name, template_id, subject, html_body, segment_id, from_name, from_email,
    status, sent_at, completed_at, recipient_count, total_sent, total_delivered, total_bounced, total_opened, total_clicked, total_unsubscribed, total_complained, created_by)
  VALUES (v_org, 'Re-engagement Q1', t5, 'We miss you! Come back to Mage Inc', '<h1>We Miss You</h1>',
    s3, 'Mage Inc', 'hello@mage.inc',
    'sent', now() - interval '1 day', now() - interval '1 day',
    67, 67, 65, 2, 23, 8, 1, 0, v_u2) RETURNING id INTO c4;

  -- ══════════════════════════════════════════════════════════════
  -- 4. SEND LOG + ENGAGEMENT (for c3: April Newsletter)
  -- ══════════════════════════════════════════════════════════════

  -- Grab some existing Bond contacts for send log entries
  SELECT id INTO ct1 FROM bond_contacts WHERE organization_id = v_org LIMIT 1;
  SELECT id INTO ct2 FROM bond_contacts WHERE organization_id = v_org OFFSET 1 LIMIT 1;
  SELECT id INTO ct3 FROM bond_contacts WHERE organization_id = v_org OFFSET 2 LIMIT 1;

  IF ct1 IS NOT NULL THEN
    INSERT INTO blast_send_log (campaign_id, contact_id, to_email, status, sent_at, delivered_at, tracking_token)
    VALUES (c3, ct1, 'contact1@example.com', 'delivered', now() - interval '5 days', now() - interval '5 days', encode(gen_random_bytes(32), 'hex'));

    -- Open event
    INSERT INTO blast_engagement_events (send_log_id, campaign_id, contact_id, event_type, occurred_at)
    SELECT id, c3, ct1, 'open', now() - interval '4 days' FROM blast_send_log WHERE campaign_id = c3 AND contact_id = ct1 LIMIT 1;

    -- Click event
    INSERT INTO blast_engagement_events (send_log_id, campaign_id, contact_id, event_type, clicked_url, occurred_at)
    SELECT id, c3, ct1, 'click', 'https://mage.inc/blog/april-update', now() - interval '4 days' FROM blast_send_log WHERE campaign_id = c3 AND contact_id = ct1 LIMIT 1;
  END IF;

  IF ct2 IS NOT NULL THEN
    INSERT INTO blast_send_log (campaign_id, contact_id, to_email, status, sent_at, delivered_at, tracking_token)
    VALUES (c3, ct2, 'contact2@example.com', 'delivered', now() - interval '5 days', now() - interval '5 days', encode(gen_random_bytes(32), 'hex'));

    INSERT INTO blast_engagement_events (send_log_id, campaign_id, contact_id, event_type, occurred_at)
    SELECT id, c3, ct2, 'open', now() - interval '3 days' FROM blast_send_log WHERE campaign_id = c3 AND contact_id = ct2 LIMIT 1;
  END IF;

  IF ct3 IS NOT NULL THEN
    INSERT INTO blast_send_log (campaign_id, contact_id, to_email, status, bounce_type, bounce_reason, bounced_at, tracking_token)
    VALUES (c3, ct3, 'bounced@invalid.com', 'bounced', 'hard', 'Mailbox does not exist', now() - interval '5 days', encode(gen_random_bytes(32), 'hex'));
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 5. SENDER DOMAIN
  -- ══════════════════════════════════════════════════════════════

  INSERT INTO blast_sender_domains (organization_id, domain, spf_verified, dkim_verified, dmarc_verified, verified_at, dns_records)
  VALUES (v_org, 'mage.inc', true, true, true, now(),
    '[{"type":"TXT","name":"@","value":"v=spf1 include:_spf.blast.bigbluebam.com ~all"},{"type":"CNAME","name":"blast._domainkey","value":"blast._domainkey.bigbluebam.com"},{"type":"TXT","name":"_dmarc","value":"v=DMARC1; p=quarantine; rua=mailto:dmarc@bigbluebam.com"}]'::jsonb)
  ON CONFLICT (organization_id, domain) DO NOTHING;

  RAISE NOTICE 'Blast seed complete: 5 templates, 3 segments, 4 campaigns, send log entries, engagement events';
END $$;
