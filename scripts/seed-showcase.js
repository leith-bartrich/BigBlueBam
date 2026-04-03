const http = require('http');
const fs = require('fs');

const API_KEY = process.argv[2] || 'pxZMS8FeyeAHwvNZFxvh0XdJh1o1_6FKnSndKrlQd8I';
const PROJECT_ID = process.argv[3] || 'd1b08328-3850-4e1f-b643-314964a6298c';
const COOKIE_PATH = process.argv[4] || 'C:/Users/eoffe/AppData/Local/Temp/admin.jar';

let SESSION_ID = '';
let reqId = 0;

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
        resolve(match ? JSON.parse(match[1]) : { raw: data.slice(0, 200) });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}
function tool(name, args) { return mcpCall('tools/call', { name, arguments: args }); }

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const cookies = fs.readFileSync(COOKIE_PATH, 'utf8');
    const sessionMatch = cookies.match(/session\t([^\n\r]+)/);
    const cookieHeader = sessionMatch ? 'session=' + sessionMatch[1] : '';
    const opts = {
      hostname: 'localhost', port: 4000, path, method,
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    if (body) req.end(JSON.stringify(body));
    else req.end();
  });
}

function helpdeskCall(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 8080, path, method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { 'Cookie': cookie } : {}) },
    };
    const req = http.request(opts, res => {
      let d = ''; const setCookie = res.headers['set-cookie']?.[0]?.split(';')[0];
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ data: JSON.parse(d), cookie: setCookie }); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    if (body) req.end(JSON.stringify(body));
    else req.end();
  });
}

