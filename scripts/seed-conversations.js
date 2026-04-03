const http = require('http');

function request(method, path, body, cookie) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost', port: 80, path, method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    };
    const req = http.request(opts, (res) => {
      const sc = res.headers['set-cookie']?.[0]?.split(';')[0];
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d), cookie: sc }); }
        catch { resolve({ status: res.statusCode, raw: d.slice(0, 100), cookie: sc }); }
      });
    });
    req.on('error', () => resolve({ status: 0 }));
    if (body) req.end(JSON.stringify(body)); else req.end();
  });
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Conversations: alternating customer (even index) and agent (odd index) messages
const conversations = [
  // Bug reports
  [
    'I\'m experiencing this issue consistently. It happens every time I try the steps I described.',
    'Thanks for the detailed report! We\'ve been able to reproduce this on our end. Our engineering team is looking into it now. I\'ll update you as soon as we have a fix.',
    'Any update on this? It\'s been a couple of days and it\'s still blocking my workflow.',
    'Good news — we\'ve identified the root cause and a fix is being tested now. It should be included in our next release, which we\'re targeting for this Friday.',
    'That\'s great to hear! I\'ll keep an eye out for the update.',
  ],
  [
    'This is really frustrating. I\'ve tried clearing my cache and restarting but the problem persists.',
    'I understand the frustration, and I\'m sorry for the inconvenience. Could you tell me which browser and OS version you\'re using? Also, are you seeing any error messages in the browser console (F12 → Console tab)?',
    'Chrome 122 on macOS Sonoma 14.3. I see this in the console: "WebGL context lost" followed by a bunch of red errors.',
    'That\'s very helpful! The WebGL context loss suggests a GPU memory issue. We\'re working on a fallback renderer for this exact scenario. In the meantime, try reducing the canvas size to under 4000x4000 — that should prevent the context loss.',
    'Reducing the canvas size does help. Thanks for the workaround. Please let me know when the fix is ready.',
    'Will do! We\'ve added you to the notification list for this fix. You\'ll get an email as soon as it ships.',
  ],
  [
    'I just upgraded to the Pro plan and this feature still isn\'t working for me.',
    'Let me check your account... I can see your upgrade went through successfully. The feature you\'re trying to use requires a page refresh after upgrading. Could you try a hard refresh (Ctrl+Shift+R)?',
    'That fixed it! Thank you. Maybe you should add a note about that somewhere?',
    'Great suggestion! I\'ve filed a task for our team to add an auto-refresh or at least a notification banner after plan upgrades. Thanks for the feedback!',
  ],
  [
    'When will this feature be available? I\'ve been waiting for it for months.',
    'I completely understand your eagerness for this feature! It\'s currently in our Sprint 15 roadmap, which means active development starts next week. We\'re targeting a beta release within 2-3 weeks.',
    'That\'s sooner than I expected! Will it support the use case I described in my ticket?',
    'Yes — your use case is exactly what we\'re designing for. We might actually reach out to you for beta testing if you\'re interested?',
    'Absolutely! I\'d love to be a beta tester. Sign me up.',
    'Perfect! I\'ve added you to our beta tester list. You\'ll receive an invite email when the feature hits beta. Thanks for your enthusiasm!',
  ],
  [
    'I think I found a security issue. The shared project links don\'t seem to expire.',
    'Thank you for bringing this to our attention — security reports are a top priority for us. Can you describe exactly how you\'re generating and testing these links?',
    'I created a shared link, then set it to expire in 1 hour. After 2 hours, the link still works.',
    'We\'ve confirmed this is a bug in our link expiration scheduler. We\'re deploying a hotfix today. The issue only affects links created in the last 48 hours — all older links are expiring correctly.',
    'Fast response! Thank you for taking this seriously.',
    'Of course. Security is our top priority. The hotfix is now deployed and we\'ve invalidated all affected links. Please verify on your end and let us know.',
    'Confirmed — the link now correctly returns a 403 after expiry. Thanks!',
  ],
  [
    'The export is generating files that are way too large. A simple logo export shouldn\'t be 15MB.',
    'That does sound larger than expected. What format are you exporting to, and what are your export settings?',
    'PNG at the default settings. The canvas is 1000x1000.',
    'I see the issue — we recently changed the default PNG export to include the full alpha channel even when the image doesn\'t use transparency. We\'re reverting this to the smarter behavior in the next patch. For now, you can check "Optimize file size" in the export dialog.',
    'The optimize option brought it down to 200KB. Much better! Thanks.',
  ],
  [
    'Is there a way to use Mage collaboratively with my team? We need to edit the same file.',
    'Great question! Real-time collaboration is one of our most exciting features in development. It\'s currently in the "In Progress" phase and we expect to release it as a beta in Sprint 16.',
    'That sounds amazing. How many simultaneous editors will it support?',
    'Our initial target is up to 10 simultaneous editors with real-time cursor sharing and live updates. We\'re using a CRDT-based sync engine so edits never conflict.',
    'Will we be able to see who\'s working on what layer?',
    'Yes! Each collaborator will have a colored cursor and you\'ll see their name and which layer they\'re editing in the layers panel. We\'re also adding a "follow" mode where you can watch another user\'s viewport.',
  ],
  [
    'The AI background removal isn\'t working on my photo. It just returns the original image.',
    'I\'m sorry to hear that. Could you describe the photo? The AI model works best with clear foreground/background separation.',
    'It\'s a product photo on a white background. Pretty standard stuff.',
    'Ah, the issue might be that the model is detecting the white background as the foreground. We\'re aware of this edge case with very light backgrounds. Try using the "Manual mask" option to give the AI a hint about what to keep.',
    'The manual mask worked. But ideally it should handle white backgrounds automatically.',
    'Agreed. We\'re retraining the model with more white-background examples. This should be resolved in our next model update, expected in about 2 weeks.',
  ],
];

