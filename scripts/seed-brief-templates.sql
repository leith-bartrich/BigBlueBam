-- Seed Brief system templates (org_id = NULL → available to all installations)
-- Run: docker compose exec -T postgres psql -U bigbluebam < scripts/seed-brief-templates.sql

DO $$
DECLARE
  v_u1 UUID;
  v_sort INTEGER := 0;
BEGIN
  -- Resolve any active user as the creator of the system templates.
  -- System templates belong to org_id IS NULL so they surface to every installation.
  SELECT id INTO v_u1 FROM users WHERE is_active = true ORDER BY created_at LIMIT 1;
  IF v_u1 IS NULL THEN
    RAISE EXCEPTION 'seed-brief-templates: no active users found. Run create-admin first.';
  END IF;

  -- Idempotency: only seed if no system templates exist yet.
  IF EXISTS (SELECT 1 FROM brief_templates WHERE org_id IS NULL LIMIT 1) THEN
    RAISE NOTICE 'Brief templates seed: system templates already exist, skipping.';
    RETURN;
  END IF;

  -- =====================================================================
  -- BUSINESS OPERATIONS
  -- =====================================================================

  INSERT INTO brief_templates (org_id, name, description, icon, category, yjs_state, html_preview, sort_order, created_by) VALUES
  (NULL, 'Meeting Notes', 'Capture agenda, discussion, decisions, and action items from any meeting.', '📋', 'business-operations', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Fill in the meeting details before the meeting starts. During the meeting, capture key discussion points and decisions. After the meeting, assign action items with owners and due dates, then share to a Banter channel.</p></blockquote>
<h1>Meeting Notes</h1>
<p><strong>Date:</strong> [Date]<br><strong>Time:</strong> [Start] – [End]<br><strong>Location:</strong> [Room / Video link]<br><strong>Facilitator:</strong> [Name]<br><strong>Note-taker:</strong> [Name]</p>
<h2>Attendees</h2>
<ul><li>[Name, Role]</li><li>[Name, Role]</li><li>[Name, Role]</li></ul>
<h2>Agenda</h2>
<ol><li>[Topic 1] — [Owner] — [Time allotted]</li><li>[Topic 2] — [Owner] — [Time allotted]</li><li>[Topic 3] — [Owner] — [Time allotted]</li></ol>
<h2>Discussion Notes</h2>
<h3>Topic 1: [Title]</h3>
<p>[Key points discussed, context, and any data shared]</p>
<h3>Topic 2: [Title]</h3>
<p>[Key points discussed, context, and any data shared]</p>
<h2>Decisions Made</h2>
<ul><li><strong>Decision:</strong> [What was decided]<br><strong>Rationale:</strong> [Why this was chosen over alternatives]</li></ul>
<h2>Action Items</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">[Action item] — <strong>Owner:</strong> [Name] — <strong>Due:</strong> [Date]</li><li data-type="taskItem" data-checked="false">[Action item] — <strong>Owner:</strong> [Name] — <strong>Due:</strong> [Date]</li><li data-type="taskItem" data-checked="false">[Action item] — <strong>Owner:</strong> [Name] — <strong>Due:</strong> [Date]</li></ul>
<h2>Next Meeting</h2>
<p><strong>Date:</strong> [Next date]<br><strong>Agenda preview:</strong> [Topics to carry forward]</p>', 0, v_u1),

  (NULL, 'Project Brief', 'Define the scope, goals, timeline, and stakeholders for a new project or initiative.', '📌', 'business-operations', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Complete this brief before kicking off a project. It aligns stakeholders on scope, success criteria, and constraints. Share with the team and link to the Bam project board. Update as scope evolves.</p></blockquote>
<h1>Project Brief</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Project Name</td><td>[Name]</td></tr><tr><td>Project Lead</td><td>[Name]</td></tr><tr><td>Start Date</td><td>[Date]</td></tr><tr><td>Target Completion</td><td>[Date]</td></tr><tr><td>Status</td><td>Draft / In Progress / Complete</td></tr></table>
<h2>Executive Summary</h2>
<p>[2-3 sentences describing what this project is, why it matters, and the expected outcome. Write this for someone who has 30 seconds to decide if they care.]</p>
<h2>Problem Statement</h2>
<p>[What problem does this project solve? Who is affected? What happens if we do nothing?]</p>
<h2>Goals & Success Criteria</h2>
<table><tr><th>Goal</th><th>Metric</th><th>Target</th></tr><tr><td>[Goal 1]</td><td>[How measured]</td><td>[Target value]</td></tr><tr><td>[Goal 2]</td><td>[How measured]</td><td>[Target value]</td></tr></table>
<h2>Scope</h2>
<h3>In Scope</h3>
<ul><li>[Deliverable or feature 1]</li><li>[Deliverable or feature 2]</li></ul>
<h3>Out of Scope</h3>
<ul><li>[Explicitly excluded item 1]</li><li>[Explicitly excluded item 2]</li></ul>
<h2>Stakeholders</h2>
<table><tr><th>Name</th><th>Role</th><th>Responsibility</th></tr><tr><td>[Name]</td><td>[Sponsor / Lead / Contributor]</td><td>[What they own]</td></tr></table>
<h2>Timeline</h2>
<table><tr><th>Phase</th><th>Dates</th><th>Deliverable</th></tr><tr><td>Planning</td><td>[Start – End]</td><td>[Deliverable]</td></tr><tr><td>Execution</td><td>[Start – End]</td><td>[Deliverable]</td></tr><tr><td>Review</td><td>[Start – End]</td><td>[Deliverable]</td></tr></table>
<h2>Risks & Mitigations</h2>
<table><tr><th>Risk</th><th>Impact</th><th>Mitigation</th></tr><tr><td>[Risk 1]</td><td>High / Medium / Low</td><td>[Mitigation plan]</td></tr></table>
<h2>Resources Needed</h2>
<ul><li>[People: N engineers, N designers]</li><li>[Infrastructure: servers, licenses]</li><li>[Budget: $X]</li></ul>', 1, v_u1),

  (NULL, 'Project Status Report', 'Weekly or biweekly update on project health, progress, blockers, and next steps.', '📊', 'business-operations', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Fill this out at the end of each reporting period. Be honest about status — green/yellow/red should reflect reality, not optimism. Share to stakeholders via Banter or email.</p></blockquote>
<h1>Project Status Report</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Project</td><td>[Name]</td></tr><tr><td>Reporting Period</td><td>[Date range]</td></tr><tr><td>Author</td><td>[Name]</td></tr><tr><td>Overall Status</td><td>🟢 On Track / 🟡 At Risk / 🔴 Blocked</td></tr></table>
<h2>Summary</h2>
<p>[1-2 sentence executive summary of where things stand this period]</p>
<h2>What Was Accomplished</h2>
<ul><li>[Completed item 1]</li><li>[Completed item 2]</li></ul>
<h2>What''s In Progress</h2>
<ul><li>[In-progress item] — [Expected completion]</li></ul>
<h2>Blockers & Risks</h2>
<table><tr><th>Blocker</th><th>Impact</th><th>Owner</th><th>Resolution Plan</th></tr><tr><td>[Blocker]</td><td>[Impact]</td><td>[Name]</td><td>[Plan]</td></tr></table>
<h2>Key Metrics</h2>
<table><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Trend</th></tr><tr><td>[Metric]</td><td>[Target]</td><td>[Actual]</td><td>↑ / → / ↓</td></tr></table>
<h2>Next Period Goals</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">[Goal for next period]</li></ul>', 2, v_u1),

  (NULL, 'Post-Mortem / Retrospective', 'Analyze an incident or sprint to capture what happened, why, and how to prevent recurrence.', '🔥', 'business-operations', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Complete within 48 hours of an incident or at the end of a sprint. Focus on systemic causes, not blame. Every action item should have an owner and a due date. Promote to Beacon when finalized so the team can reference it.</p></blockquote>
<h1>Post-Mortem: [Incident Title]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Date of Incident</td><td>[Date]</td></tr><tr><td>Severity</td><td>P0 / P1 / P2 / P3</td></tr><tr><td>Duration</td><td>[Start time – Resolution time]</td></tr><tr><td>Author</td><td>[Name]</td></tr><tr><td>Status</td><td>Draft / Final</td></tr></table>
<h2>Executive Summary</h2>
<p>[2-3 sentences: what happened, who was affected, how it was resolved]</p>
<h2>Timeline</h2>
<table><tr><th>Time</th><th>Event</th></tr><tr><td>[HH:MM UTC]</td><td>[Alert fired / issue detected]</td></tr><tr><td>[HH:MM UTC]</td><td>[Investigation began]</td></tr><tr><td>[HH:MM UTC]</td><td>[Root cause identified]</td></tr><tr><td>[HH:MM UTC]</td><td>[Fix deployed / incident resolved]</td></tr></table>
<h2>Root Cause</h2>
<p>[What was the technical root cause? Use the "5 Whys" technique if helpful.]</p>
<h2>Impact</h2>
<ul><li><strong>Users affected:</strong> [Number / percentage]</li><li><strong>Revenue impact:</strong> [Amount or "none"]</li><li><strong>Data loss:</strong> [Yes/No — details]</li><li><strong>Duration of degradation:</strong> [Minutes/hours]</li></ul>
<h2>What Went Well</h2>
<ul><li>[Positive aspect of response]</li></ul>
<h2>What Could Be Improved</h2>
<ul><li>[Area for improvement]</li></ul>
<h2>Action Items</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">[Action] — <strong>Owner:</strong> [Name] — <strong>Due:</strong> [Date]</li><li data-type="taskItem" data-checked="false">[Action] — <strong>Owner:</strong> [Name] — <strong>Due:</strong> [Date]</li></ul>
<h2>Lessons Learned</h2>
<p>[Key takeaways that should inform future work]</p>', 3, v_u1),

  (NULL, 'Decision Log', 'Record important decisions with context, alternatives considered, and rationale.', '⚖️', 'business-operations', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Add an entry each time the team makes a significant decision. Include enough context that someone joining the team in 6 months can understand <em>why</em> the decision was made, not just <em>what</em> was decided.</p></blockquote>
<h1>Decision Log: [Project / Team Name]</h1>
<h2>Decision: [Title]</h2>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Date</td><td>[Date]</td></tr><tr><td>Deciders</td><td>[Names]</td></tr><tr><td>Status</td><td>Proposed / Accepted / Superseded</td></tr></table>
<h3>Context</h3>
<p>[What situation or problem prompted this decision?]</p>
<h3>Options Considered</h3>
<table><tr><th>Option</th><th>Pros</th><th>Cons</th></tr><tr><td>[Option A]</td><td>[Pros]</td><td>[Cons]</td></tr><tr><td>[Option B]</td><td>[Pros]</td><td>[Cons]</td></tr></table>
<h3>Decision</h3>
<p>[What was decided and why this option was chosen]</p>
<h3>Consequences</h3>
<p>[Expected outcomes, tradeoffs accepted, follow-up actions needed]</p>
<hr>
<p><em>Copy the section above for each new decision entry.</em></p>', 4, v_u1),

  (NULL, 'Standard Operating Procedure (SOP)', 'Step-by-step instructions for a repeatable process.', '📘', 'business-operations', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Write this so someone unfamiliar with the process can follow it independently. Include prerequisites, step-by-step instructions, and troubleshooting tips. Promote to Beacon when finalized for long-term reference.</p></blockquote>
<h1>SOP: [Process Name]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Owner</td><td>[Name / Team]</td></tr><tr><td>Last Reviewed</td><td>[Date]</td></tr><tr><td>Review Frequency</td><td>[Quarterly / Annually]</td></tr><tr><td>Version</td><td>[1.0]</td></tr></table>
<h2>Purpose</h2>
<p>[What this procedure accomplishes and when it should be used]</p>
<h2>Prerequisites</h2>
<ul><li>[Required access / permissions]</li><li>[Required tools or software]</li><li>[Required knowledge or training]</li></ul>
<h2>Procedure</h2>
<ol><li><strong>[Step 1 title]</strong><br>[Detailed instructions. Include screenshots or links where helpful.]</li><li><strong>[Step 2 title]</strong><br>[Detailed instructions.]</li><li><strong>[Step 3 title]</strong><br>[Detailed instructions.]</li></ol>
<h2>Troubleshooting</h2>
<table><tr><th>Problem</th><th>Solution</th></tr><tr><td>[Common issue]</td><td>[How to resolve]</td></tr></table>
<h2>Revision History</h2>
<table><tr><th>Date</th><th>Author</th><th>Changes</th></tr><tr><td>[Date]</td><td>[Name]</td><td>[Description of change]</td></tr></table>', 5, v_u1),

  (NULL, 'Change Request', 'Propose a change to scope, timeline, budget, or requirements with impact analysis.', '🔄', 'business-operations', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Submit this when a project needs to deviate from the agreed scope. Get stakeholder sign-off before implementing. Link to the relevant project brief.</p></blockquote>
<h1>Change Request: [Title]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Requestor</td><td>[Name]</td></tr><tr><td>Date</td><td>[Date]</td></tr><tr><td>Project</td><td>[Project name]</td></tr><tr><td>Priority</td><td>Critical / High / Medium / Low</td></tr><tr><td>Status</td><td>Proposed / Approved / Rejected / Implemented</td></tr></table>
<h2>Proposed Change</h2>
<p>[What specifically needs to change?]</p>
<h2>Reason for Change</h2>
<p>[Why is this change necessary? What new information prompted it?]</p>
<h2>Impact Analysis</h2>
<table><tr><th>Area</th><th>Impact</th></tr><tr><td>Timeline</td><td>[+N days / No change]</td></tr><tr><td>Budget</td><td>[+$X / No change]</td></tr><tr><td>Scope</td><td>[What''s added/removed]</td></tr><tr><td>Quality / Risk</td><td>[Any new risks introduced]</td></tr></table>
<h2>Alternatives Considered</h2>
<ul><li>[Alternative 1 and why it was rejected]</li></ul>
<h2>Approval</h2>
<table><tr><th>Approver</th><th>Decision</th><th>Date</th></tr><tr><td>[Name]</td><td>Approved / Rejected</td><td>[Date]</td></tr></table>', 6, v_u1),

  -- =====================================================================
  -- STRATEGY & PLANNING
  -- =====================================================================

  (NULL, 'Product Requirements Document (PRD)', 'Define what to build, for whom, and why — the single source of truth for a product initiative.', '🎯', 'strategy-planning', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Write the PRD before engineering begins. Start with the problem and user, not the solution. Get stakeholder review before moving to design. Keep it updated as requirements evolve — this is a living document until the feature ships.</p></blockquote>
<h1>PRD: [Feature / Product Name]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Author</td><td>[Name]</td></tr><tr><td>Status</td><td>Draft / In Review / Approved / Shipped</td></tr><tr><td>Last Updated</td><td>[Date]</td></tr><tr><td>Target Release</td><td>[Version / Sprint / Date]</td></tr><tr><td>Engineering Lead</td><td>[Name]</td></tr><tr><td>Design Lead</td><td>[Name]</td></tr></table>
<h2>Problem Statement</h2>
<p>[What problem are we solving? Who experiences this problem? How do they currently work around it? What evidence do we have that this is worth solving?]</p>
<h2>User Personas</h2>
<h3>[Persona 1: Name / Role]</h3>
<p>[Goals, pain points, typical workflow. Be specific — "an engineering manager with 8 direct reports" is better than "a user."]</p>
<h2>Goals & Success Metrics</h2>
<table><tr><th>Goal</th><th>Metric</th><th>Target</th><th>Measurement Method</th></tr><tr><td>[User goal]</td><td>[KPI]</td><td>[Target value]</td><td>[How measured]</td></tr></table>
<h2>User Stories</h2>
<ul><li><strong>As a</strong> [persona], <strong>I want to</strong> [action], <strong>so that</strong> [outcome].</li><li><strong>As a</strong> [persona], <strong>I want to</strong> [action], <strong>so that</strong> [outcome].</li></ul>
<h2>Requirements</h2>
<h3>Must Have (P0)</h3>
<ul><li>[Requirement 1]</li><li>[Requirement 2]</li></ul>
<h3>Should Have (P1)</h3>
<ul><li>[Requirement 3]</li></ul>
<h3>Nice to Have (P2)</h3>
<ul><li>[Requirement 4]</li></ul>
<h3>Out of Scope</h3>
<ul><li>[Explicitly excluded item]</li></ul>
<h2>Design</h2>
<p>[Link to Figma mockups, wireframes, or embed screenshots. Describe the key user flows.]</p>
<h2>Technical Considerations</h2>
<p>[API changes, data model impacts, performance requirements, security implications. Link to the technical design doc if separate.]</p>
<h2>Dependencies</h2>
<ul><li>[Dependency on another team / system / external service]</li></ul>
<h2>Rollout Plan</h2>
<ol><li>[Phase 1: internal dogfood]</li><li>[Phase 2: beta / feature flag]</li><li>[Phase 3: general availability]</li></ol>
<h2>Open Questions</h2>
<ul><li>[Question 1] — Owner: [Name]</li></ul>', 10, v_u1),

  (NULL, 'OKRs / Goals Tracker', 'Set and track Objectives and Key Results for a quarter or half.', '🎯', 'strategy-planning', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Set OKRs at the start of the quarter. Score key results at mid-quarter and end-of-quarter. Objectives should be ambitious; hitting 70% is good. Share with your team and manager.</p></blockquote>
<h1>OKRs: [Team / Individual] — [Quarter Year]</h1>
<h2>Objective 1: [Ambitious, qualitative goal]</h2>
<table><tr><th>Key Result</th><th>Target</th><th>Mid-Q</th><th>End-Q</th><th>Score</th></tr><tr><td>[Measurable outcome]</td><td>[Target]</td><td>[Progress]</td><td>[Final]</td><td>[0.0-1.0]</td></tr><tr><td>[Measurable outcome]</td><td>[Target]</td><td>[Progress]</td><td>[Final]</td><td>[0.0-1.0]</td></tr></table>
<h2>Objective 2: [Ambitious, qualitative goal]</h2>
<table><tr><th>Key Result</th><th>Target</th><th>Mid-Q</th><th>End-Q</th><th>Score</th></tr><tr><td>[Measurable outcome]</td><td>[Target]</td><td>[Progress]</td><td>[Final]</td><td>[0.0-1.0]</td></tr></table>
<h2>End-of-Quarter Reflection</h2>
<p>[What worked? What would you do differently? What carries forward?]</p>', 11, v_u1),

  (NULL, 'Quarterly Business Review', 'Summarize business performance, key metrics, wins, and challenges for the quarter.', '📈', 'strategy-planning', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Prepare this for quarterly review meetings. Focus on data and outcomes, not activity. Include visualizations where possible.</p></blockquote>
<h1>Quarterly Business Review: [Q# Year]</h1>
<h2>Executive Summary</h2>
<p>[3-4 sentences on overall quarter performance]</p>
<h2>Key Metrics</h2>
<table><tr><th>Metric</th><th>Target</th><th>Actual</th><th>vs. Last Q</th></tr><tr><td>[Revenue/Users/etc]</td><td>[Target]</td><td>[Actual]</td><td>[+/-N%]</td></tr></table>
<h2>Wins</h2>
<ul><li>[Major accomplishment with impact]</li></ul>
<h2>Challenges</h2>
<ul><li>[Challenge and how it was addressed or remains open]</li></ul>
<h2>Next Quarter Priorities</h2>
<ol><li>[Priority 1]</li><li>[Priority 2]</li></ol>', 12, v_u1),

  (NULL, 'Competitive Analysis', 'Structured comparison of your product against competitors.', '🔍', 'strategy-planning', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Update quarterly. Focus on capabilities that matter to your target customers, not an exhaustive feature list.</p></blockquote>
<h1>Competitive Analysis: [Product Area]</h1>
<h2>Market Overview</h2>
<p>[Brief description of the market landscape and key trends]</p>
<h2>Feature Comparison</h2>
<table><tr><th>Capability</th><th>Us</th><th>[Competitor A]</th><th>[Competitor B]</th></tr><tr><td>[Feature 1]</td><td>✅ / ⚠️ / ❌</td><td>✅ / ⚠️ / ❌</td><td>✅ / ⚠️ / ❌</td></tr></table>
<h2>Our Advantages</h2>
<ul><li>[Key differentiator]</li></ul>
<h2>Their Advantages</h2>
<ul><li>[Where competitors are ahead]</li></ul>
<h2>Strategic Implications</h2>
<p>[What should we invest in based on this analysis?]</p>', 13, v_u1),

  (NULL, 'SWOT Analysis', 'Map out Strengths, Weaknesses, Opportunities, and Threats.', '🧭', 'strategy-planning', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Best done collaboratively in a workshop or team meeting. Be brutally honest — a SWOT is only useful if the weaknesses and threats are real.</p></blockquote>
<h1>SWOT Analysis: [Subject]</h1>
<table><tr><th></th><th>Helpful</th><th>Harmful</th></tr><tr><td><strong>Internal</strong></td><td><strong>Strengths</strong><br>• [Strength 1]<br>• [Strength 2]</td><td><strong>Weaknesses</strong><br>• [Weakness 1]<br>• [Weakness 2]</td></tr><tr><td><strong>External</strong></td><td><strong>Opportunities</strong><br>• [Opportunity 1]<br>• [Opportunity 2]</td><td><strong>Threats</strong><br>• [Threat 1]<br>• [Threat 2]</td></tr></table>
<h2>Key Takeaways</h2>
<p>[What strategies emerge from this analysis?]</p>', 14, v_u1),

  (NULL, 'Roadmap Overview', 'High-level view of planned work across a time horizon.', '🗺️', 'strategy-planning', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Update monthly. This is for stakeholder alignment, not detailed planning. Link to PRDs and project briefs for specifics.</p></blockquote>
<h1>Roadmap: [Product / Team] — [Time Period]</h1>
<h2>Vision</h2>
<p>[Where are we headed? What does success look like at the end of this period?]</p>
<h2>Now (This Month)</h2>
<ul><li><strong>[Initiative]</strong> — [Brief description] — [Owner]</li></ul>
<h2>Next (Next Month)</h2>
<ul><li><strong>[Initiative]</strong> — [Brief description] — [Owner]</li></ul>
<h2>Later (2-3 Months Out)</h2>
<ul><li><strong>[Initiative]</strong> — [Brief description]</li></ul>
<h2>Exploring (Not Yet Committed)</h2>
<ul><li>[Idea being researched]</li></ul>', 15, v_u1),

  -- =====================================================================
  -- PEOPLE & HR
  -- =====================================================================

  (NULL, '1:1 Meeting Template', 'Structured agenda for regular manager-report check-ins.', '🤝', 'people-hr', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Share this doc between you and your manager. Both add topics before the meeting. Review action items from last time first. Keep a running log — don''t create a new doc each time.</p></blockquote>
<h1>1:1: [Your Name] ↔ [Manager Name]</h1>
<h2>[Date]</h2>
<h3>Action Items from Last Time</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">[Carried forward action]</li></ul>
<h3>Your Topics</h3>
<ul><li>[Topic / question / update]</li></ul>
<h3>Manager Topics</h3>
<ul><li>[Topic / feedback / update]</li></ul>
<h3>Career / Growth</h3>
<p>[Skill development, goals, feedback discussion]</p>
<h3>Action Items</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">[Action] — Owner: [Name]</li></ul>
<hr>
<p><em>Copy the section above for each new 1:1. Keep the running log in one document.</em></p>', 20, v_u1),

  (NULL, 'Performance Review', 'Self-assessment and manager evaluation template.', '⭐', 'people-hr', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> The report fills in self-assessment sections first, then the manager adds their evaluation. Be specific — cite examples and outcomes, not generalities.</p></blockquote>
<h1>Performance Review: [Name] — [Period]</h1>
<h2>Self-Assessment</h2>
<h3>Key Accomplishments</h3>
<ul><li>[Accomplishment with measurable outcome]</li></ul>
<h3>Areas for Growth</h3>
<ul><li>[Area and what you''re doing about it]</li></ul>
<h3>Goals for Next Period</h3>
<ul><li>[Goal with success criteria]</li></ul>
<h2>Manager Assessment</h2>
<h3>Strengths</h3>
<p>[Observed strengths with examples]</p>
<h3>Development Areas</h3>
<p>[Areas to improve with specific recommendations]</p>
<h3>Overall Rating</h3>
<p>[Exceeds / Meets / Developing / Does Not Meet expectations]</p>', 21, v_u1),

  (NULL, 'Job Description', 'Template for writing clear, inclusive job postings.', '💼', 'people-hr', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Be specific about must-haves vs. nice-to-haves. Research shows that women and minorities are less likely to apply if they don''t meet 100% of listed requirements — so keep the must-have list short and real.</p></blockquote>
<h1>[Job Title]</h1>
<p><strong>Team:</strong> [Team name]<br><strong>Location:</strong> [Remote / Hybrid / Office]<br><strong>Level:</strong> [Junior / Mid / Senior / Staff / Principal]</p>
<h2>About the Role</h2>
<p>[2-3 sentences about what this person will do and why the role exists]</p>
<h2>What You''ll Do</h2>
<ul><li>[Responsibility 1]</li><li>[Responsibility 2]</li></ul>
<h2>Must-Haves</h2>
<ul><li>[Non-negotiable requirement]</li></ul>
<h2>Nice-to-Haves</h2>
<ul><li>[Bonus skill or experience]</li></ul>
<h2>What We Offer</h2>
<ul><li>[Compensation / benefits highlights]</li></ul>', 22, v_u1),

  (NULL, 'Onboarding Checklist', 'Week-by-week checklist for onboarding a new team member.', '✅', 'people-hr', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Manager creates a copy for each new hire. Check off items as completed. Share access with the new hire so they can self-serve.</p></blockquote>
<h1>Onboarding: [New Hire Name]</h1>
<p><strong>Start Date:</strong> [Date]<br><strong>Manager:</strong> [Name]<br><strong>Buddy:</strong> [Name]</p>
<h2>Before Day 1 (Manager)</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Accounts created (email, Slack, GitHub, etc.)</li><li data-type="taskItem" data-checked="false">Hardware ordered and shipped</li><li data-type="taskItem" data-checked="false">Welcome message sent</li><li data-type="taskItem" data-checked="false">First week meetings scheduled</li></ul>
<h2>Week 1: Foundations</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Complete HR paperwork</li><li data-type="taskItem" data-checked="false">Set up development environment</li><li data-type="taskItem" data-checked="false">Read CLAUDE.md and design docs</li><li data-type="taskItem" data-checked="false">Meet the team (1:1s with each team member)</li><li data-type="taskItem" data-checked="false">Pick up onboarding ticket from board</li></ul>
<h2>Week 2: Contributing</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Submit first PR</li><li data-type="taskItem" data-checked="false">Attend sprint planning</li><li data-type="taskItem" data-checked="false">Shadow an on-call rotation</li></ul>
<h2>Week 3-4: Independence</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Own a feature end-to-end</li><li data-type="taskItem" data-checked="false">Lead a code review</li><li data-type="taskItem" data-checked="false">30-day check-in with manager</li></ul>', 23, v_u1),

  (NULL, 'Team Charter', 'Define your team''s mission, values, working agreements, and communication norms.', '🏴', 'people-hr', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Create collaboratively with the whole team. Revisit quarterly. This is the team''s social contract — new members read it on day one.</p></blockquote>
<h1>Team Charter: [Team Name]</h1>
<h2>Mission</h2>
<p>[One sentence: what does this team exist to do?]</p>
<h2>Team Members</h2>
<table><tr><th>Name</th><th>Role</th><th>Focus Area</th></tr><tr><td>[Name]</td><td>[Title]</td><td>[What they own]</td></tr></table>
<h2>Working Agreements</h2>
<ul><li>[Agreement about meetings, communication, code review, etc.]</li></ul>
<h2>Communication Norms</h2>
<table><tr><th>Channel</th><th>Used For</th><th>Response Time</th></tr><tr><td>Banter #team-name</td><td>Async discussion</td><td>Same business day</td></tr><tr><td>Direct message</td><td>Urgent items</td><td>Within 1 hour</td></tr></table>
<h2>Decision-Making</h2>
<p>[How does the team make decisions? Consensus? Designated decision-maker? RACI?]</p>', 24, v_u1),

  -- =====================================================================
  -- ENGINEERING & TECHNICAL
  -- =====================================================================

  (NULL, 'Technical Design Doc / RFC', 'Propose a technical approach with detailed design, tradeoffs, and alternatives.', '📐', 'engineering', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Write this before building anything non-trivial. Get at least one peer review before proceeding. The "Alternatives Considered" section is the most important — it shows you thought beyond the first idea. Promote to Beacon when the design is implemented and stable.</p></blockquote>
<h1>RFC: [Title]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Author</td><td>[Name]</td></tr><tr><td>Status</td><td>Draft / In Review / Accepted / Rejected / Superseded</td></tr><tr><td>Created</td><td>[Date]</td></tr><tr><td>Last Updated</td><td>[Date]</td></tr><tr><td>Reviewers</td><td>[Names]</td></tr></table>
<h2>Summary</h2>
<p>[One paragraph: what are you proposing and why? Write this for a senior engineer who has 60 seconds to decide if they should read the rest.]</p>
<h2>Motivation</h2>
<p>[Why is this change necessary? What problem does it solve? What data supports the need?]</p>
<h2>Detailed Design</h2>
<h3>Architecture</h3>
<p>[High-level architecture. Include diagrams (embed images or describe in text).]</p>
<h3>Data Model</h3>
<p>[New tables, columns, or schema changes. Show the SQL or Drizzle definitions.]</p>
<pre><code>-- Example schema change
ALTER TABLE example ADD COLUMN new_field VARCHAR(255);</code></pre>
<h3>API Changes</h3>
<table><tr><th>Method</th><th>Path</th><th>Description</th></tr><tr><td>POST</td><td>/api/v1/[resource]</td><td>[What it does]</td></tr></table>
<h3>Implementation Plan</h3>
<ol><li>[Phase 1: what to build first]</li><li>[Phase 2: what follows]</li></ol>
<h2>Alternatives Considered</h2>
<h3>Alternative A: [Name]</h3>
<p>[Description, and why it was rejected]</p>
<h3>Alternative B: [Name]</h3>
<p>[Description, and why it was rejected]</p>
<h2>Risks & Mitigations</h2>
<table><tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th></tr><tr><td>[Risk]</td><td>High/Med/Low</td><td>High/Med/Low</td><td>[Plan]</td></tr></table>
<h2>Security Considerations</h2>
<p>[Auth, authorization, input validation, data access implications]</p>
<h2>Testing Strategy</h2>
<p>[Unit tests, integration tests, load tests — what coverage is needed?]</p>
<h2>Rollout Plan</h2>
<p>[Feature flag? Gradual rollout? Migration strategy?]</p>
<h2>Open Questions</h2>
<ul><li>[Question] — Owner: [Name]</li></ul>', 30, v_u1),

  (NULL, 'Architecture Decision Record (ADR)', 'Lightweight record of a specific architectural decision.', '🏛️', 'engineering', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Shorter than an RFC. Use ADRs for smaller decisions that don''t need a full design doc but should still be recorded. Number them sequentially (ADR-001, ADR-002).</p></blockquote>
<h1>ADR-[NNN]: [Decision Title]</h1>
<p><strong>Date:</strong> [Date]<br><strong>Status:</strong> Accepted / Superseded by ADR-[NNN]<br><strong>Deciders:</strong> [Names]</p>
<h2>Context</h2>
<p>[What is the issue that we are seeing that is motivating this decision?]</p>
<h2>Decision</h2>
<p>[What is the change that we are proposing and/or doing?]</p>
<h2>Consequences</h2>
<ul><li><strong>Positive:</strong> [Good outcomes]</li><li><strong>Negative:</strong> [Tradeoffs accepted]</li><li><strong>Neutral:</strong> [Other effects]</li></ul>', 31, v_u1),

  (NULL, 'Bug Report', 'Structured report for reproducing and tracking a bug.', '🐛', 'engineering', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Include steps to reproduce — if the developer can''t reproduce it, they can''t fix it. Screenshots and console logs are your best friends. Link to the Bam task for tracking.</p></blockquote>
<h1>Bug: [Short Description]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Severity</td><td>Critical / Major / Minor / Cosmetic</td></tr><tr><td>Environment</td><td>[Production / Staging / Local]</td></tr><tr><td>Browser / OS</td><td>[Chrome 120 / macOS 14]</td></tr><tr><td>Reporter</td><td>[Name]</td></tr><tr><td>Assigned To</td><td>[Name]</td></tr></table>
<h2>Steps to Reproduce</h2>
<ol><li>[Step 1]</li><li>[Step 2]</li><li>[Step 3]</li></ol>
<h2>Expected Behavior</h2>
<p>[What should happen]</p>
<h2>Actual Behavior</h2>
<p>[What actually happens]</p>
<h2>Screenshots / Logs</h2>
<p>[Paste screenshots, console errors, or relevant log output]</p>
<h2>Workaround</h2>
<p>[Is there a workaround? Describe it.]</p>', 32, v_u1),

  (NULL, 'Runbook', 'Operational procedures for managing a service, handling alerts, or performing maintenance.', '🔧', 'engineering', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Write this for the on-call engineer at 3am who has never seen this service before. Be explicit. Include copy-paste commands. Promote to Beacon for long-term reference.</p></blockquote>
<h1>Runbook: [Service / Process Name]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Service</td><td>[Name]</td></tr><tr><td>Owner Team</td><td>[Team]</td></tr><tr><td>Escalation</td><td>[Who to page if this doesn''t resolve]</td></tr><tr><td>Last Tested</td><td>[Date]</td></tr></table>
<h2>Service Overview</h2>
<p>[What does this service do? What depends on it?]</p>
<h2>Common Alerts</h2>
<h3>[Alert Name]</h3>
<p><strong>What it means:</strong> [Explanation]<br><strong>Severity:</strong> [P0/P1/P2]</p>
<p><strong>Investigation steps:</strong></p>
<ol><li><code>[command to run]</code></li><li>Check [dashboard URL]</li></ol>
<p><strong>Resolution:</strong></p>
<pre><code># Command to fix
docker compose restart [service]</code></pre>
<h2>Maintenance Procedures</h2>
<h3>[Procedure Name]</h3>
<ol><li>[Step with explicit command]</li></ol>
<h2>Useful Commands</h2>
<pre><code># Check service health
curl localhost:[port]/health

# View recent logs
docker compose logs --tail 100 [service]

# Restart service
docker compose restart [service]</code></pre>', 33, v_u1),

  (NULL, 'API Documentation', 'Template for documenting a REST API with endpoints, schemas, and examples.', '🔌', 'engineering', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Document each endpoint with method, path, parameters, request/response examples, and error codes. Keep examples realistic — use actual field names and plausible values.</p></blockquote>
<h1>API Documentation: [Service Name]</h1>
<p><strong>Base URL:</strong> <code>https://[domain]/api/v1</code><br><strong>Authentication:</strong> Bearer token or session cookie</p>
<h2>Endpoints</h2>
<h3>POST /[resource]</h3>
<p>[Description of what this endpoint does]</p>
<p><strong>Request Body:</strong></p>
<pre><code>{
  "field_1": "value",
  "field_2": 42
}</code></pre>
<p><strong>Response (201):</strong></p>
<pre><code>{
  "data": {
    "id": "uuid",
    "field_1": "value"
  }
}</code></pre>
<p><strong>Errors:</strong></p>
<table><tr><th>Status</th><th>Code</th><th>Description</th></tr><tr><td>400</td><td>VALIDATION_ERROR</td><td>Invalid request body</td></tr><tr><td>401</td><td>UNAUTHORIZED</td><td>Missing or invalid auth</td></tr><tr><td>404</td><td>NOT_FOUND</td><td>Resource not found</td></tr></table>', 34, v_u1),

  (NULL, 'Release Notes', 'Communicate what shipped, what changed, and what''s known.', '🚀', 'engineering', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Write for your users, not your engineers. Lead with the value, not the implementation. Share via Banter announcement channel and email.</p></blockquote>
<h1>Release Notes: [Version / Date]</h1>
<h2>Highlights</h2>
<ul><li><strong>[Feature name]</strong> — [One sentence on what it does and why users should care]</li></ul>
<h2>New Features</h2>
<ul><li>[Feature with brief description]</li></ul>
<h2>Improvements</h2>
<ul><li>[Improvement with brief description]</li></ul>
<h2>Bug Fixes</h2>
<ul><li>[Bug that was fixed — describe the symptom, not the code change]</li></ul>
<h2>Known Issues</h2>
<ul><li>[Issue with workaround if available]</li></ul>
<h2>Breaking Changes</h2>
<ul><li>[Change that requires user action — include migration steps]</li></ul>', 35, v_u1),

  -- =====================================================================
  -- COMMUNICATIONS
  -- =====================================================================

  (NULL, 'Internal Memo / Announcement', 'Communicate important news, decisions, or changes to the organization.', '📣', 'communications', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Lead with the news, then the context. Most readers will only read the first paragraph — make it count. Share to the relevant Banter channel.</p></blockquote>
<h1>[Subject Line]</h1>
<p><strong>From:</strong> [Name, Title]<br><strong>To:</strong> [Audience]<br><strong>Date:</strong> [Date]</p>
<h2>TL;DR</h2>
<p>[One paragraph summary of the key message]</p>
<h2>Details</h2>
<p>[Full context, reasoning, and details]</p>
<h2>What This Means for You</h2>
<p>[Specific impact on the audience and any action they need to take]</p>
<h2>Timeline</h2>
<ul><li>[Key date and what happens]</li></ul>
<h2>Questions?</h2>
<p>[Where to direct questions — Banter channel, email, office hours]</p>', 40, v_u1),

  (NULL, 'Weekly Newsletter', 'Internal team or company newsletter template.', '📰', 'communications', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Keep it scannable — use bullets, bold key points, and keep sections short. Aim for 3-5 minute read time.</p></blockquote>
<h1>[Team/Company] Weekly Update — [Date]</h1>
<h2>Top Story</h2>
<p>[The most important thing that happened this week, in 2-3 sentences]</p>
<h2>Wins</h2>
<ul><li>[Win with person/team credit]</li></ul>
<h2>In Progress</h2>
<ul><li>[Notable work underway]</li></ul>
<h2>Heads Up</h2>
<ul><li>[Upcoming changes, deadlines, or events]</li></ul>
<h2>Team Spotlight</h2>
<p>[Highlight a team member, project, or fun fact]</p>', 41, v_u1),

  (NULL, 'Press Release', 'External announcement following the inverted pyramid format.', '📰', 'communications', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Follow the inverted pyramid: most important info first. The first paragraph should answer who, what, when, where, why. Include a real quote from leadership.</p></blockquote>
<h1>[Headline: Active Voice, Present Tense]</h1>
<p><strong>[City, Date]</strong> — [First paragraph: the news in 2-3 sentences. Answer: What happened? Why does it matter? Who is involved?]</p>
<p>[Second paragraph: supporting details, context, or data]</p>
<p>"[Quote from company leader about what this means]," said [Name, Title].</p>
<p>[Additional details, background, or technical information]</p>
<h2>About [Company Name]</h2>
<p>[Boilerplate company description]</p>
<h2>Media Contact</h2>
<p>[Name]<br>[Email]<br>[Phone]</p>', 42, v_u1),

  (NULL, 'FAQ Document', 'Anticipate and answer frequently asked questions on a topic.', '❓', 'communications', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Group questions by theme. Write answers at a 6th-grade reading level. Update as new questions come in. Promote to Beacon when stable.</p></blockquote>
<h1>FAQ: [Topic]</h1>
<h2>General</h2>
<h3>Q: [Question]?</h3>
<p>[Clear, concise answer. Link to detailed docs where relevant.]</p>
<h3>Q: [Question]?</h3>
<p>[Answer]</p>
<h2>Technical</h2>
<h3>Q: [Question]?</h3>
<p>[Answer with code example if applicable]</p>
<h2>Billing / Access</h2>
<h3>Q: [Question]?</h3>
<p>[Answer]</p>', 43, v_u1),

  -- =====================================================================
  -- SALES & EXTERNAL
  -- =====================================================================

  (NULL, 'Proposal / Statement of Work', 'Scope, deliverables, timeline, and pricing for client engagements.', '📑', 'sales-external', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Customize for each client. Be specific about deliverables and acceptance criteria. Include payment terms. Have legal review before sending.</p></blockquote>
<h1>Proposal: [Project Name]</h1>
<p><strong>Prepared for:</strong> [Client Name]<br><strong>Prepared by:</strong> [Your Name, Company]<br><strong>Date:</strong> [Date]<br><strong>Valid Until:</strong> [Date]</p>
<h2>Executive Summary</h2>
<p>[What we propose to do, why, and the expected outcome]</p>
<h2>Scope of Work</h2>
<table><tr><th>Deliverable</th><th>Description</th><th>Acceptance Criteria</th></tr><tr><td>[Deliverable]</td><td>[Description]</td><td>[How we know it''s done]</td></tr></table>
<h2>Timeline</h2>
<table><tr><th>Phase</th><th>Duration</th><th>Deliverables</th></tr><tr><td>[Phase]</td><td>[Weeks]</td><td>[What''s delivered]</td></tr></table>
<h2>Investment</h2>
<table><tr><th>Item</th><th>Amount</th></tr><tr><td>[Line item]</td><td>$[Amount]</td></tr><tr><td><strong>Total</strong></td><td><strong>$[Total]</strong></td></tr></table>
<h2>Payment Terms</h2>
<p>[Payment schedule and terms]</p>
<h2>Next Steps</h2>
<ol><li>[Step to proceed]</li></ol>', 50, v_u1),

  (NULL, 'Client Brief', 'Capture client requirements, goals, and constraints at the start of an engagement.', '🤝', 'sales-external', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Fill this out during or immediately after the discovery call. Share with the client for validation before proceeding.</p></blockquote>
<h1>Client Brief: [Client Name]</h1>
<h2>Client Overview</h2>
<p><strong>Company:</strong> [Name]<br><strong>Industry:</strong> [Industry]<br><strong>Size:</strong> [Employees / Revenue]<br><strong>Primary Contact:</strong> [Name, Title, Email]</p>
<h2>Current Situation</h2>
<p>[What tools/processes do they use today? What''s working? What isn''t?]</p>
<h2>Goals</h2>
<ul><li>[What they want to achieve]</li></ul>
<h2>Constraints</h2>
<ul><li>[Budget, timeline, technical, regulatory constraints]</li></ul>
<h2>Success Criteria</h2>
<p>[How will they measure success?]</p>', 51, v_u1),

  (NULL, 'Case Study', 'Tell the story of how a client achieved results using your product or service.', '🏆', 'sales-external', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Follow the Challenge → Solution → Results framework. Use specific numbers. Get client approval before publishing.</p></blockquote>
<h1>Case Study: [Client Name]</h1>
<h2>At a Glance</h2>
<table><tr><th>Detail</th><th>Value</th></tr><tr><td>Industry</td><td>[Industry]</td></tr><tr><td>Company Size</td><td>[Size]</td></tr><tr><td>Key Result</td><td>[Headline metric]</td></tr></table>
<h2>The Challenge</h2>
<p>[What problem did the client face?]</p>
<h2>The Solution</h2>
<p>[How did they use your product to solve it?]</p>
<h2>The Results</h2>
<ul><li><strong>[Metric]:</strong> [Before → After]</li></ul>
<h2>Client Quote</h2>
<blockquote><p>"[Quote from client]" — [Name, Title, Company]</p></blockquote>', 52, v_u1),

  (NULL, 'Executive Summary', 'One-page summary for busy stakeholders who need the highlights fast.', '📄', 'sales-external', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Keep to one page. Write for a C-level reader with 2 minutes. Lead with the recommendation.</p></blockquote>
<h1>Executive Summary: [Topic]</h1>
<h2>Recommendation</h2>
<p>[What are you recommending and why? One paragraph.]</p>
<h2>Background</h2>
<p>[Brief context — just enough to understand the recommendation]</p>
<h2>Key Findings</h2>
<ul><li>[Finding 1 with data]</li><li>[Finding 2 with data]</li></ul>
<h2>Options</h2>
<table><tr><th>Option</th><th>Pros</th><th>Cons</th><th>Cost</th></tr><tr><td>[Option]</td><td>[Pros]</td><td>[Cons]</td><td>[$]</td></tr></table>
<h2>Next Steps</h2>
<ul><li>[Action required with owner and date]</li></ul>', 53, v_u1),

  -- =====================================================================
  -- CREATIVE & MARKETING
  -- =====================================================================

  (NULL, 'Content Brief', 'Define the target audience, messaging, and requirements for a piece of content.', '✍️', 'creative-marketing', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Fill this out before assigning content to a writer. The more specific the brief, the fewer revision cycles you''ll need.</p></blockquote>
<h1>Content Brief: [Working Title]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Content Type</td><td>[Blog / Landing page / Email / Social]</td></tr><tr><td>Target Audience</td><td>[Specific persona]</td></tr><tr><td>Goal</td><td>[Awareness / Conversion / Education]</td></tr><tr><td>Word Count</td><td>[Target range]</td></tr><tr><td>Due Date</td><td>[Date]</td></tr><tr><td>Writer</td><td>[Name]</td></tr></table>
<h2>Key Message</h2>
<p>[The one thing the reader should take away]</p>
<h2>Outline</h2>
<ol><li>[Section 1: topic and key points]</li><li>[Section 2: topic and key points]</li></ol>
<h2>SEO Keywords</h2>
<ul><li>[Primary keyword]</li><li>[Secondary keywords]</li></ul>
<h2>References & Inspiration</h2>
<ul><li>[Link to reference content]</li></ul>
<h2>Brand Voice Notes</h2>
<p>[Tone, style, things to avoid]</p>', 60, v_u1),

  (NULL, 'Campaign Plan', 'Plan a marketing campaign from goals through execution and measurement.', '📢', 'creative-marketing', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Complete before launching any campaign. Get stakeholder buy-in on goals and budget before creating content.</p></blockquote>
<h1>Campaign Plan: [Campaign Name]</h1>
<table><tr><th>Field</th><th>Details</th></tr><tr><td>Campaign Owner</td><td>[Name]</td></tr><tr><td>Launch Date</td><td>[Date]</td></tr><tr><td>End Date</td><td>[Date]</td></tr><tr><td>Budget</td><td>$[Amount]</td></tr></table>
<h2>Objective</h2>
<p>[What business outcome does this campaign drive?]</p>
<h2>Target Audience</h2>
<p>[Who are we trying to reach? Be specific.]</p>
<h2>Key Messages</h2>
<ul><li>[Message 1]</li></ul>
<h2>Channels</h2>
<table><tr><th>Channel</th><th>Content Type</th><th>Frequency</th><th>Owner</th></tr><tr><td>[Channel]</td><td>[Type]</td><td>[Frequency]</td><td>[Name]</td></tr></table>
<h2>Timeline</h2>
<table><tr><th>Date</th><th>Activity</th><th>Owner</th></tr><tr><td>[Date]</td><td>[Activity]</td><td>[Name]</td></tr></table>
<h2>Success Metrics</h2>
<table><tr><th>Metric</th><th>Target</th></tr><tr><td>[Metric]</td><td>[Target]</td></tr></table>', 61, v_u1),

  (NULL, 'Brand Guidelines Reference', 'Quick-reference guide for brand voice, colors, typography, and usage rules.', '🎨', 'creative-marketing', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Keep this up to date and link to it from every content brief. This is the source of truth for how the brand presents itself.</p></blockquote>
<h1>Brand Guidelines: [Brand Name]</h1>
<h2>Brand Voice</h2>
<table><tr><th>We Are</th><th>We Are Not</th></tr><tr><td>[Confident, helpful, clear]</td><td>[Arrogant, jargon-heavy, vague]</td></tr></table>
<h2>Colors</h2>
<table><tr><th>Name</th><th>Hex</th><th>Usage</th></tr><tr><td>Primary Blue</td><td>#2563EB</td><td>CTAs, links, primary actions</td></tr><tr><td>Dark</td><td>#18181B</td><td>Text, backgrounds</td></tr></table>
<h2>Typography</h2>
<table><tr><th>Use</th><th>Font</th><th>Weight</th></tr><tr><td>Headings</td><td>[Font name]</td><td>Bold (700)</td></tr><tr><td>Body</td><td>[Font name]</td><td>Regular (400)</td></tr></table>
<h2>Logo Usage</h2>
<ul><li>[Minimum clear space rules]</li><li>[Approved color variations]</li><li>[What NOT to do]</li></ul>', 62, v_u1),

  (NULL, 'Editorial Calendar', 'Plan and track content publication across channels and dates.', '📅', 'creative-marketing', E'\\x7b7d',
  '<blockquote><p><strong>How to use:</strong> Update weekly. Each row is a content piece. Use status to track progress from planned through published.</p></blockquote>
<h1>Editorial Calendar: [Month/Quarter Year]</h1>
<table><tr><th>Date</th><th>Title</th><th>Type</th><th>Channel</th><th>Writer</th><th>Status</th></tr><tr><td>[Date]</td><td>[Title]</td><td>[Blog/Social/Email]</td><td>[Where published]</td><td>[Name]</td><td>Planned/Draft/Review/Published</td></tr><tr><td>[Date]</td><td>[Title]</td><td>[Type]</td><td>[Channel]</td><td>[Name]</td><td>[Status]</td></tr><tr><td>[Date]</td><td>[Title]</td><td>[Type]</td><td>[Channel]</td><td>[Name]</td><td>[Status]</td></tr></table>
<h2>Content Themes This Period</h2>
<ul><li>[Theme 1: description]</li><li>[Theme 2: description]</li></ul>
<h2>Key Dates</h2>
<ul><li>[Date] — [Event, holiday, or launch to tie content to]</li></ul>', 63, v_u1),

  -- =====================================================================
  -- BLANK
  -- =====================================================================

  (NULL, 'Blank Document', 'Start from scratch with an empty document.', '📄', 'general', E'\\x7b7d',
  '<h1>Untitled Document</h1><p>Start writing...</p>', 99, v_u1);

  RAISE NOTICE 'Seeded 33 system templates across 7 categories';
END $$;
