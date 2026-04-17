const http = require('http');

// ─── Config ─────────────────────────────────────────────────────────────────
// PROJECT_ID is resolved dynamically at runtime via /b3/api/projects; the
// script picks the first project visible to the logged-in admin. Override
// with SEED_PROJECT_ID if you need a specific project, or use --project-id=...
// SEED_ORG_SLUG is accepted for orchestrator parity; the actual org is
// determined by whichever session the admin credentials log into.
const SEED_ORG_SLUG_HINT = process.env.SEED_ORG_SLUG
  ?? process.argv.find((a) => a.startsWith('--org-slug='))?.split('=')[1];
const SEED_PROJECT_ID_OVERRIDE = process.env.SEED_PROJECT_ID
  ?? process.argv.find((a) => a.startsWith('--project-id='))?.split('=')[1];
let PROJECT_ID = SEED_PROJECT_ID_OVERRIDE || null;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'mcp@mage.io';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'mcpadmin12345678';
const TODAY = '2026-04-03';

let bbbCookie = ''; // session=... from BBB login
let opCount = 0;

function progress(label) {
  opCount++;
  if (opCount % 20 === 0) console.log(`  [${opCount} ops] ${label}`);
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 80,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(opts, (res) => {
      const setCookieRaw = res.headers['set-cookie'];
      let setCookie = null;
      if (setCookieRaw) {
        for (const c of setCookieRaw) {
          const pair = c.split(';')[0];
          if (pair) setCookie = pair;
        }
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { raw: data.slice(0, 300) };
        }
        resolve({ status: res.statusCode, body: parsed, setCookie });
      });
    });
    req.on('error', reject);
    if (payload) req.end(payload);
    else req.end();
  });
}

async function bbbApi(method, path, body) {
  const res = await request(method, '/b3/api' + path, body, bbbCookie);
  progress(`${method} /b3/api${path} -> ${res.status}`);
  return res;
}

async function helpdeskPublic(method, path, body, cookie) {
  const res = await request(method, '/helpdesk/api' + path, body, cookie || undefined);
  progress(`${method} /helpdesk/api${path} -> ${res.status}`);
  return res;
}