(async () => {
  console.log('=== Seeding Ticket Conversations ===\n');

  // Login as admin
  const login = await request('POST', '/b3/api/auth/login', { email: 'mcp@mage.io', password: 'mcpadmin12345678' });
  const agentCookie = login.cookie || ('session=' + (login.data?.data?.session ?? ''));
  console.log('Admin logged in');

  // Login as each customer and collect cookies
  const customerEmails = [
    'sarah.miller@outlook.com', 'james.wilson@gmail.com', 'emily.zhang@yahoo.com',
    'michael.brown@hotmail.com', 'lisa.taylor@proton.me', 'david.garcia@gmail.com',
    'jennifer.lee@outlook.com', 'robert.jones@yahoo.com', 'amanda.davis@gmail.com',
    'chris.martinez@hotmail.com', 'nicole.anderson@proton.me', 'kevin.thomas@gmail.com',
    'rachel.white@outlook.com', 'steven.harris@yahoo.com', 'laura.clark@gmail.com',
  ];

  const customerCookies = [];
  for (const email of customerEmails) {
    const res = await request('POST', '/helpdesk/api/auth/login', { email, password: 'TestPassword123!' });
    if (res.cookie) customerCookies.push(res.cookie);
    else if (res.status === 200) customerCookies.push('helpdesk_session=unknown');
  }
  console.log(`${customerCookies.length} customers logged in\n`);

  // Get all tickets
  const ticketsRes = await request('GET', '/helpdesk-api/tickets', null, agentCookie);
  const tickets = ticketsRes.data?.data ?? [];
  console.log(`${tickets.length} tickets found\n`);

  // Add conversations to tickets
  let msgCount = 0;
  let ticketsDone = 0;
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const conv = conversations[i % conversations.length];
    const custCookie = customerCookies[i % customerCookies.length];

    for (let j = 0; j < conv.length; j++) {
      if (j % 2 === 0) {
        // Customer message
        const r = await request('POST', `/helpdesk/api/tickets/${ticket.id}/messages`, { body: conv[j] }, custCookie);
        if (r.status === 201) msgCount++;
      } else {
        // Agent reply
        const r = await request('POST', `/helpdesk-api/tickets/${ticket.id}/messages`, { body: conv[j], is_internal: false }, agentCookie);
        if (r.status === 201) msgCount++;
      }
      // Small delay to avoid rate limits
      await delay(150);
    }

    ticketsDone++;
    if (ticketsDone % 10 === 0) console.log(`  ${ticketsDone}/${tickets.length} tickets, ${msgCount} messages`);
  }

  console.log(`\nDone! ${msgCount} messages added across ${ticketsDone} tickets.`);
})();
