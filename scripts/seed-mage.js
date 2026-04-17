const http = require('http');
const fs = require('fs');

// Accepted env/CLI knobs (no hardcoded ORG_ID / USER_IDS block — this seeder
// creates the project and engineers via the API + MCP, so the target org is
// determined by whichever session/API key is in use):
//   SEED_ORG_SLUG=<slug>  - hint for the orchestrator; logged for parity.
//   SEED_API_KEY=<bbam_…> - overrides the default MCP API key.
const SEED_ORG_SLUG_HINT = process.env.SEED_ORG_SLUG
  ?? process.argv.find((a) => a.startsWith('--org-slug='))?.split('=')[1];

const API_KEY = process.env.SEED_API_KEY || process.argv[2] || 'pSZWxak-0dDbqKDJuh1aH_ygpYC83rzbr2rA_RYKN48';
const COOKIE_PATH = process.argv[3] || '/tmp/mage.jar';

let SESSION_ID = '';
let reqId = 0;

if (SEED_ORG_SLUG_HINT) {
  console.log(`seed-mage: SEED_ORG_SLUG=${SEED_ORG_SLUG_HINT} noted; org is selected by the API key / session used.`);
}

function mcpCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: ++reqId, method, params });
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/mcp', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer ' + API_KEY,
        ...(SESSION_ID ? { 'mcp-session-id': SESSION_ID } : {}),
      },
    }, (res) => {
      if (!SESSION_ID && res.headers['mcp-session-id']) SESSION_ID = res.headers['mcp-session-id'];
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const match = data.match(/data: ({.*})/);
        resolve(match ? JSON.parse(match[1]) : { raw: data.slice(0, 300) });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function tool(name, args) { return mcpCall('tools/call', { name, arguments: args }); }

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    let cookieHeader = '';
    try {
      const cookies = fs.readFileSync(COOKIE_PATH, 'utf8');
      const m = cookies.match(/session\t([^\n\r]+)/);
      if (m) cookieHeader = 'session=' + m[1];
    } catch {}
    const opts = {
      hostname: 'localhost', port: 80, path: '/b3/api' + path, method,
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d.slice(0, 200) }); } });
    });
    req.on('error', reject);
    if (body) req.end(JSON.stringify(body));
    else req.end();
  });
}

function helpdeskCall(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 80, path: '/helpdesk/api' + path, method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { 'Cookie': cookie } : {}) },
    };
    const req = http.request(opts, res => {
      let d = '';
      const setCookie = res.headers['set-cookie']?.[0]?.split(';')[0];
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ data: JSON.parse(d), cookie: setCookie }); } catch { resolve({ raw: d.slice(0, 200) }); } });
    });
    req.on('error', reject);
    if (body) req.end(JSON.stringify(body));
    else req.end();
  });
}

