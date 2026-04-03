const http = require('http');

const API_KEY = '4xcS9jANVwFsQ4vJV41YOel8uB78U6NxO20TOOJrkL4';
const PROJECT_ID = '2507bf67-0868-4693-a779-a22229211635';
const PHASE_IDS = [
  'd297d7eb-c844-4d02-81d6-ac86c4af7944', // Backlog
  '8e5b3a1b-30d7-441d-9ee7-579d346688b0', // To Do
  '83871577-8b6a-4b57-9bb7-7df59d4575e4', // In Progress
  '6b246a7f-77d2-4332-b0b5-b6520627bf06', // Review
  '20218741-358a-4005-ae64-68406bfbccd3', // Done
];

let SESSION_ID = '';
let reqId = 0;

function mcpCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: ++reqId, method, params });
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/mcp', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
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

function toolCall(name, args) {
  return mcpCall('tools/call', { name, arguments: args });
}

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const cookies = fs.readFileSync('C:/Users/eoffe/AppData/Local/Temp/mcp_admin.jar', 'utf8');
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

(async () => {
  // Initialize MCP
  console.log('Initializing MCP session...');
  await mcpCall('initialize', {
    protocolVersion: '2025-03-26', capabilities: {},
    clientInfo: { name: 'claude-code-seed', version: '1.0' },
  });
  console.log('MCP Session:', SESSION_ID);

  // Create 10 users via org invite API
  console.log('\nCreating 10 users...');
  const users = [
    { email: 'sarah.chen@frndo.app', display_name: 'Sarah Chen', role: 'admin' },
    { email: 'marcus.johnson@frndo.app', display_name: 'Marcus Johnson', role: 'member' },
    { email: 'priya.patel@frndo.app', display_name: 'Priya Patel', role: 'member' },
    { email: 'alex.rivera@frndo.app', display_name: 'Alex Rivera', role: 'member' },
    { email: 'emma.watson@frndo.app', display_name: 'Emma Watson', role: 'member' },
    { email: 'james.kim@frndo.app', display_name: 'James Kim', role: 'member' },
    { email: 'olivia.brown@frndo.app', display_name: 'Olivia Brown', role: 'member' },
    { email: 'liam.garcia@frndo.app', display_name: 'Liam Garcia', role: 'member' },
    { email: 'sophia.taylor@frndo.app', display_name: 'Sophia Taylor', role: 'member' },
    { email: 'noah.martinez@frndo.app', display_name: 'Noah Martinez', role: 'member' },
  ];

  const userIds = [];
  for (const u of users) {
    const res = await apiCall('POST', '/org/members/invite', u);
    if (res.data && res.data.id) {
      userIds.push(res.data.id);
      await apiCall('POST', '/projects/' + PROJECT_ID + '/members', { user_id: res.data.id, role: 'member' });
      console.log('  + ' + u.display_name + ' (added to project)');
    } else {
      console.log('  ! Failed: ' + u.display_name + ' - ' + JSON.stringify(res).slice(0, 100));
    }
  }
  console.log('Users created: ' + userIds.length);

  // Create 75 tasks via MCP
  console.log('\nCreating 75 tasks via MCP...');
  const priorities = ['critical', 'high', 'medium', 'medium', 'low'];
  const tasks = [
    // Auth & Onboarding (15)
    'Design login screen UI', 'Implement email/password authentication', 'Add Google OAuth integration',
    'Add Apple Sign-In support', 'Build onboarding flow screens', 'Create profile setup wizard',
    'Implement password reset flow', 'Add phone number verification', 'Build two-factor auth setup',
    'Design splash screen animation', 'Implement remember me functionality', 'Add biometric login support',
    'Create account deletion flow', 'Build session management system', 'Design auth error states',
    // Social Features (15)
    'Build friend request system', 'Implement friend search functionality', 'Design friend list UI',
    'Add friend suggestions algorithm', 'Build mutual friends feature', 'Implement friend groups',
    'Create block/unblock functionality', 'Build friend activity feed', 'Design friend profile cards',
    'Implement friend online status', 'Add friend birthday notifications', 'Build friend import from contacts',
    'Create friend recommendation engine', 'Implement friend tagging in posts', 'Design friend interaction animations',
    // Messaging (15)
    'Design chat UI layout', 'Implement real-time messaging with WebSocket', 'Add group chat support',
    'Build message reactions feature', 'Implement message search', 'Add file sharing in chat',
    'Build typing indicators', 'Implement read receipts', 'Design message notification system',
    'Add voice message support', 'Build message threading', 'Implement chat media gallery',
    'Create chat customization options', 'Build message forwarding feature', 'Add end-to-end encryption',
    // Content & Feed (15)
    'Design main feed layout', 'Implement infinite scroll feed', 'Build post creation with rich text',
    'Add photo and video upload to posts', 'Implement like and reaction system', 'Build comment system',
    'Design story and status feature', 'Implement content moderation system', 'Build hashtag system',
    'Add location tagging to posts', 'Implement trending topics algorithm', 'Build bookmarks and saves feature',
    'Create content recommendation engine', 'Implement post sharing feature', 'Design content discovery page',
    // Infrastructure (15)
    'Set up CI/CD pipeline', 'Configure Kubernetes cluster', 'Implement API rate limiting',
    'Build health check dashboard', 'Set up error tracking with Sentry', 'Configure CDN for media assets',
    'Implement database sharding strategy', 'Build automated backup system', 'Set up load testing framework',
    'Configure log aggregation with Loki', 'Implement feature flags system', 'Build deployment rollback mechanism',
    'Set up staging environment', 'Create API documentation portal', 'Implement service mesh with Istio',
  ];

  let created = 0;
  for (let i = 0; i < tasks.length; i++) {
    // Distribute across phases: 20 Backlog, 15 To Do, 10 In Progress, 10 Review, 20 Done
    let phaseIdx;
    if (i < 20) phaseIdx = 0;      // Backlog
    else if (i < 35) phaseIdx = 1;  // To Do
    else if (i < 45) phaseIdx = 2;  // In Progress
    else if (i < 55) phaseIdx = 3;  // Review
    else phaseIdx = 4;              // Done

    const args = {
      project_id: PROJECT_ID,
      title: tasks[i],
      phase_id: PHASE_IDS[phaseIdx],
      priority: priorities[i % 5],
      story_points: [1, 2, 3, 5, 8, 13][i % 6],
    };

    // Assign to different users (round-robin)
    if (userIds.length > 0) {
      args.assignee_id = userIds[i % userIds.length];
    }

    const res = await toolCall('create_task', args);
    if (res.result) {
      created++;
      if (created % 10 === 0 || created === 1) console.log('  Created ' + created + '/75 tasks...');
    } else {
      console.log('  Error on task ' + (i + 1) + ': ' + JSON.stringify(res).slice(0, 150));
    }
  }

  console.log('\nTotal tasks created: ' + created);

  // Verify via MCP get_board
  console.log('\nVerifying board state via MCP...');
  const boardRes = await toolCall('get_board', { project_id: PROJECT_ID });
  if (boardRes.result && boardRes.result.content && boardRes.result.content[0]) {
    const board = JSON.parse(boardRes.result.content[0].text);
    if (board.data && board.data.phases) {
      console.log('\nFrndo Board Summary:');
      let total = 0;
      board.data.phases.forEach(p => {
        console.log('  ' + p.name.padEnd(15) + p.tasks.length + ' tasks');
        total += p.tasks.length;
      });
      console.log('  ' + ''.padEnd(15) + '-----');
      console.log('  ' + 'Total'.padEnd(15) + total + ' tasks');
    }
  }

  console.log('\nDone!');
})().catch(e => console.error('FATAL:', e));