async function helpdeskAgent(method, path, body) {
  const res = await request(method, '/helpdesk-api' + path, body, bbbCookie);
  progress(`${method} /helpdesk-api${path} -> ${res.status}`);
  return res;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function randomDateBetween(startStr, endStr) {
  const s = new Date(startStr + 'T00:00:00Z').getTime();
  const e = new Date(endStr + 'T00:00:00Z').getTime();
  const t = s + Math.random() * (e - s);
  return new Date(t).toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Data ───────────────────────────────────────────────────────────────────

const engineers = [
  { email: 'ryan.chen@mage.io', display_name: 'Ryan Chen' },
  { email: 'maya.patel@mage.io', display_name: 'Maya Patel' },
  { email: 'alex.rodriguez@mage.io', display_name: 'Alex Rodriguez' },
  { email: 'sam.nakamura@mage.io', display_name: 'Sam Nakamura' },
  { email: 'jordan.lee@mage.io', display_name: 'Jordan Lee' },
  { email: 'taylor.kim@mage.io', display_name: 'Taylor Kim' },
  { email: 'casey.oconnor@mage.io', display_name: "Casey O'Connor" },
  { email: 'drew.washington@mage.io', display_name: 'Drew Washington' },
  { email: 'avery.singh@mage.io', display_name: 'Avery Singh' },
  { email: 'quinn.martinez@mage.io', display_name: 'Quinn Martinez' },
];

const epicDefs = [
  { name: 'Canvas Engine', color: '#3B82F6', description: 'Core rendering engine, layer management, and canvas transforms' },
  { name: 'AI Tools', color: '#8B5CF6', description: 'AI-powered background removal, upscaling, and generation' },
  { name: 'Export Pipeline', color: '#EC4899', description: 'PNG, JPEG, SVG, WebP, and PDF export workflows' },
  { name: 'Collaboration', color: '#F59E0B', description: 'Real-time multi-user editing and sharing' },
  { name: 'Infrastructure', color: '#10B981', description: 'CDN, storage, authentication, and API performance' },
];

const taskDefs = [
  // Canvas Engine
  { title: 'Implement non-destructive layer blending modes', priority: 'high', epicIdx: 0, points: 5 },
  { title: 'Add vector shape snapping to grid and guides', priority: 'medium', epicIdx: 0, points: 3 },
  { title: 'Optimize canvas redraw for layers exceeding 50', priority: 'critical', epicIdx: 0, points: 8 },
  { title: 'Support artboard-based multi-canvas layouts', priority: 'medium', epicIdx: 0, points: 5 },
  { title: 'Implement undo/redo stack with branching history', priority: 'high', epicIdx: 0, points: 8 },
  { title: 'Add perspective transform tool for raster layers', priority: 'low', epicIdx: 0, points: 3 },
  { title: 'Fix z-index reordering bug when grouping layers', priority: 'high', epicIdx: 0, points: 2 },
  // AI Tools
  { title: 'Integrate new background removal model v3', priority: 'high', epicIdx: 1, points: 5 },
  { title: 'Add AI-powered image upscaling to 4x resolution', priority: 'medium', epicIdx: 1, points: 5 },
  { title: 'Build prompt-based generative fill tool', priority: 'high', epicIdx: 1, points: 13 },
  { title: 'Implement smart object selection with SAM model', priority: 'medium', epicIdx: 1, points: 8 },
  { title: 'Add AI color palette suggestion from reference image', priority: 'low', epicIdx: 1, points: 3 },
  { title: 'Create style transfer filter pipeline', priority: 'medium', epicIdx: 1, points: 8 },
  // Export Pipeline
  { title: 'Add batch export with custom naming templates', priority: 'medium', epicIdx: 2, points: 5 },
  { title: 'Implement SVG export with editable text paths', priority: 'high', epicIdx: 2, points: 5 },
  { title: 'Support WebP and AVIF export with quality slider', priority: 'medium', epicIdx: 2, points: 3 },
  { title: 'Fix PDF export cutting off oversized artboards', priority: 'critical', epicIdx: 2, points: 3 },
  { title: 'Add export presets for social media dimensions', priority: 'low', epicIdx: 2, points: 2 },
  { title: 'Implement progressive JPEG export option', priority: 'low', epicIdx: 2, points: 2 },
  // Collaboration
  { title: 'Build real-time cursor presence indicators', priority: 'high', epicIdx: 3, points: 5 },
  { title: 'Implement operational transform for concurrent edits', priority: 'critical', epicIdx: 3, points: 13 },
  { title: 'Add commenting and annotation on canvas regions', priority: 'medium', epicIdx: 3, points: 5 },
  { title: 'Create shareable read-only project links', priority: 'medium', epicIdx: 3, points: 3 },
  { title: 'Build version history with visual diff comparison', priority: 'high', epicIdx: 3, points: 8 },
  { title: 'Add team workspace with role-based permissions', priority: 'medium', epicIdx: 3, points: 5 },
  // Infrastructure
  { title: 'Migrate asset storage to S3-compatible CDN', priority: 'high', epicIdx: 4, points: 5 },
  { title: 'Implement WebSocket connection pooling for collab', priority: 'medium', epicIdx: 4, points: 5 },
  { title: 'Add rate limiting and abuse prevention on API', priority: 'high', epicIdx: 4, points: 3 },
  { title: 'Set up automated database backups with PITR', priority: 'medium', epicIdx: 4, points: 3 },
  { title: 'Configure horizontal autoscaling for render workers', priority: 'medium', epicIdx: 4, points: 5 },
  { title: 'Implement structured logging and error tracking', priority: 'low', epicIdx: 4, points: 2 },
];

const taskComments = [
  { body: 'I started profiling this and found the main bottleneck is in the compositing step. Working on a fix now.' },
  { body: 'Can we add a feature flag for this? I want to test it with a subset of users before rolling out.' },
  { body: 'Updated the PR with the suggested changes. Ready for another review.' },
  { body: 'This is blocked by the API rate limiting work. Moving to next sprint if that is not done first.' },
  { body: 'Tested on Chrome, Firefox, and Safari. All passing except a minor rendering glitch on Safari that I am investigating.' },
  { body: 'The memory usage drops significantly with the new pooling approach. Benchmarks show a 40% improvement.' },
  { body: 'I think we should split this into two tasks: one for the UI and one for the backend pipeline.' },
  { body: 'Pushed a hotfix for the regression. The root cause was a stale cache entry in the CDN layer.' },
  { body: 'Design team confirmed the new layout. Updating the implementation to match the latest mockups.' },
  { body: 'Added unit tests covering the edge cases we discussed. Coverage is now at 92% for this module.' },
  { body: 'Looks good overall, but I have a concern about backward compatibility with older project files.' },
  { body: 'The AI model latency is around 1.2s on average. We should show a loading indicator during processing.' },
  { body: 'Verified the fix on staging. The export now correctly handles artboards larger than 4096px.' },
  { body: 'We need to coordinate with the infrastructure team on the S3 migration timeline before this can proceed.' },
  { body: 'Just completed the security review. No issues found. Approving for merge.' },
];

// Helpdesk customers
const customers = [
  { email: 'sarah.miller@outlook.com', display_name: 'Sarah Miller' },
  { email: 'james.wilson@gmail.com', display_name: 'James Wilson' },
  { email: 'emily.zhang@yahoo.com', display_name: 'Emily Zhang' },
  { email: 'michael.brown@hotmail.com', display_name: 'Michael Brown' },
  { email: 'lisa.taylor@proton.me', display_name: 'Lisa Taylor' },
  { email: 'david.garcia@gmail.com', display_name: 'David Garcia' },
  { email: 'jennifer.lee@outlook.com', display_name: 'Jennifer Lee' },
  { email: 'robert.jones@yahoo.com', display_name: 'Robert Jones' },
  { email: 'amanda.davis@gmail.com', display_name: 'Amanda Davis' },
  { email: 'chris.martinez@hotmail.com', display_name: 'Chris Martinez' },
  { email: 'nicole.anderson@proton.me', display_name: 'Nicole Anderson' },
  { email: 'kevin.thomas@gmail.com', display_name: 'Kevin Thomas' },
  { email: 'rachel.white@outlook.com', display_name: 'Rachel White' },
  { email: 'steven.harris@yahoo.com', display_name: 'Steven Harris' },
  { email: 'laura.clark@gmail.com', display_name: 'Laura Clark' },
];

const ticketTemplates = [
  // Bugs
  { subject: 'Canvas freezes when applying gaussian blur to large images', category: 'bug', priority: 'high',
    description: 'When I apply a gaussian blur filter to an image larger than 3000x3000 pixels, the entire canvas becomes unresponsive for about 30 seconds. Sometimes it crashes the tab completely. This happens consistently on Chrome 124 and Firefox 126.' },
  { subject: 'Export to PNG produces blank image on retina displays', category: 'bug', priority: 'high',
    description: 'Exporting any project as PNG on my MacBook Pro (retina display) results in a completely blank white image. The same project exports correctly on my Windows desktop. This started happening after the last update.' },
  { subject: 'Login session expires after only 5 minutes of inactivity', category: 'bug', priority: 'medium',
    description: 'My session keeps expiring way too quickly. After about 5 minutes of not actively clicking in the editor, I get redirected to the login page and lose any unsaved changes. This is very frustrating.' },
  { subject: 'Layers panel shows incorrect thumbnail after moving layers', category: 'bug', priority: 'low',
    description: 'After drag-and-dropping layers to reorder them, the thumbnail previews in the layers panel do not update to reflect the new order. They still show the old arrangement until I refresh the page.' },
  { subject: 'Undo does not work correctly after using the eraser tool', category: 'bug', priority: 'medium',
    description: 'When I use the eraser tool and then press Ctrl+Z to undo, it undoes the wrong action. It seems to skip the eraser strokes and undo the previous brush stroke instead. This makes the eraser tool almost unusable.' },
  { subject: 'Text layers lose custom font when reopening a project', category: 'bug', priority: 'medium',
    description: 'I set a text layer to use the font Playfair Display, save the project, and close it. When I reopen it, the text layer has reverted to the default Arial font. All my typography work is lost each time.' },
  { subject: 'Color picker shows wrong hex value for selected color', category: 'bug', priority: 'low',
    description: 'The hex value displayed in the color picker does not match the actual color shown in the preview swatch. For example, I see a blue color but the hex reads as #FF5733 which is orange.' },
  // Feature requests
  { subject: 'Please add PSD file import support', category: 'feature_request', priority: 'medium',
    description: 'It would be incredibly helpful to import Photoshop PSD files with layers preserved. Many of my clients send me PSD files and I currently have to flatten them before importing, which defeats the purpose of using Mage.' },
  { subject: 'Request for mobile/tablet support with touch gestures', category: 'feature_request', priority: 'medium',
    description: 'I would love to use Mage on my iPad Pro. Please consider adding touch gesture support for pinch-to-zoom, two-finger pan, and stylus pressure sensitivity. This would be a game changer for on-the-go editing.' },
  { subject: 'Add keyboard shortcut customization panel', category: 'feature_request', priority: 'low',
    description: 'I am switching from Photoshop and the keyboard shortcuts are very different. It would be great to have a customizable shortcut panel where I can remap keys to match my muscle memory from other tools.' },
  { subject: 'Batch processing multiple images with same adjustments', category: 'feature_request', priority: 'medium',
    description: 'I often need to apply the same color correction and resize to hundreds of product photos. A batch processing feature would save me hours of repetitive work each week.' },
  { subject: 'Support for CMYK color mode for print workflows', category: 'feature_request', priority: 'high',
    description: 'As a print designer, I need CMYK color mode support. Currently everything is in RGB which means colors shift when sent to print. This is a dealbreaker for professional print work.' },
  // Performance issues
  { subject: 'Editor becomes extremely slow with more than 20 layers', category: 'performance', priority: 'high',
    description: 'Once my project has more than 20 layers, every operation becomes painfully slow. Brush strokes lag by 2-3 seconds, and switching between layers takes 5+ seconds. My machine has 32GB RAM and an RTX 4070.' },
  { subject: 'Initial page load takes over 15 seconds', category: 'performance', priority: 'medium',
    description: 'The editor takes a very long time to load initially, sometimes up to 15-20 seconds. I have a fast internet connection (500 Mbps) so I do not think it is on my end. Other web apps load instantly.' },
  { subject: 'Memory usage climbs to 4GB after extended editing session', category: 'performance', priority: 'high',
    description: 'After working in Mage for about 2 hours, my browser tab is using over 4GB of memory according to Task Manager. The editor becomes sluggish and eventually crashes. I have to reload every hour or so.' },
  // AI tool quality
  { subject: 'Background removal leaves artifacts around hair edges', category: 'bug', priority: 'medium',
    description: 'The AI background removal tool works well on simple backgrounds but leaves noticeable white fringe artifacts around hair and fine details. This makes it unusable for professional portrait work.' },
  { subject: 'AI upscaling introduces visible grid patterns', category: 'bug', priority: 'medium',
    description: 'When using the AI upscaling feature to enlarge images by 2x or more, I can see a faint grid pattern in smooth gradient areas. It looks like tiling artifacts from the upscaling model.' },
  { subject: 'Generative fill produces inconsistent lighting', category: 'bug', priority: 'low',
    description: 'When I use generative fill to extend an image, the lighting direction in the generated area does not match the original image. The shadows go in different directions which looks very unnatural.' },
  // Misc
  { subject: 'Cannot download invoice for my subscription', category: 'billing', priority: 'medium',
    description: 'I need to download the invoice for my Pro subscription for tax purposes, but clicking the download button on the billing page does nothing. I have tried multiple browsers with the same result.' },
  { subject: 'How to transfer project ownership to another team member', category: 'question', priority: 'low',
    description: 'I created several projects under my account but I am leaving the company. I need to transfer ownership of these projects to my colleague. I cannot find this option anywhere in the settings.' },
  { subject: 'SVG import loses gradient fills and becomes solid color', category: 'bug', priority: 'medium',
    description: 'When importing SVG files that contain gradient fills, all gradients are converted to solid colors using just the first color stop. This makes SVG import nearly useless for complex vector artwork.' },
  { subject: 'Brush opacity slider does not respond to scroll wheel', category: 'bug', priority: 'low',
    description: 'Most design tools allow you to adjust the brush opacity by hovering over the slider and using the mouse scroll wheel. In Mage, the scroll wheel does nothing on the opacity slider, requiring precise clicking.' },
  { subject: 'Please add dark mode for the editor interface', category: 'feature_request', priority: 'low',
    description: 'Working late at night with the bright white editor interface is straining on the eyes. A dark mode option would be very welcome, especially for long editing sessions.' },
  { subject: 'Selection tool does not support feathered edges', category: 'feature_request', priority: 'medium',
    description: 'The rectangular and elliptical selection tools create hard edges only. Adding a feather radius option would allow smoother compositing and more natural looking cutouts.' },
];

// Agent replies for tickets
const agentReplies = [
  'Thank you for reporting this issue. I have been able to reproduce it on our end and have escalated it to the engineering team. We will keep you updated on the fix.',
  'I appreciate you reaching out. Could you please share your browser version and operating system so we can investigate this more thoroughly?',
  'We have identified the root cause of this issue and a fix is currently being tested. We expect to deploy it within the next 48 hours.',
  'Thank you for your patience. This is a known issue that our team is actively working on. I have added your case to the tracking ticket for priority.',
  'I understand how frustrating this must be. As a temporary workaround, you can try clearing your browser cache and disabling any browser extensions, then retry the operation.',
  'Great news! We just deployed a fix for this in our latest update. Could you please try again and let us know if the issue persists?',
  'Thank you for this feature request. I have forwarded it to our product team for consideration in an upcoming release. We really value this kind of feedback.',
  'I have looked into your account and I can see the issue. Let me apply a fix on our end. You should see the change take effect within a few minutes.',
  'Could you provide a screenshot or screen recording showing the issue? This will help our engineers pinpoint exactly where the problem occurs.',
  'We are aware of this limitation and it is on our roadmap for Q2 2026. I will add your vote to the feature request to help prioritize it.',
  'I have tested this on our staging environment and it looks like the issue is specific to certain image dimensions. Could you tell me the resolution of the image you are working with?',
  'This is being addressed in our next major update scheduled for later this month. In the meantime, exporting at a lower resolution should work as a workaround.',
];

// Customer follow-up replies
const customerFollowUps = [
  'Thanks for the quick response. I am using Chrome 124.0 on Windows 11. Let me know if you need any other details.',
  'I tried clearing the cache and it did not help unfortunately. The issue still happens consistently.',
  'I just updated and the fix seems to be working! Thank you so much for the fast turnaround.',
  'Here is a screenshot showing the problem. You can see the artifacts clearly around the edges.',
  'That workaround helps for now, but I hope a permanent fix is coming soon. This affects my daily workflow.',
  'I really appreciate the update. Looking forward to the next release with this fix included.',
  'The image I am working with is 4000x3000 pixels at 300 DPI. It is a product photo for an e-commerce site.',
  'Thanks, I can confirm the fix is working on my end now. Great support as always!',
  'Is there an ETA on when this feature will be available? It would really help my team out.',
  'I tried the workaround but it only partially fixed the issue. The lag is reduced but still noticeable with complex projects.',
  'Thanks for looking into this. I am available to test any beta fixes if that would help speed things up.',
  'Glad to hear it is on the roadmap. That is exactly what we need for our print production workflow.',
];

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log('=== Mage Direct Seed Script ===\n');

    // ── Step 1: Login as admin ────────────────────────────────────────────
    console.log('Step 1: Logging in as admin...');
    const loginRes = await request('POST', '/b3/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (loginRes.setCookie) {
      bbbCookie = loginRes.setCookie;
      console.log('  Logged in, cookie saved');
    } else {
      console.error('  FAILED to login:', JSON.stringify(loginRes.body));
      process.exit(1);
    }

    // ── Step 1b: Resolve PROJECT_ID if not supplied ───────────────────────
    if (!PROJECT_ID) {
      console.log('  Resolving target project via /b3/api/projects...');
      const projRes = await bbbApi('GET', '/projects');
      const projList = projRes.body?.data || [];
      if (projList.length === 0) {
        console.error('  No projects visible to this admin. Create one first via MCP or Bam UI.');
        process.exit(1);
      }
      PROJECT_ID = projList[0].id;
      console.log(`  Using project: "${projList[0].name}" (${PROJECT_ID})`);
      if (SEED_ORG_SLUG_HINT) {
        console.log(`  (SEED_ORG_SLUG=${SEED_ORG_SLUG_HINT} hint noted; org is selected by admin login session)`);
      }
    }

    // ── Step 2: Fetch phases (needed to create tasks) ─────────────────────
    console.log('\nStep 2: Fetching project phases...');
    const phasesRes = await bbbApi('GET', `/projects/${PROJECT_ID}/phases`);
    const phaseList = phasesRes.body?.data || [];
    if (phaseList.length === 0) {
      console.error('  No phases found for project!');
      process.exit(1);
    }
    const phaseMap = {};
    phaseList.forEach((p) => (phaseMap[p.name] = p.id));
    const phaseIds = phaseList.map((p) => p.id);
    console.log('  Phases:', Object.keys(phaseMap).join(', '));

    // ── Step 3: Add 10 engineers ──────────────────────────────────────────
    console.log('\nStep 3: Inviting 10 engineers to org and project...');
    const engineerIds = [];
    for (const eng of engineers) {
      try {
        const invRes = await bbbApi('POST', '/org/members/invite', {
          email: eng.email,
          role: 'member',
          display_name: eng.display_name,
        });
        const userId = invRes.body?.data?.id;
        if (userId) {
          engineerIds.push(userId);
          try {
            await bbbApi('POST', `/projects/${PROJECT_ID}/members`, {
              user_id: userId,
              role: 'member',
            });
          } catch (e) {
            console.log(`    Warning: could not add ${eng.display_name} to project: ${e.message}`);
          }
          console.log(`  + ${eng.display_name} (${userId})`);
        } else {
          console.log(`  ~ ${eng.display_name}: ${JSON.stringify(invRes.body?.error?.message || invRes.body).slice(0, 120)}`);
        }
      } catch (e) {
        console.log(`  ! Error inviting ${eng.display_name}: ${e.message}`);
      }
    }
    console.log(`  ${engineerIds.length} engineers added`);

    // ── Step 4: Create 3 sprints ──────────────────────────────────────────
    console.log('\nStep 4: Creating sprints...');
    const sprintDefs = [
      { name: 'Sprint 14', goal: 'Layer management and export pipeline', start_date: '2026-03-23', end_date: '2026-04-04' },
      { name: 'Sprint 15', goal: 'AI tools and collaborative editing', start_date: '2026-04-07', end_date: '2026-04-18' },
      { name: 'Sprint 16', goal: 'Performance optimization and mobile support', start_date: '2026-04-21', end_date: '2026-05-02' },
    ];
    const sprintIds = [];
    for (const sd of sprintDefs) {
      try {
        const res = await bbbApi('POST', `/projects/${PROJECT_ID}/sprints`, sd);
        if (res.body?.data?.id) {
          sprintIds.push(res.body.data.id);
          console.log(`  + ${sd.name} (${res.body.data.id})`);
        } else {
          console.log(`  ~ ${sd.name}: ${JSON.stringify(res.body?.error?.message || res.body).slice(0, 120)}`);
        }
      } catch (e) {
        console.log(`  ! Error creating ${sd.name}: ${e.message}`);
      }
    }

    // Start Sprint 14 (make it active)
    if (sprintIds[0]) {
      try {
        await bbbApi('POST', `/sprints/${sprintIds[0]}/start`);
        console.log('  Sprint 14 started (active)');
      } catch (e) {
        console.log(`  ~ Could not start Sprint 14: ${e.message}`);
      }
    }

    // ── Step 5: Create 5 epics ────────────────────────────────────────────
    console.log('\nStep 5: Creating epics...');
    const epicIds = [];
    for (const ed of epicDefs) {
      try {
        const res = await bbbApi('POST', `/projects/${PROJECT_ID}/epics`, {
          name: ed.name,
          color: ed.color,
          description: ed.description,
          status: 'in_progress',
          start_date: '2026-03-20',
          target_date: '2026-05-03',
        });
        if (res.body?.data?.id) {
          epicIds.push(res.body.data.id);
          console.log(`  + ${ed.name} (${res.body.data.id})`);
        } else {
          console.log(`  ~ ${ed.name}: ${JSON.stringify(res.body?.error?.message || res.body).slice(0, 120)}`);
        }
      } catch (e) {
        console.log(`  ! Error creating ${ed.name}: ${e.message}`);
      }
    }

    // ── Step 6: Create ~31 tasks ──────────────────────────────────────────
    console.log('\nStep 6: Creating tasks (target ~31 new tasks to reach 80 total)...');
    const createdTaskIds = [];
    let engineerRR = 0;

    for (let i = 0; i < taskDefs.length; i++) {
      const td = taskDefs[i];
      const assigneeId = engineerIds.length > 0 ? engineerIds[engineerRR % engineerIds.length] : undefined;
      engineerRR++;

      // Distribute across phases round-robin
      const phaseId = phaseIds[i % phaseIds.length];

      // Distribute across sprints: first 12 -> Sprint 14, next 10 -> Sprint 15, rest -> Sprint 16
      let sprintId = null;
      if (i < 12 && sprintIds[0]) sprintId = sprintIds[0];
      else if (i < 22 && sprintIds[1]) sprintId = sprintIds[1];
      else if (sprintIds[2]) sprintId = sprintIds[2];

      // Date range: 2026-03-20 to 2026-05-03
      const startDate = randomDateBetween('2026-03-20', '2026-04-15');
      const dueDate = addDays(startDate, 5 + Math.floor(Math.random() * 14));

      const epicId = epicIds[td.epicIdx] || null;

      try {
        const res = await bbbApi('POST', `/projects/${PROJECT_ID}/tasks`, {
          title: td.title,
          description: `Implementation task for: ${td.title}. This is part of the Mage online image editor project.`,
          phase_id: phaseId,
          sprint_id: sprintId,
          assignee_id: assigneeId || undefined,
          priority: td.priority,
          story_points: td.points,
          start_date: startDate,
          due_date: dueDate,
          epic_id: epicId,
        });
        if (res.body?.data?.id) {
          createdTaskIds.push(res.body.data.id);
        } else {
          console.log(`  ~ Task "${td.title.slice(0, 50)}": ${JSON.stringify(res.body?.error?.message || res.body).slice(0, 120)}`);
        }
      } catch (e) {
        console.log(`  ! Error creating task "${td.title.slice(0, 40)}": ${e.message}`);
      }
    }
    console.log(`  ${createdTaskIds.length} tasks created`);

    // ── Step 7: Add comments on 15 tasks ──────────────────────────────────
    console.log('\nStep 7: Adding comments on 15 tasks...');
    const tasksToComment = createdTaskIds.slice(0, Math.min(15, createdTaskIds.length));
    let commentCount = 0;
    for (let i = 0; i < tasksToComment.length; i++) {
      const tid = tasksToComment[i];
      const numComments = 2 + Math.floor(Math.random() * 2); // 2-3 comments
      for (let c = 0; c < numComments; c++) {
        const commentBody = taskComments[(i * 3 + c) % taskComments.length];
        try {
          await bbbApi('POST', `/tasks/${tid}/comments`, { body: commentBody });
          commentCount++;
        } catch (e) {
          console.log(`  ! Error adding comment: ${e.message}`);
        }
      }
    }
    console.log(`  ${commentCount} comments added`);

    // ── Step 8: Configure helpdesk settings ───────────────────────────────
    console.log('\nStep 8: Configuring helpdesk settings...');
    // Get the first phase as default
    const defaultPhaseId = phaseIds[0] || null;
    try {
      const settingsRes = await helpdeskAgent('PATCH', '/helpdesk/settings', {
        default_project_id: PROJECT_ID,
        default_phase_id: defaultPhaseId,
        default_priority: 'medium',
        categories: ['bug', 'feature_request', 'performance', 'billing', 'question'],
        welcome_message: 'Welcome to Mage Support! We are here to help with any issues related to our online image editor.',
        auto_close_days: 14,
        notify_on_status_change: true,
        notify_on_agent_reply: true,
        allowed_email_domains: [],
        require_email_verification: false,
      });
      console.log(`  Helpdesk settings configured (status: ${settingsRes.status})`);
    } catch (e) {
      console.log(`  ! Error configuring helpdesk: ${e.message}`);
    }

    // ── Step 9: Register 15 helpdesk customers ────────────────────────────
    console.log('\nStep 9: Registering 15 helpdesk customers...');
    const customerSessions = []; // { cookie, email, display_name }
    for (const cust of customers) {
      try {
        const res = await helpdeskPublic('POST', '/auth/register', {
          email: cust.email,
          display_name: cust.display_name,
          password: 'TestPassword123!',
        });
        if (res.setCookie) {
          customerSessions.push({ cookie: res.setCookie, email: cust.email, display_name: cust.display_name });
          console.log(`  + ${cust.display_name}`);
        } else {
          // Maybe already registered, try login
          const loginR = await helpdeskPublic('POST', '/auth/login', {
            email: cust.email,
            password: 'TestPassword123!',
          });
          if (loginR.setCookie) {
            customerSessions.push({ cookie: loginR.setCookie, email: cust.email, display_name: cust.display_name });
            console.log(`  + ${cust.display_name} (logged in)`);
          } else {
            console.log(`  ~ ${cust.display_name}: could not register or login`);
          }
        }
      } catch (e) {
        console.log(`  ! Error registering ${cust.display_name}: ${e.message}`);
      }
    }
    console.log(`  ${customerSessions.length} customers ready`);

    // ── Step 10: Each customer creates 12 tickets (180 total) ─────────────
    console.log('\nStep 10: Creating helpdesk tickets (12 per customer)...');
    const allTickets = []; // { ticketId, customerIdx }
    let ticketCount = 0;

    for (let ci = 0; ci < customerSessions.length; ci++) {
      const cs = customerSessions[ci];
      for (let ti = 0; ti < 12; ti++) {
        const tmpl = ticketTemplates[(ci * 12 + ti) % ticketTemplates.length];
        // Add slight variation to subject to avoid exact duplicates
        const suffix = ti > 0 ? ` (case ${ci * 12 + ti + 1})` : '';
        try {
          const res = await helpdeskPublic('POST', '/tickets', {
            subject: tmpl.subject + suffix,
            description: tmpl.description,
            category: tmpl.category,
            priority: tmpl.priority,
          }, cs.cookie);
          const ticketId = res.body?.data?.id;
          if (ticketId) {
            allTickets.push({ ticketId, customerIdx: ci });
            ticketCount++;
          } else {
            // Might be in res.body.data, check different structures
            const altId = res.body?.data?.id;
            if (altId) {
              allTickets.push({ ticketId: altId, customerIdx: ci });
              ticketCount++;
            }
          }
        } catch (e) {
          // continue
        }
      }
      if ((ci + 1) % 5 === 0) console.log(`  ${ticketCount} tickets created so far (${ci + 1}/${customerSessions.length} customers done)`);
    }
    console.log(`  ${ticketCount} total tickets created`);

    // ── Step 11: Add 2-4 message exchanges on each ticket ────────────────
    console.log('\nStep 11: Adding message exchanges on tickets...');
    let msgCount = 0;

    for (let ti = 0; ti < allTickets.length; ti++) {
      const t = allTickets[ti];
      const numExchanges = 2 + Math.floor(Math.random() * 3); // 2-4 exchanges
      const cs = customerSessions[t.customerIdx];

      for (let ex = 0; ex < numExchanges; ex++) {
        // Agent replies (via BBB cookie on helpdesk-api)
        try {
          const agentReplyText = agentReplies[(ti * 4 + ex) % agentReplies.length];
          await helpdeskAgent('POST', `/tickets/${t.ticketId}/messages`, {
            body: agentReplyText,
            is_internal: false,
          });
          msgCount++;
        } catch (e) {
          // continue
        }

        // Customer replies back
        if (ex < numExchanges - 1) {
          try {
            const custReplyText = customerFollowUps[(ti * 3 + ex) % customerFollowUps.length];
            await helpdeskPublic('POST', `/helpdesk/tickets/${t.ticketId}/messages`, {
              body: custReplyText,
            }, cs.cookie);
            msgCount++;
          } catch (e) {
            // continue
          }
        }
      }

      if ((ti + 1) % 20 === 0) console.log(`  ${msgCount} messages posted (${ti + 1}/${allTickets.length} tickets done)`);
    }
    console.log(`  ${msgCount} total messages posted`);

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n=== Seed Complete ===');
    console.log(`  Engineers: ${engineerIds.length}`);
    console.log(`  Sprints: ${sprintIds.length}`);
    console.log(`  Epics: ${epicIds.length}`);
    console.log(`  New tasks: ${createdTaskIds.length}`);
    console.log(`  Task comments: ${commentCount}`);
    console.log(`  Helpdesk customers: ${customerSessions.length}`);
    console.log(`  Helpdesk tickets: ${ticketCount}`);
    console.log(`  Ticket messages: ${msgCount}`);
    console.log(`  Total API operations: ${opCount}`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