function agentReply(ticketId, body, cookie) {
  return new Promise((resolve, reject) => {
    const reqBody = JSON.stringify({ body, is_internal: false });
    const req = http.request({
      hostname: 'localhost', port: 80, path: `/helpdesk-api/tickets/${ticketId}/messages`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.end(reqBody);
  });
}

(async () => {
  // Init MCP
  await mcpCall('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'mage-seed', version: '1.0' } });
  console.log('MCP session:', SESSION_ID);

  // Create Mage project via MCP
  console.log('\n=== Creating Mage project ===');
  const projRes = await tool('create_project', { name: 'Mage', task_id_prefix: 'MAGE', template: 'kanban_standard', description: 'Online image editor with AI-powered tools' });
  const projData = JSON.parse(projRes.result.content[0].text);
  const PROJECT_ID = projData.data.id;
  console.log('Project:', PROJECT_ID);

  // Get phases
  const phasesRes = await tool('list_phases', { project_id: PROJECT_ID });
  const phases = JSON.parse(phasesRes.result.content[0].text).data;
  const phaseMap = {};
  phases.forEach(p => phaseMap[p.name] = p.id);
  console.log('Phases:', Object.keys(phaseMap).join(', '));

  // Create 10 engineers
  console.log('\n=== Creating 10 engineers ===');
  const engineers = [
    { email: 'ryan.chen@mage.io', display_name: 'Ryan Chen' },
    { email: 'maya.patel@mage.io', display_name: 'Maya Patel' },
    { email: 'alex.rodriguez@mage.io', display_name: 'Alex Rodriguez' },
    { email: 'sam.nakamura@mage.io', display_name: 'Sam Nakamura' },
    { email: 'jordan.lee@mage.io', display_name: 'Jordan Lee' },
    { email: 'taylor.swift@mage.io', display_name: 'Taylor Kim' },
    { email: 'casey.oconnor@mage.io', display_name: 'Casey O\'Connor' },
    { email: 'drew.washington@mage.io', display_name: 'Drew Washington' },
    { email: 'avery.singh@mage.io', display_name: 'Avery Singh' },
    { email: 'quinn.martinez@mage.io', display_name: 'Quinn Martinez' },
  ];
  const engineerIds = [];
  for (const e of engineers) {
    const res = await apiCall('POST', '/org/members/invite', { ...e, role: 'member' });
    if (res.data?.id) {
      engineerIds.push(res.data.id);
      await apiCall('POST', `/projects/${PROJECT_ID}/members`, { user_id: res.data.id, role: 'member' });
      console.log('  + ' + e.display_name);
    }
  }

  // Create sprints
  console.log('\n=== Creating sprints ===');
  const s1 = await apiCall('POST', `/projects/${PROJECT_ID}/sprints`, { name: 'Sprint 14', goal: 'Layer management and export pipeline', start_date: '2026-03-23', end_date: '2026-04-04' });
  const s2 = await apiCall('POST', `/projects/${PROJECT_ID}/sprints`, { name: 'Sprint 15', goal: 'AI tools and collaborative editing', start_date: '2026-04-07', end_date: '2026-04-18' });
  const s3 = await apiCall('POST', `/projects/${PROJECT_ID}/sprints`, { name: 'Sprint 16', goal: 'Performance and mobile support', start_date: '2026-04-21', end_date: '2026-05-02' });
  if (s1.data?.id) await apiCall('POST', `/sprints/${s1.data.id}/start`);
  console.log('Sprint 14 (active), Sprint 15, Sprint 16');

  // Create epics
  console.log('\n=== Creating epics ===');
  const epicDefs = [
    { name: 'Canvas Engine', color: '#3B82F6', description: 'Core rendering, layers, transforms' },
    { name: 'AI Tools', color: '#8B5CF6', description: 'Background removal, upscaling, generation' },
    { name: 'Export Pipeline', color: '#EC4899', description: 'PNG, JPEG, SVG, PDF export' },
    { name: 'Collaboration', color: '#F59E0B', description: 'Real-time multi-user editing' },
    { name: 'Infrastructure', color: '#10B981', description: 'CDN, storage, auth, APIs' },
  ];
  const epicIds = [];
  for (const e of epicDefs) {
    const r = await apiCall('POST', `/projects/${PROJECT_ID}/epics`, e);
    if (r.data?.id) epicIds.push(r.data.id);
  }

  // Create labels
  const labelDefs = [
    { name: 'Bug', color: '#EF4444' }, { name: 'Feature', color: '#3B82F6' },
    { name: 'Performance', color: '#10B981' }, { name: 'UX', color: '#EC4899' },
    { name: 'Security', color: '#F59E0B' }, { name: 'Mobile', color: '#6366F1' },
  ];
  for (const l of labelDefs) await apiCall('POST', `/projects/${PROJECT_ID}/labels`, { ...l, position: 0 });

  // Create 80 tasks via MCP
  console.log('\n=== Creating 80 tasks ===');
  const today = new Date('2026-04-03');
  const taskDefs = [
    // Done (15)
    { t: 'Implement canvas zoom and pan controls', ph: 'Done', pr: 'high', pts: 8, ep: 0, d: -12, dur: 4 },
    { t: 'Add layer opacity slider', ph: 'Done', pr: 'medium', pts: 3, ep: 0, d: -11, dur: 2 },
    { t: 'Build PNG export with alpha channel', ph: 'Done', pr: 'high', pts: 5, ep: 2, d: -10, dur: 3 },
    { t: 'Set up S3 bucket for user uploads', ph: 'Done', pr: 'critical', pts: 5, ep: 4, d: -14, dur: 2 },
    { t: 'Implement OAuth2 login (Google/GitHub)', ph: 'Done', pr: 'critical', pts: 8, ep: 4, d: -13, dur: 4 },
    { t: 'Design color picker component', ph: 'Done', pr: 'medium', pts: 5, ep: 0, d: -10, dur: 3 },
    { t: 'Add undo/redo stack', ph: 'Done', pr: 'high', pts: 8, ep: 0, d: -9, dur: 4 },
    { t: 'Build brush tool with pressure sensitivity', ph: 'Done', pr: 'high', pts: 8, ep: 0, d: -8, dur: 5 },
    { t: 'Implement selection tool (rectangle + lasso)', ph: 'Done', pr: 'medium', pts: 5, ep: 0, d: -7, dur: 3 },
    { t: 'Add keyboard shortcuts for tools', ph: 'Done', pr: 'low', pts: 3, ep: 0, d: -9, dur: 2 },
    { t: 'Set up CI/CD pipeline with GitHub Actions', ph: 'Done', pr: 'high', pts: 5, ep: 4, d: -14, dur: 3 },
    { t: 'Configure CDN for static assets', ph: 'Done', pr: 'medium', pts: 3, ep: 4, d: -12, dur: 2 },
    { t: 'JPEG export with quality slider', ph: 'Done', pr: 'medium', pts: 3, ep: 2, d: -6, dur: 2 },
    { t: 'Add dark mode support', ph: 'Done', pr: 'low', pts: 3, ep: 0, d: -8, dur: 2 },
    { t: 'Build project file save/load (.mage format)', ph: 'Done', pr: 'critical', pts: 13, ep: 0, d: -11, dur: 5 },
    // Review (10)
    { t: 'SVG export for vector layers', ph: 'Review', pr: 'high', pts: 5, ep: 2, d: -3, dur: 3 },
    { t: 'Add layer blending modes (multiply, screen, overlay)', ph: 'Review', pr: 'medium', pts: 5, ep: 0, d: -2, dur: 3 },
    { t: 'Implement text tool with font selection', ph: 'Review', pr: 'high', pts: 8, ep: 0, d: -2, dur: 4 },
    { t: 'Build crop and resize tool', ph: 'Review', pr: 'medium', pts: 5, ep: 0, d: -1, dur: 3 },
    { t: 'Add image filters (brightness, contrast, saturation)', ph: 'Review', pr: 'medium', pts: 5, ep: 0, d: -1, dur: 3 },
    { t: 'PDF export with multi-page support', ph: 'Review', pr: 'medium', pts: 8, ep: 2, d: -2, dur: 4 },
    { t: 'WebSocket connection for real-time sync', ph: 'Review', pr: 'critical', pts: 8, ep: 3, d: -3, dur: 4 },
    { t: 'Rate limiting for API endpoints', ph: 'Review', pr: 'high', pts: 3, ep: 4, d: -1, dur: 2 },
    { t: 'Add batch export (multiple formats at once)', ph: 'Review', pr: 'low', pts: 3, ep: 2, d: -1, dur: 2 },
    { t: 'Implement gradient fill tool', ph: 'Review', pr: 'medium', pts: 5, ep: 0, d: -2, dur: 3 },
    // In Progress (12)
    { t: 'AI background removal tool', ph: 'In Progress', pr: 'critical', pts: 13, ep: 1, d: 0, dur: 6 },
    { t: 'Real-time cursor sharing between users', ph: 'In Progress', pr: 'high', pts: 8, ep: 3, d: -1, dur: 5 },
    { t: 'Layer group/folder support', ph: 'In Progress', pr: 'high', pts: 8, ep: 0, d: 0, dur: 4 },
    { t: 'AI image upscaling (2x, 4x)', ph: 'In Progress', pr: 'high', pts: 8, ep: 1, d: -1, dur: 5 },
    { t: 'Build shape tool (rectangle, ellipse, polygon)', ph: 'In Progress', pr: 'medium', pts: 5, ep: 0, d: 0, dur: 3 },
    { t: 'Implement layer masks', ph: 'In Progress', pr: 'high', pts: 8, ep: 0, d: -2, dur: 5 },
    { t: 'Add commenting on canvas regions', ph: 'In Progress', pr: 'medium', pts: 5, ep: 3, d: 0, dur: 4 },
    { t: 'Smart object support (embedded PSD layers)', ph: 'In Progress', pr: 'medium', pts: 8, ep: 0, d: -1, dur: 5 },
    { t: 'Template gallery with starter designs', ph: 'In Progress', pr: 'medium', pts: 5, ep: 0, d: 0, dur: 3 },
    { t: 'Implement pen/bezier path tool', ph: 'In Progress', pr: 'medium', pts: 8, ep: 0, d: -1, dur: 4 },
    { t: 'Conflict resolution for concurrent edits', ph: 'In Progress', pr: 'critical', pts: 13, ep: 3, d: -2, dur: 7 },
    { t: 'Build plugin API for third-party extensions', ph: 'In Progress', pr: 'high', pts: 13, ep: 4, d: -1, dur: 6 },
    // To Do (18)
    { t: 'AI style transfer tool', ph: 'To Do', pr: 'high', pts: 8, ep: 1, d: 4, dur: 5 },
    { t: 'AI object removal (content-aware fill)', ph: 'To Do', pr: 'high', pts: 13, ep: 1, d: 5, dur: 6 },
    { t: 'Version history with visual diff', ph: 'To Do', pr: 'medium', pts: 8, ep: 3, d: 6, dur: 4 },
    { t: 'Mobile touch gesture support', ph: 'To Do', pr: 'high', pts: 8, ep: 0, d: 7, dur: 5 },
    { t: 'Tablet pressure sensitivity (Wacom/Apple Pencil)', ph: 'To Do', pr: 'medium', pts: 5, ep: 0, d: 8, dur: 3 },
    { t: 'WebGL acceleration for large canvases', ph: 'To Do', pr: 'critical', pts: 13, ep: 0, d: 5, dur: 7 },
    { t: 'Asset library (icons, textures, patterns)', ph: 'To Do', pr: 'medium', pts: 5, ep: 0, d: 9, dur: 4 },
    { t: 'Custom workspace layouts', ph: 'To Do', pr: 'low', pts: 5, ep: 0, d: 10, dur: 3 },
    { t: 'Action recording/playback (macros)', ph: 'To Do', pr: 'medium', pts: 8, ep: 0, d: 11, dur: 5 },
    { t: 'Color management (ICC profiles)', ph: 'To Do', pr: 'medium', pts: 5, ep: 0, d: 7, dur: 3 },
    { t: 'Batch processing for multiple images', ph: 'To Do', pr: 'medium', pts: 8, ep: 2, d: 8, dur: 4 },
    { t: 'Integration with Unsplash/Pexels for stock photos', ph: 'To Do', pr: 'low', pts: 5, ep: 4, d: 12, dur: 3 },
    { t: 'HEIF/AVIF format support', ph: 'To Do', pr: 'low', pts: 3, ep: 2, d: 13, dur: 2 },
    { t: 'Implement perspective transform', ph: 'To Do', pr: 'medium', pts: 5, ep: 0, d: 9, dur: 3 },
    { t: 'TIFF export with layer preservation', ph: 'To Do', pr: 'low', pts: 5, ep: 2, d: 14, dur: 3 },
    { t: 'Animated GIF export', ph: 'To Do', pr: 'medium', pts: 8, ep: 2, d: 10, dur: 4 },
    { t: 'SSO integration (SAML/OIDC)', ph: 'To Do', pr: 'high', pts: 8, ep: 4, d: 6, dur: 4 },
    { t: 'Usage analytics dashboard', ph: 'To Do', pr: 'medium', pts: 5, ep: 4, d: 11, dur: 3 },
    // Backlog (25)
    { t: 'AI text-to-image generation', ph: 'Backlog', pr: 'high', pts: 13, ep: 1, d: 18, dur: 8 },
    { t: 'AI image inpainting', ph: 'Backlog', pr: 'high', pts: 13, ep: 1, d: 19, dur: 7 },
    { t: 'Video timeline for animated exports', ph: 'Backlog', pr: 'medium', pts: 13, ep: 0, d: 20, dur: 8 },
    { t: 'RAW file support (CR2, NEF, ARW)', ph: 'Backlog', pr: 'medium', pts: 8, ep: 2, d: 22, dur: 5 },
    { t: 'HDR merge from multiple exposures', ph: 'Backlog', pr: 'low', pts: 8, ep: 0, d: 24, dur: 5 },
    { t: 'Panorama stitching', ph: 'Backlog', pr: 'low', pts: 8, ep: 0, d: 25, dur: 5 },
    { t: 'Focus stacking', ph: 'Backlog', pr: 'low', pts: 5, ep: 0, d: 26, dur: 4 },
    { t: 'Pixel art mode (grid snap, limited palette)', ph: 'Backlog', pr: 'medium', pts: 5, ep: 0, d: 21, dur: 4 },
    { t: 'Symmetry painting mode', ph: 'Backlog', pr: 'low', pts: 3, ep: 0, d: 23, dur: 2 },
    { t: 'Color palette generator from image', ph: 'Backlog', pr: 'medium', pts: 5, ep: 1, d: 22, dur: 3 },
    { t: 'Non-destructive adjustment layers', ph: 'Backlog', pr: 'high', pts: 13, ep: 0, d: 20, dur: 7 },
    { t: 'Brush engine customization', ph: 'Backlog', pr: 'medium', pts: 8, ep: 0, d: 24, dur: 5 },
    { t: 'Clipping masks', ph: 'Backlog', pr: 'medium', pts: 5, ep: 0, d: 25, dur: 3 },
    { t: 'Photoshop PSD import', ph: 'Backlog', pr: 'high', pts: 13, ep: 2, d: 21, dur: 7 },
    { t: 'Figma file import', ph: 'Backlog', pr: 'medium', pts: 8, ep: 2, d: 23, dur: 5 },
    { t: 'Sketch file import', ph: 'Backlog', pr: 'low', pts: 5, ep: 2, d: 26, dur: 4 },
    { t: 'Offline mode with service worker', ph: 'Backlog', pr: 'medium', pts: 8, ep: 4, d: 22, dur: 5 },
    { t: 'E2E encryption for shared projects', ph: 'Backlog', pr: 'high', pts: 13, ep: 4, d: 24, dur: 7 },
    { t: 'Accessibility audit (WCAG AA)', ph: 'Backlog', pr: 'high', pts: 8, ep: 0, d: 25, dur: 5 },
    { t: 'Localization (i18n) framework', ph: 'Backlog', pr: 'medium', pts: 5, ep: 4, d: 26, dur: 3 },
    { t: 'White-labeling for enterprise', ph: 'Backlog', pr: 'medium', pts: 8, ep: 4, d: 27, dur: 5 },
    { t: 'Watermark tool for exports', ph: 'Backlog', pr: 'low', pts: 3, ep: 0, d: 28, dur: 2 },
    { t: 'Time-lapse recording of editing session', ph: 'Backlog', pr: 'low', pts: 5, ep: 0, d: 27, dur: 4 },
    { t: 'Collaborative comments and annotations', ph: 'Backlog', pr: 'medium', pts: 5, ep: 3, d: 23, dur: 3 },
    { t: 'Embed editor widget for third-party sites', ph: 'Backlog', pr: 'medium', pts: 8, ep: 4, d: 28, dur: 5 },
  ];

  let taskCount = 0;
  const taskIds = [];
  for (let i = 0; i < taskDefs.length; i++) {
    const t = taskDefs[i];
    const startDate = new Date(today); startDate.setDate(startDate.getDate() - (t.d ?? 0));
    const dueDate = new Date(startDate); dueDate.setDate(dueDate.getDate() + (t.dur ?? 3));
    const args = {
      project_id: PROJECT_ID, title: t.t, phase_id: phaseMap[t.ph],
      priority: t.pr, story_points: t.pts,
    };
    if (engineerIds.length > 0) args.assignee_id = engineerIds[i % engineerIds.length];
    if (t.ph === 'Done' || t.ph === 'Review' || t.ph === 'In Progress') {
      if (s1.data?.id) args.sprint_id = s1.data.id;
    } else if (t.ph === 'To Do') {
      if (s2.data?.id) args.sprint_id = s2.data.id;
    }

    const res = await tool('create_task', args);
    if (res.result) {
      taskCount++;
      let taskId = null;
      try {
        const td = JSON.parse(res.result.content[0].text);
        taskId = td.data?.id;
      } catch { /* skip parse errors */ }
      if (taskId) {
        taskIds.push({ id: taskId, humanId: td.data?.human_id, title: t.t });
        await tool('update_task', {
          task_id: taskId,
          start_date: startDate.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          ...(t.ep !== undefined && epicIds[t.ep] ? { epic_id: epicIds[t.ep] } : {}),
        });
      }
      if (taskCount % 20 === 0) console.log('  ' + taskCount + '/' + taskDefs.length);
    }
  }
  console.log('Created ' + taskCount + ' tasks');

  // Add comments to some tasks
  console.log('\n=== Adding task comments ===');
  const commentPairs = [
    ['Looks good! Just a few minor style issues in the zoom controls.', 'Fixed the padding — ready for re-review.'],
    ['The brush pressure curve feels a bit off. Can we adjust the bezier?', 'Updated to use a quadratic curve. Much more natural now.'],
    ['Performance is solid on Chrome but I\'m seeing jank on Safari.', 'Found the issue — was using a deprecated canvas API. Fixed.'],
    ['Need to add error handling for corrupted .mage files.', 'Added try/catch with user-friendly error toast. Also added auto-recovery.'],
    ['The AI background removal is impressive but struggles with hair detail.', 'Switched to the refined edge model. Hair detection is much better now.'],
    ['WebSocket reconnection logic needs work — getting drops on flaky connections.', 'Implemented exponential backoff with jitter. Also added offline indicator.'],
    ['Export quality for JPEG at 80% looks artifacty on gradients.', 'Bumped default to 85% and added progressive JPEG option.'],
    ['Layer masks aren\'t respecting the canvas boundary on paste.', 'Clipped to canvas rect on paste. Added test case.'],
  ];
  for (let i = 0; i < Math.min(commentPairs.length, taskIds.length); i++) {
    const task = taskIds[i + 5]; // offset to hit interesting tasks
    if (task) {
      await tool('update_task', { task_id: task.id });
      // Post via BBB API directly since MCP doesn't have comment tools for BBB tasks
      const session = fs.readFileSync(COOKIE_PATH, 'utf8').match(/session\t([^\n\r]+)/)?.[1];
      if (session) {
        await new Promise((resolve, reject) => {
          const body = JSON.stringify({ body: commentPairs[i][0] });
          const req = http.request({
            hostname: 'localhost', port: 80, path: `/b3/api/tasks/${task.id}/comments`, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': 'session=' + session },
          }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
          req.on('error', reject); req.end(body);
        });
        await new Promise((resolve, reject) => {
          const body = JSON.stringify({ body: commentPairs[i][1] });
          const req = http.request({
            hostname: 'localhost', port: 80, path: `/b3/api/tasks/${task.id}/comments`, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': 'session=' + session },
          }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
          req.on('error', reject); req.end(body);
        });
      }
    }
  }
  console.log('Added comments to ' + commentPairs.length + ' tasks');

  // Configure helpdesk
  console.log('\n=== Configuring helpdesk ===');
  const session = fs.readFileSync(COOKIE_PATH, 'utf8').match(/session\t([^\n\r]+)/)?.[1];
  const sessionCookie = 'session=' + session;
  await new Promise((resolve, reject) => {
    const body = JSON.stringify({
      default_project_id: PROJECT_ID, default_phase_id: phaseMap['Backlog'],
      categories: ['Bug Report', 'Feature Request', 'Account Issue', 'Export Problem', 'Performance', 'AI Tool Issue', 'Other'],
    });
    const req = http.request({
      hostname: 'localhost', port: 80, path: '/helpdesk-api/helpdesk/settings', method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { console.log('Helpdesk configured'); resolve(); }); });
    req.on('error', reject); req.end(body);
  });

  // Create 15 helpdesk customers
  console.log('\n=== Creating 15 customers ===');
  const customers = [
    'Emma Thompson', 'Liam O\'Brien', 'Sofia Garcia', 'Noah Williams', 'Isabella Davis',
    'Mason Brown', 'Ava Martinez', 'Ethan Jones', 'Mia Taylor', 'Lucas Anderson',
    'Charlotte Wilson', 'Oliver Thomas', 'Amelia Jackson', 'Benjamin White', 'Harper Lee',
  ];
  const customerCookies = [];
  for (const name of customers) {
    const email = name.toLowerCase().replace(/[' ]/g, '.').replace('..', '.') + '@customers.mage.io';
    const reg = await helpdeskCall('POST', '/auth/register', { email, password: 'customer12345678', display_name: name });
    const login = await helpdeskCall('POST', '/auth/login', { email, password: 'customer12345678' });
    customerCookies.push({ name, email, cookie: login.cookie || reg.cookie });
    console.log('  + ' + name);
  }

  // Each customer creates ~12 tickets with conversations
  console.log('\n=== Creating tickets + conversations ===');
  const ticketTemplates = [
    { s: 'Canvas freezes when adding 10+ layers', d: 'The editor becomes unresponsive when I add more than 10 layers to a project.\n\n**Steps:**\n1. Create new project\n2. Add 10+ layers\n3. Try to draw on any layer\n\nBrowser: Chrome 122, macOS', cat: 'Bug Report', pr: 'high',
      conv: ['We\'re investigating. Can you share your system RAM?', '16GB M2 MacBook Pro. It works fine with 8 layers.', 'Found it — memory leak in layer thumbnail generation. Fix coming in Sprint 15.', 'Thanks! Looking forward to it.'] },
    { s: 'Export to SVG loses gradient fills', d: 'When I export artwork with gradients to SVG, all gradients become solid colors.\n\nExpected: gradients preserved\nActual: flat colors', cat: 'Export Problem', pr: 'medium',
      conv: ['Can you attach a sample .mage file?', 'Here\'s a simple test case with a radial gradient.', 'Confirmed — SVG linearGradient/radialGradient export not implemented yet. Added to Sprint 15.'] },
    { s: 'AI background removal leaves artifacts on hair', d: 'The AI background removal tool leaves visible white fringe around hair in portraits.', cat: 'AI Tool Issue', pr: 'medium',
      conv: ['We\'re working on an improved edge refinement model. Can you try the latest beta?', 'Tried it — much better but still some fringing on blonde hair against dark backgrounds.'] },
    { s: 'Can\'t login with Google account', d: 'I get an "OAuth error" when trying to log in with my Google account.\n\nError: `invalid_client`\nBrowser: Firefox 123', cat: 'Account Issue', pr: 'high',
      conv: ['This is a known issue with Firefox. Can you try Chrome as a workaround?', 'Chrome works fine. Will Firefox be fixed?', 'Yes — we\'re updating the OAuth callback handler. Fix in next deploy.'] },
    { s: 'Feature request: Color palette extraction', d: 'Would love a tool that extracts the dominant colors from an imported image and creates a palette.\n\nUse case: matching brand colors from client photos.', cat: 'Feature Request', pr: 'low',
      conv: ['Great idea! This is on our roadmap for the AI Tools epic.', 'Awesome! Any ETA?', 'Tentatively Sprint 17. We\'ll keep you posted.'] },
    { s: 'Undo doesn\'t work after using eraser', d: 'After using the eraser tool, Ctrl+Z doesn\'t undo the eraser strokes. It jumps back to before I started erasing.', cat: 'Bug Report', pr: 'high',
      conv: ['We can reproduce this. The eraser is batching strokes incorrectly in the undo stack.', 'Any timeline for a fix?', 'It\'s in the current sprint. Should be fixed this week.', 'Fixed in v2.14.3 — please update and confirm.', 'Confirmed working. Thank you!'] },
    { s: 'Performance degrades with large images (8000x8000)', d: 'Editing a 8000x8000px image is very sluggish. Brush strokes take 200-300ms to render.', cat: 'Performance', pr: 'medium',
      conv: ['We\'re working on WebGL acceleration for large canvases. In the meantime, try reducing the brush size.', 'Thanks, smaller brush helps a bit. Looking forward to the WebGL update.'] },
    { s: 'Request: Photoshop PSD import', d: 'Many of our team members have existing PSD files. Would be great to import them with layers preserved.', cat: 'Feature Request', pr: 'medium',
      conv: ['PSD import is planned! It\'s a complex format but we\'re committed to it.', 'Will it support adjustment layers?', 'Layer structure and basic adjustments yes, some Photoshop-specific effects may need manual recreation.'] },
    { s: 'JPEG export quality inconsistent', d: 'Exporting the same image at 90% quality gives different file sizes each time. Sometimes 2MB, sometimes 3.5MB.', cat: 'Export Problem', pr: 'low',
      conv: ['This might be related to progressive vs baseline encoding. Which setting are you using?', 'I didn\'t know there was a setting — where do I find it?', 'Export > Advanced > Encoding. Try "Baseline" for consistent sizes.', 'That fixed it! Maybe default to Baseline?'] },
    { s: 'Mobile browser: Can\'t use two-finger zoom', d: 'On iPad Safari, two-finger zoom zooms the whole page instead of the canvas.', cat: 'Mobile', pr: 'medium',
      conv: ['Known limitation. We need to add touch-action: none to the canvas element.', 'When will mobile support be properly done?', 'Full mobile support is Sprint 16. iPad will be our primary target.'] },
    { s: 'Text tool: Can\'t change font after placing text', d: 'Once I place text on the canvas, I can\'t change the font. I have to delete and recreate.', cat: 'Bug Report', pr: 'medium',
      conv: ['This is a known issue. Double-click the text to enter edit mode, then change the font in the properties panel.', 'Double-clicking doesn\'t open properties for me.', 'Sorry — that feature is in progress. For now, right-click > Text Properties as a workaround.'] },
    { s: 'AI upscaling produces blocky artifacts on text', d: 'When I upscale an image 4x, the AI does great on photos but text becomes blocky and unreadable.', cat: 'AI Tool Issue', pr: 'medium',
      conv: ['AI upscaling is optimized for photographic content. For text, try the "Sharpen Text" preset.', 'That helps a bit but still not great. Especially on small text.', 'We\'re training a text-aware model. Should be available in 2-3 weeks.'] },
  ];

  let totalTickets = 0;
  for (let ci = 0; ci < customerCookies.length; ci++) {
    const cust = customerCookies[ci];
    const numTickets = ci < 5 ? 12 : ci < 10 ? 12 : 12; // 12 each = 180 total
    for (let ti = 0; ti < numTickets; ti++) {
      const tmpl = ticketTemplates[(ci * 12 + ti) % ticketTemplates.length];
      const suffix = ci > 0 || ti >= ticketTemplates.length ? ` (${cust.name.split(' ')[0]}${ti > 0 ? ' #' + (ti + 1) : ''})` : '';
      const ticketRes = await helpdeskCall('POST', '/tickets', {
        subject: tmpl.s + suffix,
        description: tmpl.d,
        category: tmpl.cat,
        priority: tmpl.pr,
      }, cust.cookie);

      if (ticketRes.data?.data?.id) {
        const tid = ticketRes.data.data.id;
        totalTickets++;
        // Add conversation
        if (tmpl.conv) {
          for (let mi = 0; mi < tmpl.conv.length; mi++) {
            if (mi % 2 === 0) {
              // Agent reply
              await agentReply(tid, tmpl.conv[mi], sessionCookie);
            } else {
              // Customer reply
              await helpdeskCall('POST', `/tickets/${tid}/messages`, { body: tmpl.conv[mi] }, cust.cookie);
            }
          }
        }
      }
      if (totalTickets % 30 === 0) console.log('  ' + totalTickets + ' tickets created...');
    }
  }
  console.log('Total tickets: ' + totalTickets);

  console.log('\n=== Summary ===');
  console.log('  Project: Mage (MAGE-)');
  console.log('  Engineers: ' + engineerIds.length);
  console.log('  Sprints: 3 (Sprint 14 active)');
  console.log('  Epics: ' + epicIds.length);
  console.log('  Tasks: ' + taskCount);
  console.log('  Customers: ' + customerCookies.length);
  console.log('  Tickets: ' + totalTickets);
  console.log('  Comments on tasks: ' + commentPairs.length * 2);
  console.log('\nDone!');
})().catch(e => console.error('FATAL:', e));