(async () => {
  // Init MCP
  await mcpCall('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'seed', version: '1.0' } });
  console.log('MCP session:', SESSION_ID);

  // Get phases
  const phasesRes = await apiCall('GET', `/projects/${PROJECT_ID}/phases`);
  const phases = phasesRes.data;
  const phaseMap = {};
  phases.forEach(p => { phaseMap[p.name] = p.id; });
  console.log('Phases:', Object.keys(phaseMap).join(', '));

  // Create 12 team members
  console.log('\nCreating team members...');
  const members = [
    { email: 'sarah.chen@bigblueceiling.com', display_name: 'Sarah Chen', role: 'admin' },
    { email: 'marcus.johnson@bigblueceiling.com', display_name: 'Marcus Johnson', role: 'member' },
    { email: 'priya.patel@bigblueceiling.com', display_name: 'Priya Patel', role: 'member' },
    { email: 'alex.rivera@bigblueceiling.com', display_name: 'Alex Rivera', role: 'member' },
    { email: 'emma.watson@bigblueceiling.com', display_name: 'Emma Watson', role: 'member' },
    { email: 'james.kim@bigblueceiling.com', display_name: 'James Kim', role: 'member' },
    { email: 'olivia.brown@bigblueceiling.com', display_name: 'Olivia Brown', role: 'member' },
    { email: 'liam.garcia@bigblueceiling.com', display_name: 'Liam Garcia', role: 'member' },
    { email: 'sophia.taylor@bigblueceiling.com', display_name: 'Sophia Taylor', role: 'member' },
    { email: 'noah.martinez@bigblueceiling.com', display_name: 'Noah Martinez', role: 'member' },
    { email: 'ava.wilson@bigblueceiling.com', display_name: 'Ava Wilson', role: 'member' },
    { email: 'ethan.lee@bigblueceiling.com', display_name: 'Ethan Lee', role: 'member' },
  ];
  const userIds = [];
  for (const m of members) {
    const res = await apiCall('POST', '/org/members/invite', m);
    if (res.data?.id) {
      userIds.push(res.data.id);
      await apiCall('POST', `/projects/${PROJECT_ID}/members`, { user_id: res.data.id, role: m.role === 'admin' ? 'admin' : 'member' });
      console.log('  + ' + m.display_name);
    }
  }

  // Create epics
  console.log('\nCreating epics...');
  const epicDefs = [
    { name: 'Authentication & Onboarding', color: '#3B82F6', description: 'User auth, signup flow, profile setup' },
    { name: 'Social Graph', color: '#8B5CF6', description: 'Friend system, connections, discovery' },
    { name: 'Messaging', color: '#EC4899', description: 'Real-time chat, groups, media sharing' },
    { name: 'Content Feed', color: '#F59E0B', description: 'Posts, stories, reactions, comments' },
    { name: 'Infrastructure', color: '#10B981', description: 'DevOps, CI/CD, monitoring, scaling' },
  ];
  const epicIds = [];
  for (const e of epicDefs) {
    const res = await apiCall('POST', `/projects/${PROJECT_ID}/epics`, e);
    if (res.data?.id) { epicIds.push(res.data.id); console.log('  + ' + e.name); }
  }

  // Create labels
  console.log('\nCreating labels...');
  const labelDefs = [
    { name: 'Bug', color: '#EF4444' }, { name: 'Feature', color: '#3B82F6' },
    { name: 'Enhancement', color: '#8B5CF6' }, { name: 'Tech Debt', color: '#F59E0B' },
    { name: 'UX', color: '#EC4899' }, { name: 'Security', color: '#EF4444' },
    { name: 'Performance', color: '#10B981' }, { name: 'Mobile', color: '#6366F1' },
  ];
  const labelIds = [];
  for (const l of labelDefs) {
    const res = await apiCall('POST', `/projects/${PROJECT_ID}/labels`, { ...l, position: labelIds.length });
    if (res.data?.id) { labelIds.push(res.data.id); }
  }
  console.log('  Created ' + labelIds.length + ' labels');

  // Create 2 sprints
  console.log('\nCreating sprints...');
  const sprint1 = await apiCall('POST', `/projects/${PROJECT_ID}/sprints`, {
    name: 'Sprint 7', goal: 'Ship authentication and onboarding', start_date: '2026-03-23', end_date: '2026-04-04',
  });
  const sprint2 = await apiCall('POST', `/projects/${PROJECT_ID}/sprints`, {
    name: 'Sprint 8', goal: 'Social features and messaging MVP', start_date: '2026-04-07', end_date: '2026-04-18',
  });
  console.log('  Sprint 7:', sprint1.data?.id);
  console.log('  Sprint 8:', sprint2.data?.id);

  // Start Sprint 7
  if (sprint1.data?.id) {
    await apiCall('POST', `/sprints/${sprint1.data.id}/start`);
    console.log('  Sprint 7 started');
  }

  // Create 80 tasks via MCP
  console.log('\nCreating tasks...');
  const today = new Date('2026-04-03');
  const tasks = [
    // Done (Sprint 7 - completed work) - 15 tasks
    { title: 'Design login screen UI', phase: 'Done', priority: 'high', points: 5, epic: 0, label: 1, daysAgo: 10, duration: 3, sprint: sprint1.data?.id },
    { title: 'Implement email/password auth', phase: 'Done', priority: 'critical', points: 8, epic: 0, label: 1, daysAgo: 9, duration: 4, sprint: sprint1.data?.id },
    { title: 'Add Google OAuth integration', phase: 'Done', priority: 'high', points: 5, epic: 0, label: 1, daysAgo: 8, duration: 3, sprint: sprint1.data?.id },
    { title: 'Build onboarding flow screens', phase: 'Done', priority: 'medium', points: 8, epic: 0, label: 4, daysAgo: 7, duration: 4, sprint: sprint1.data?.id },
    { title: 'Create profile setup wizard', phase: 'Done', priority: 'medium', points: 5, epic: 0, label: 4, daysAgo: 6, duration: 3, sprint: sprint1.data?.id },
    { title: 'Implement password reset flow', phase: 'Done', priority: 'high', points: 3, epic: 0, label: 5, daysAgo: 5, duration: 2, sprint: sprint1.data?.id },
    { title: 'Set up CI/CD pipeline', phase: 'Done', priority: 'critical', points: 8, epic: 4, label: 3, daysAgo: 12, duration: 3 },
    { title: 'Configure PostgreSQL replication', phase: 'Done', priority: 'high', points: 5, epic: 4, label: 6, daysAgo: 11, duration: 3 },
    { title: 'Set up Sentry error tracking', phase: 'Done', priority: 'medium', points: 3, epic: 4, label: 3, daysAgo: 10, duration: 2 },
    { title: 'Design system color tokens', phase: 'Done', priority: 'medium', points: 3, epic: 0, label: 4, daysAgo: 14, duration: 2 },
    { title: 'Implement session management', phase: 'Done', priority: 'high', points: 5, epic: 0, label: 5, daysAgo: 8, duration: 3, sprint: sprint1.data?.id },
    { title: 'Add biometric login (Face ID)', phase: 'Done', priority: 'medium', points: 5, epic: 0, label: 7, daysAgo: 4, duration: 3, sprint: sprint1.data?.id },
    { title: 'Build splash screen animation', phase: 'Done', priority: 'low', points: 2, epic: 0, label: 4, daysAgo: 13, duration: 1 },
    { title: 'API rate limiting middleware', phase: 'Done', priority: 'high', points: 3, epic: 4, label: 5, daysAgo: 9, duration: 2 },
    { title: 'Database migration framework', phase: 'Done', priority: 'high', points: 5, epic: 4, label: 3, daysAgo: 13, duration: 2 },

    // Review - 8 tasks
    { title: 'Add Apple Sign-In support', phase: 'Review', priority: 'high', points: 5, epic: 0, label: 7, daysAgo: 3, duration: 4, sprint: sprint1.data?.id },
    { title: 'Phone number verification', phase: 'Review', priority: 'medium', points: 3, epic: 0, label: 1, daysAgo: 2, duration: 3, sprint: sprint1.data?.id },
    { title: 'Build friend request system', phase: 'Review', priority: 'critical', points: 8, epic: 1, label: 1, daysAgo: 2, duration: 5 },
    { title: 'Implement friend search', phase: 'Review', priority: 'high', points: 5, epic: 1, label: 1, daysAgo: 1, duration: 3 },
    { title: 'CDN configuration for media', phase: 'Review', priority: 'medium', points: 3, epic: 4, label: 6, daysAgo: 3, duration: 2 },
    { title: '2FA TOTP setup flow', phase: 'Review', priority: 'high', points: 5, epic: 0, label: 5, daysAgo: 1, duration: 3, sprint: sprint1.data?.id },
    { title: 'Account deletion GDPR flow', phase: 'Review', priority: 'medium', points: 5, epic: 0, label: 5, daysAgo: 2, duration: 3 },
    { title: 'Load testing framework setup', phase: 'Review', priority: 'medium', points: 3, epic: 4, label: 6, daysAgo: 1, duration: 2 },

    // In Progress - 12 tasks
    { title: 'Design friend list UI', phase: 'In Progress', priority: 'high', points: 5, epic: 1, label: 4, daysAgo: 0, duration: 4 },
    { title: 'Friend suggestions algorithm', phase: 'In Progress', priority: 'medium', points: 8, epic: 1, label: 1, daysAgo: -1, duration: 5 },
    { title: 'Design chat UI layout', phase: 'In Progress', priority: 'critical', points: 8, epic: 2, label: 4, daysAgo: 0, duration: 5 },
    { title: 'Real-time messaging WebSocket', phase: 'In Progress', priority: 'critical', points: 13, epic: 2, label: 1, daysAgo: -1, duration: 7 },
    { title: 'Mutual friends feature', phase: 'In Progress', priority: 'medium', points: 5, epic: 1, label: 1, daysAgo: -2, duration: 4 },
    { title: 'Group chat data model', phase: 'In Progress', priority: 'high', points: 5, epic: 2, label: 1, daysAgo: -1, duration: 4 },
    { title: 'Message encryption layer', phase: 'In Progress', priority: 'high', points: 8, epic: 2, label: 5, daysAgo: -2, duration: 5 },
    { title: 'Design main feed layout', phase: 'In Progress', priority: 'high', points: 5, epic: 3, label: 4, daysAgo: 0, duration: 4 },
    { title: 'Friend online status tracking', phase: 'In Progress', priority: 'medium', points: 3, epic: 1, label: 1, daysAgo: -1, duration: 3 },
    { title: 'Kubernetes cluster config', phase: 'In Progress', priority: 'high', points: 8, epic: 4, label: 3, daysAgo: -2, duration: 5 },
    { title: 'OpenTelemetry instrumentation', phase: 'In Progress', priority: 'medium', points: 5, epic: 4, label: 6, daysAgo: -1, duration: 3 },
    { title: 'Profile photo upload + crop', phase: 'In Progress', priority: 'medium', points: 5, epic: 0, label: 4, daysAgo: 0, duration: 3 },

    // To Do (Sprint 8) - 15 tasks
    { title: 'Block/unblock functionality', phase: 'To Do', priority: 'medium', points: 3, epic: 1, label: 1, daysAgo: -4, duration: 3, sprint: sprint2.data?.id },
    { title: 'Friend activity feed', phase: 'To Do', priority: 'high', points: 8, epic: 1, label: 1, daysAgo: -5, duration: 5, sprint: sprint2.data?.id },
    { title: 'Message reactions (emoji)', phase: 'To Do', priority: 'medium', points: 3, epic: 2, label: 2, daysAgo: -6, duration: 3, sprint: sprint2.data?.id },
    { title: 'Message search functionality', phase: 'To Do', priority: 'medium', points: 5, epic: 2, label: 1, daysAgo: -7, duration: 4, sprint: sprint2.data?.id },
    { title: 'File sharing in chat', phase: 'To Do', priority: 'high', points: 5, epic: 2, label: 1, daysAgo: -5, duration: 4, sprint: sprint2.data?.id },
    { title: 'Typing indicators', phase: 'To Do', priority: 'low', points: 2, epic: 2, label: 2, daysAgo: -8, duration: 2, sprint: sprint2.data?.id },
    { title: 'Read receipts', phase: 'To Do', priority: 'medium', points: 3, epic: 2, label: 1, daysAgo: -6, duration: 3, sprint: sprint2.data?.id },
    { title: 'Voice message support', phase: 'To Do', priority: 'medium', points: 5, epic: 2, label: 7, daysAgo: -9, duration: 4, sprint: sprint2.data?.id },
    { title: 'Infinite scroll feed', phase: 'To Do', priority: 'high', points: 5, epic: 3, label: 6, daysAgo: -5, duration: 4, sprint: sprint2.data?.id },
    { title: 'Post creation with rich text', phase: 'To Do', priority: 'high', points: 8, epic: 3, label: 1, daysAgo: -6, duration: 5, sprint: sprint2.data?.id },
    { title: 'Photo/video upload to posts', phase: 'To Do', priority: 'high', points: 8, epic: 3, label: 7, daysAgo: -7, duration: 5, sprint: sprint2.data?.id },
    { title: 'Like and reaction system', phase: 'To Do', priority: 'medium', points: 5, epic: 3, label: 1, daysAgo: -8, duration: 4, sprint: sprint2.data?.id },
    { title: 'Prometheus metrics endpoint', phase: 'To Do', priority: 'medium', points: 3, epic: 4, label: 3, daysAgo: -5, duration: 2, sprint: sprint2.data?.id },
    { title: 'Grafana dashboard templates', phase: 'To Do', priority: 'low', points: 3, epic: 4, label: 3, daysAgo: -9, duration: 2, sprint: sprint2.data?.id },
    { title: 'Feature flags system', phase: 'To Do', priority: 'medium', points: 5, epic: 4, label: 3, daysAgo: -6, duration: 3, sprint: sprint2.data?.id },

    // Backlog - 30 tasks
    { title: 'Story/status feature', phase: 'Backlog', priority: 'high', points: 13, epic: 3, label: 1, daysAgo: -14, duration: 7 },
    { title: 'Content moderation system', phase: 'Backlog', priority: 'critical', points: 13, epic: 3, label: 5, daysAgo: -15, duration: 8 },
    { title: 'Hashtag system', phase: 'Backlog', priority: 'medium', points: 5, epic: 3, label: 1, daysAgo: -14, duration: 4 },
    { title: 'Location tagging for posts', phase: 'Backlog', priority: 'low', points: 5, epic: 3, label: 7, daysAgo: -16, duration: 4 },
    { title: 'Trending topics algorithm', phase: 'Backlog', priority: 'medium', points: 8, epic: 3, label: 1, daysAgo: -15, duration: 5 },
    { title: 'Bookmarks/saves feature', phase: 'Backlog', priority: 'low', points: 3, epic: 3, label: 2, daysAgo: -17, duration: 3 },
    { title: 'Content recommendation engine', phase: 'Backlog', priority: 'high', points: 13, epic: 3, label: 1, daysAgo: -16, duration: 8 },
    { title: 'Push notification service', phase: 'Backlog', priority: 'high', points: 8, epic: 4, label: 1, daysAgo: -14, duration: 5 },
    { title: 'Email notification templates', phase: 'Backlog', priority: 'medium', points: 5, epic: 4, label: 3, daysAgo: -15, duration: 3 },
    { title: 'Comment threading system', phase: 'Backlog', priority: 'medium', points: 5, epic: 3, label: 1, daysAgo: -18, duration: 4 },
    { title: 'User reporting system', phase: 'Backlog', priority: 'high', points: 5, epic: 3, label: 5, daysAgo: -17, duration: 4 },
    { title: 'Friend import from contacts', phase: 'Backlog', priority: 'medium', points: 5, epic: 1, label: 7, daysAgo: -19, duration: 4 },
    { title: 'Friend recommendation engine', phase: 'Backlog', priority: 'medium', points: 8, epic: 1, label: 1, daysAgo: -18, duration: 5 },
    { title: 'Message threading support', phase: 'Backlog', priority: 'low', points: 5, epic: 2, label: 2, daysAgo: -20, duration: 4 },
    { title: 'Chat media gallery', phase: 'Backlog', priority: 'low', points: 5, epic: 2, label: 4, daysAgo: -19, duration: 4 },
    { title: 'Chat customization (themes)', phase: 'Backlog', priority: 'low', points: 3, epic: 2, label: 4, daysAgo: -21, duration: 3 },
    { title: 'Database sharding strategy', phase: 'Backlog', priority: 'high', points: 13, epic: 4, label: 6, daysAgo: -20, duration: 7 },
    { title: 'Automated backup system', phase: 'Backlog', priority: 'high', points: 5, epic: 4, label: 3, daysAgo: -22, duration: 3 },
    { title: 'Log aggregation with Loki', phase: 'Backlog', priority: 'medium', points: 5, epic: 4, label: 3, daysAgo: -21, duration: 3 },
    { title: 'Deployment rollback mechanism', phase: 'Backlog', priority: 'high', points: 5, epic: 4, label: 3, daysAgo: -23, duration: 3 },
    { title: 'Service mesh (Istio)', phase: 'Backlog', priority: 'medium', points: 8, epic: 4, label: 3, daysAgo: -22, duration: 5 },
    { title: 'API documentation portal', phase: 'Backlog', priority: 'medium', points: 5, epic: 4, label: 3, daysAgo: -24, duration: 3 },
    { title: 'Dark mode for mobile app', phase: 'Backlog', priority: 'medium', points: 5, epic: 0, label: 7, daysAgo: -25, duration: 4 },
    { title: 'Accessibility audit (WCAG)', phase: 'Backlog', priority: 'high', points: 8, epic: 0, label: 4, daysAgo: -23, duration: 5 },
    { title: 'Performance profiling sprint', phase: 'Backlog', priority: 'medium', points: 5, epic: 4, label: 6, daysAgo: -26, duration: 3 },
    { title: 'WebSocket connection pooling', phase: 'Backlog', priority: 'medium', points: 5, epic: 2, label: 6, daysAgo: -24, duration: 4 },
    { title: 'Friend tagging in posts', phase: 'Backlog', priority: 'medium', points: 3, epic: 1, label: 2, daysAgo: -27, duration: 3 },
    { title: 'Post sharing/repost feature', phase: 'Backlog', priority: 'medium', points: 5, epic: 3, label: 1, daysAgo: -25, duration: 4 },
    { title: 'Content discovery page', phase: 'Backlog', priority: 'high', points: 8, epic: 3, label: 4, daysAgo: -28, duration: 5 },
    { title: 'End-to-end encryption audit', phase: 'Backlog', priority: 'critical', points: 8, epic: 2, label: 5, daysAgo: -26, duration: 5 },
  ];

  let created = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (t.daysAgo ?? 0));
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (t.duration ?? 3));

    const args = {
      project_id: PROJECT_ID,
      title: t.title,
      phase_id: phaseMap[t.phase],
      priority: t.priority,
      story_points: t.points,
    };

    if (userIds.length > 0) args.assignee_id = userIds[i % userIds.length];

    const res = await tool('create_task', args);
    if (res.result) {
      created++;
      // Update dates and epic via API
      const taskData = JSON.parse(res.result.content[0].text);
      const taskId = taskData.data?.id;
      if (taskId) {
        const updates = {
          start_date: startDate.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
        };
        if (t.epic !== undefined && epicIds[t.epic]) updates.epic_id = epicIds[t.epic];
        if (t.sprint) updates.sprint_id = t.sprint;
        await tool('update_task', { task_id: taskId, ...updates });
      }
      if (created % 20 === 0) console.log('  ' + created + '/' + tasks.length);
    }
  }
  console.log('  Created ' + created + ' tasks');

  // Configure helpdesk
  console.log('\nConfiguring helpdesk...');
  const cookies = fs.readFileSync(COOKIE_PATH, 'utf8');
  const sessionMatch = cookies.match(/session\t([^\n\r]+)/);
  const sessionCookie = sessionMatch ? 'session=' + sessionMatch[1] : '';

  await new Promise((resolve, reject) => {
    const body = JSON.stringify({
      default_project_id: PROJECT_ID,
      default_phase_id: phaseMap['Backlog'],
      categories: ['Bug Report', 'Feature Request', 'Account Issue', 'Performance', 'Other'],
    });
    const req = http.request({
      hostname: 'localhost', port: 8080, path: '/helpdesk/settings', method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { console.log('  Settings saved'); resolve(); }); });
    req.on('error', reject);
    req.end(body);
  });

  // Create helpdesk customer and tickets
  console.log('\nCreating helpdesk tickets...');
  const custReg = await helpdeskCall('POST', '/helpdesk/auth/register', {
    email: 'jane.doe@example.com', password: 'customerpass123', display_name: 'Jane Doe',
  });
  const custCookie = custReg.cookie;
  console.log('  Customer registered');

  const ticketDefs = [
    { subject: 'App crashes when uploading large photos', description: 'When I try to upload a photo larger than 5MB, the app crashes with a white screen.\n\n**Steps to reproduce:**\n1. Open the app\n2. Go to profile\n3. Try to upload a 10MB photo\n\nThis is blocking me from updating my profile.', priority: 'high', category: 'Bug Report' },
    { subject: 'Cannot find the dark mode setting', description: 'I heard there is a dark mode option but I cannot find where to enable it.\n\nI looked in:\n- Profile settings\n- App settings\n- Display options\n\nIs this feature available yet?', priority: 'low', category: 'Feature Request' },
    { subject: 'Friend requests not showing notifications', description: 'I sent a friend request to my colleague but they never received a notification.\n\nWe tried:\n- Checking notification settings\n- Reinstalling the app\n- Using different devices\n\nThis seems to be a **critical** issue for user engagement.', priority: 'high', category: 'Bug Report' },
    { subject: 'Slow loading times on feed page', description: 'The main feed takes about 8-10 seconds to load, which is much slower than expected.\n\nI am on:\n- **Device:** iPhone 14 Pro\n- **OS:** iOS 17.2\n- **Connection:** WiFi 100Mbps\n\nOther apps load fine, so it seems to be server-side.', priority: 'medium', category: 'Performance' },
    { subject: 'Feature request: Message scheduling', description: 'It would be great to be able to schedule messages to be sent at a later time.\n\nUse case:\n- Schedule birthday wishes\n- Send messages across timezones\n- Queue up announcements\n\nThis is a feature I use in Slack and would love here!', priority: 'low', category: 'Feature Request' },
  ];

  for (const t of ticketDefs) {
    await helpdeskCall('POST', '/helpdesk/tickets', t, custCookie);
    console.log('  + Ticket: ' + t.subject.slice(0, 40) + '...');
  }

  // Add some messages to the first ticket
  const ticketsRes = await helpdeskCall('GET', '/helpdesk/tickets', null, custCookie);
  if (ticketsRes.data?.data?.[0]) {
    const tid = ticketsRes.data.data[0].id;
    await helpdeskCall('POST', `/helpdesk/tickets/${tid}/messages`, { body: 'Just wanted to follow up - this is still happening after the latest update.' }, custCookie);

    // Agent reply
    await new Promise((resolve, reject) => {
      const body = JSON.stringify({ body: 'Hi Jane! Thanks for reporting this. We have identified the issue and are working on a fix. Can you tell us which browser version you are using?', is_internal: false });
      const req = http.request({
        hostname: 'localhost', port: 8080, path: `/helpdesk-api/tickets/${tid}/messages`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
      }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { resolve(); }); });
      req.on('error', reject);
      req.end(body);
    });

    await helpdeskCall('POST', `/helpdesk/tickets/${tid}/messages`, { body: 'I am using Chrome 122.0 on macOS Sonoma 14.3. Let me know if you need any other details!' }, custCookie);
    console.log('  Added conversation to first ticket');
  }

  console.log('\nDone! Summary:');
  console.log('  ' + userIds.length + ' team members');
  console.log('  ' + epicIds.length + ' epics');
  console.log('  ' + labelIds.length + ' labels');
  console.log('  2 sprints (Sprint 7 active)');
  console.log('  ' + created + ' tasks');
  console.log('  5 helpdesk tickets');
})().catch(e => console.error('FATAL:', e));
