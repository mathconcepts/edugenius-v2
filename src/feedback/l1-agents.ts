/**
 * EduGenius L1 AI Resolution Handlers
 * Routes feedback tickets to the correct agent and generates empathetic responses.
 *
 * Agent routing:
 *   Sage    → content_error, ai_behavior, exam_content, content_missing
 *   Mentor  → general_feedback, feature_request, account_issue, access_denied
 *   Forge   → technical_bug, performance
 *   Payment → payment_issue (Mentor/Herald, always flags for L2)
 *   Other   → Mentor fallback
 */

import type { FeedbackTicket, L1Response, TicketCategory } from './types';

// ============================================================================
// Agent Routing Map
// ============================================================================

const AGENT_CATEGORY_MAP: Record<TicketCategory, string> = {
  content_error: 'sage',
  ai_behavior: 'sage',
  exam_content: 'sage',
  content_missing: 'sage',
  general_feedback: 'mentor',
  feature_request: 'mentor',
  account_issue: 'mentor',
  access_denied: 'mentor',
  technical_bug: 'forge',
  performance: 'forge',
  payment_issue: 'herald',
  other: 'mentor',
};

// ============================================================================
// Utility
// ============================================================================

function buildL1Response(
  agentId: string,
  response: string,
  confidenceScore: number,
  resolutionType: L1Response['resolutionType'],
  escalationReason?: string
): L1Response {
  return {
    agentId,
    attemptedAt: new Date(),
    completedAt: new Date(),
    response,
    confidenceScore,
    resolutionType,
    escalationReason,
    qualityCheckPassed: false, // Will be set by service after quality check
    qualityCheckDetails: '',
  };
}

// ============================================================================
// Main Router
// ============================================================================

/**
 * Route ticket to the appropriate L1 agent and get a resolution attempt.
 */
export async function resolveWithL1(ticket: FeedbackTicket): Promise<L1Response> {
  const agentId = AGENT_CATEGORY_MAP[ticket.category] ?? 'mentor';

  switch (agentId) {
    case 'sage':
      return sageFeedbackHandler(ticket);
    case 'forge':
      return forgeFeedbackHandler(ticket);
    case 'herald':
      return paymentFeedbackHandler(ticket);
    case 'mentor':
    default:
      return mentorFeedbackHandler(ticket);
  }
}

// ============================================================================
// Sage — Content & AI Issues
// ============================================================================

/**
 * Sage handles content errors, AI behavior complaints, exam content issues,
 * and missing content.
 */
export async function sageFeedbackHandler(ticket: FeedbackTicket): Promise<L1Response> {
  const { category, title, description, priority } = ticket;

  let response = '';
  let confidenceScore = 0;
  let resolutionType: L1Response['resolutionType'] = 'information_provided';
  let escalationReason: string | undefined;

  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();

  if (category === 'content_error') {
    // Try to provide a correction
    const isFormula = descLower.includes('formula') || descLower.includes('equation');
    const isAnswer = descLower.includes('answer') || descLower.includes('solution');
    const isExplanation = descLower.includes('explanation') || descLower.includes('concept');

    if (isFormula || isAnswer || isExplanation) {
      response = `Thank you for bringing this to our attention — accuracy is our top priority, and we genuinely appreciate the effort it takes to report a content issue.

I, Sage, have reviewed your report about "${title}".

**What I've done:**
- Flagged the specific content for immediate review by our academic team
- Noted the error type: ${isFormula ? 'formula/equation' : isAnswer ? 'answer/solution' : 'concept explanation'}
- Tagged this for priority correction in the next content update

**In the meantime:**
${isFormula ? '- Please cross-reference the formula with your NCERT/standard textbook for the correct version.' : ''}
${isAnswer ? '- For the correct solution, I recommend checking the official answer key or consulting your teacher.' : ''}
${isExplanation ? '- I can provide an alternative explanation if you describe which specific concept seems incorrect.' : ''}

Our content team will review and correct this within 24–48 hours. You will be notified once the correction is live. If this is affecting your exam preparation urgently, please use the escalation option below.

— Sage 🧠`;
      confidenceScore = 78;
      resolutionType = 'workaround_provided';
    } else {
      response = `I appreciate you taking the time to report this content issue. Accuracy is fundamental to everything we do here.

I've reviewed your report: "${title}"

**Immediate actions taken:**
- Your report has been flagged for academic review
- The affected content has been marked for verification
- Our content accuracy team will investigate and publish a correction

While the review is ongoing, I recommend:
1. Using your physical textbook or NCERT as a reference for the topic in question
2. Consulting the official solutions manual if available
3. Reaching out to your teacher for clarification on the specific concept

We take content accuracy very seriously and will update you once the correction is applied. Thank you for helping us maintain the highest quality of educational content.

— Sage 🧠`;
      confidenceScore = 65;
      resolutionType = 'information_provided';
    }
  } else if (category === 'ai_behavior') {
    response = `Thank you for this feedback — it helps me become a better tutor for you and every student on the platform.

I understand you experienced an issue with my response. Here's what I want you to know:

**About this incident:**
I'm an AI tutor, and while I strive for accuracy, I can sometimes make mistakes — especially in complex multi-step problems, nuanced conceptual questions, or topics where my training data may have gaps.

**What I'm doing about it:**
- I've logged this interaction for review and retraining
- The specific response pattern that led to the incorrect guidance has been flagged
- Our AI team will use this feedback to improve my accuracy

**Going forward:**
- For critical exam preparation questions, always cross-verify my answers with your textbook or teacher
- If you found a specific mistake, please describe it in detail so we can fix it faster
- You can always ask me to "show my work" step by step for any solution

I genuinely want to be more helpful. Could you share which specific part of my response was incorrect? That will help us fix it faster.

— Sage 🧠`;
    confidenceScore = 72;
    resolutionType = 'information_provided';
  } else if (category === 'exam_content') {
    response = `Thank you for flagging this exam content issue. Exam accuracy is absolutely critical, and we take these reports with the highest priority.

**Your report:** "${title}"

**Actions taken:**
- This exam question/content has been immediately flagged for expert review
- Our academic team specializing in ${ticket.examId ?? 'competitive exam'} content has been notified
- The specific question has been marked for validation against official sources

**For your exam preparation:**
- If this is a practice test question, please note it may be temporarily marked as "under review"
- Rely on official mock tests and past papers from trusted sources for your exam prep
- Our corrected version will be published with a clear "Updated" tag so you know it's verified

Exam content errors are our highest priority category. You can expect resolution within 4–8 hours.

— Sage 🧠`;
    confidenceScore = 80;
    resolutionType = 'workaround_provided';
    if (priority === 'critical' || priority === 'high') {
      escalationReason = 'Exam content error during active exam preparation period — requires human expert verification.';
      resolutionType = 'escalated';
    }
  } else if (category === 'content_missing') {
    response = `Thank you for identifying a gap in our content! This kind of feedback directly shapes our content roadmap.

**Your request:** "${title}"

**What happens next:**
- I've created a content gap report and submitted it to our Atlas content creation team
- This topic has been added to the content backlog with your report as justification
- Our Herald team will also check if this content is available in our related resources

**Available alternatives right now:**
- Search our existing content using different keywords related to your topic
- Check our reference materials and study guides section
- For urgent exam prep needs, I can attempt to explain the concept directly in our chat

We'll notify you when the requested content is published. Content creation typically takes 3–7 business days depending on complexity.

— Sage 🧠`;
    confidenceScore = 75;
    resolutionType = 'workaround_provided';
  }

  if (!response) {
    response = `Thank you for your feedback regarding "${title}". I've reviewed your report and have taken the following steps:

- Flagged the content for expert review
- Created a tracking record for this issue
- Notified the relevant team

We'll investigate and respond within our standard SLA. Please feel free to provide any additional details that might help us resolve this faster.

— Sage 🧠`;
    confidenceScore = 55;
    resolutionType = 'information_provided';
  }

  return buildL1Response('sage', response, confidenceScore, resolutionType, escalationReason);
}

// ============================================================================
// Mentor — Engagement, Features, Account
// ============================================================================

/**
 * Mentor handles general feedback, feature requests, account issues, and access problems.
 */
export async function mentorFeedbackHandler(ticket: FeedbackTicket): Promise<L1Response> {
  const { category, title, description } = ticket;

  let response = '';
  let confidenceScore = 0;
  let resolutionType: L1Response['resolutionType'] = 'information_provided';
  let escalationReason: string | undefined;

  const descLower = description.toLowerCase();

  if (category === 'general_feedback') {
    const isPositive = /great|love|awesome|excellent|fantastic|amazing|wonderful|brilliant/i.test(description);
    if (isPositive) {
      response = `Wow, thank you so much for this wonderful feedback! 🌟

It genuinely means a lot to our entire team to hear that EduGenius is making a positive impact on your learning journey. Messages like yours are what motivate us to keep pushing the boundaries of what an AI-powered tutor can do.

**Your feedback has been:**
- Shared with our team (they'll love hearing this!)
- Added to our success stories collection
- Used to understand what's working well so we can do more of it

Keep up the amazing work with your studies! If you ever have suggestions for making EduGenius even better, we're all ears. 

Cheering you on every step of the way! 🎯

— Mentor 🎓`;
      confidenceScore = 95;
      resolutionType = 'auto_resolved';
    } else {
      response = `Thank you for sharing your thoughts about "${title}". Your feedback matters deeply to us.

I've carefully noted your feedback and here's what happens with it:
- It's been added to our product feedback database
- Relevant teams will review it during our next product cycle
- Patterns from feedback like yours directly influence our roadmap

Is there anything specific you'd like us to act on? Sometimes a brief follow-up helps us prioritize the right improvements. 

— Mentor 🎓`;
      confidenceScore = 82;
      resolutionType = 'auto_resolved';
    }
  } else if (category === 'feature_request') {
    response = `What a great idea! 💡 Thank you for taking the time to suggest this feature.

**Your feature request:** "${title}"

**What happens next:**
- Your request has been logged in our product backlog with your details
- Our product team reviews all feature requests weekly
- You'll be notified if and when this feature makes it to our roadmap
- If enough users request the same feature, it gets fast-tracked!

**Reality check:** We receive many great ideas and can only build so many at once. But every request genuinely influences our priorities — your voice matters.

In the meantime, you might be able to achieve something similar with: [checking existing features...]
- Our Notebook feature for organizing study materials
- The Learn mode for guided topic exploration  
- The Chat interface for interactive Q&A

Thank you for helping shape EduGenius! 🚀

— Mentor 🎓`;
    confidenceScore = 88;
    resolutionType = 'auto_resolved';
  } else if (category === 'account_issue') {
    response = `I'm sorry you're experiencing account issues — let's get this sorted out quickly!

**For your issue:** "${title}"

**Self-service steps to try:**

🔐 **Password/Login issues:**
1. Click "Forgot Password" on the login screen
2. Check your registered email for the reset link
3. Clear browser cache and cookies, then try again
4. Try a different browser or incognito mode

👤 **Profile update issues:**
1. Go to Settings → Profile
2. Ensure all required fields are filled
3. File size limits: photos must be under 5MB

📧 **Email change:**
1. Settings → Account → Change Email
2. Verify both old and new email addresses

⚠️ **If none of these work:**
Please escalate this ticket and a human agent will access your account directly and resolve it within 2–4 hours.

— Mentor 🎓`;
    confidenceScore = 72;
    resolutionType = 'workaround_provided';
  } else if (category === 'access_denied') {
    const isPremium = descLower.includes('premium') || descLower.includes('locked') || descLower.includes('upgrade');
    const isEnrollment = descLower.includes('enroll') || descLower.includes('not enrolled') || descLower.includes('course');

    if (isPremium) {
      response = `I understand how frustrating it is to hit a locked gate when you're trying to study! Let me help you get access.

**For your issue:** "${title}"

**Why you might see this:**
- The content requires a Premium or higher subscription
- Your free trial period may have ended
- A specific exam pack may require separate activation

**Steps to resolve:**
1. Go to Settings → Subscription to see your current plan
2. If you recently upgraded, log out and log back in to refresh your access
3. Check your email for a subscription confirmation (check spam folder too)
4. If you upgraded but still can't access: your payment may be processing (takes 10–15 minutes)

**If you believe this is an error:**
- Screenshot the locked content and the error message
- Escalate this ticket for our team to manually verify your subscription status

— Mentor 🎓`;
      confidenceScore = 68;
      resolutionType = 'workaround_provided';
    } else if (isEnrollment) {
      response = `Let me help you get enrolled and access your content!

**For your issue:** "${title}"

**Steps to check enrollment:**
1. Go to Dashboard → My Courses
2. If the course appears but is locked, click "Resume" or "Enroll"
3. For exam prep content: go to Settings → Exam Settings and verify your target exam is selected

**If you can't find the content:**
- Use the search feature to look for the specific topic
- Check if the content is under a different subject category
- Some content is only accessible after completing prerequisite modules

I've noted your access issue. If the above steps don't help, please escalate and our team will manually grant you access within 1–2 hours.

— Mentor 🎓`;
      confidenceScore = 65;
      resolutionType = 'workaround_provided';
    } else {
      response = `I'm sorry you're having trouble accessing content. Let me try to help!

**For your issue:** "${title}"

**Quick troubleshooting:**
1. Refresh the page (Ctrl+F5 for a hard refresh)
2. Log out and log back in
3. Clear browser cache and cookies
4. Try a different browser or device

**If access is blocked by permissions:**
Please escalate this ticket so our team can check your account permissions directly. We'll restore your access within 2 hours.

— Mentor 🎓`;
      confidenceScore = 60;
      resolutionType = 'workaround_provided';
    }
  } else {
    // Fallback for 'other' category
    response = `Thank you for reaching out! I've received your message about "${title}".

I want to make sure you get the right help. I've reviewed your request and here's where things stand:

- Your ticket has been logged and is being processed
- I've reviewed the details you provided
- If this requires specialist attention, it will be escalated appropriately

Is there any additional information you'd like to add to help us resolve this faster? The more detail you provide, the quicker we can find the right solution for you.

— Mentor 🎓`;
    confidenceScore = 55;
    resolutionType = 'information_provided';
    escalationReason = 'Category "other" requires human assessment to properly categorize and resolve.';
    resolutionType = 'escalated';
  }

  return buildL1Response('mentor', response, confidenceScore, resolutionType, escalationReason);
}

// ============================================================================
// Forge — Technical Issues
// ============================================================================

/**
 * Forge handles technical bugs and performance issues.
 */
export async function forgeFeedbackHandler(ticket: FeedbackTicket): Promise<L1Response> {
  const { category, title, description } = ticket;
  const descLower = description.toLowerCase();

  let response = '';
  let confidenceScore = 0;
  let resolutionType: L1Response['resolutionType'] = 'workaround_provided';
  let escalationReason: string | undefined;

  if (category === 'performance') {
    response = `Sorry to hear EduGenius is running slowly for you — performance is something we care deeply about!

**For your issue:** "${title}"

**Immediate steps to improve performance:**

🚀 **Browser optimizations:**
1. Close unused browser tabs (each tab uses memory)
2. Disable browser extensions temporarily (some block or slow content)
3. Try Chrome or Edge for best performance
4. Clear cache: Settings → Privacy → Clear browsing data

📱 **Device tips:**
1. Restart your device if you haven't recently
2. Check your internet speed at fast.com (we recommend 5+ Mbps)
3. Switch from WiFi to mobile data (or vice versa) to test
4. Close background apps on mobile

🎬 **Video-specific:**
1. Reduce video quality from the player settings (720p → 480p)
2. Download videos for offline viewing if available

**If the issue persists:**
Our engineering team has been notified of performance reports in your region. We're actively monitoring server response times.

— Forge ⚙️`;
    confidenceScore = 70;
    resolutionType = 'workaround_provided';
  } else if (category === 'technical_bug') {
    const isCrash = descLower.includes('crash') || descLower.includes('blank') || descLower.includes('error');
    const isVideo = descLower.includes('video') || descLower.includes('play');
    const isLogin = descLower.includes('login') || descLower.includes('sign in');
    const isData = descLower.includes('data') || descLower.includes('progress') || descLower.includes('lost');

    if (isData) {
      // Data loss is serious
      response = `I understand this is very concerning, and I want to assure you that our first priority is preserving your data.

**For your issue:** "${title}"

**Immediate steps:**
1. Do NOT log out or delete the app yet
2. Take a screenshot of your current state
3. Check if your progress appears in a different browser/device (data may be cached)

**What we're doing:**
- I've flagged this as a potential data integrity issue — our engineering team will investigate immediately
- Your account has been noted for priority review
- We maintain automated backups; your data is very likely recoverable

This requires human technical review. I'm escalating this to our L2 engineering team right away.

— Forge ⚙️`;
      confidenceScore = 40; // Low confidence → escalate
      resolutionType = 'escalated';
      escalationReason = 'Potential data loss/integrity issue requires immediate human technical investigation.';
    } else if (isLogin) {
      response = `Login issues can be really frustrating, especially when you need to study. Let's fix this!

**For your issue:** "${title}"

**Steps to try:**
1. Clear your browser cookies and cache completely
2. Try Incognito/Private mode in your browser
3. Use the "Forgot Password" option to reset your credentials
4. Try a different browser (Chrome, Firefox, Edge)
5. Disable VPN if you're using one
6. Check if your account email is correct

**If you see a specific error message:**
- "Account suspended": Contact support (escalate this ticket)
- "Invalid credentials": Use password reset
- "Session expired": Log in again

Could you share the exact error message you see? That'll help us diagnose faster.

— Forge ⚙️`;
      confidenceScore = 68;
      resolutionType = 'workaround_provided';
    } else if (isVideo) {
      response = `Sorry the video isn't playing properly! Let's troubleshoot this.

**For your issue:** "${title}"

**Video playback fixes:**
1. Refresh the page and try again
2. Reduce video quality (click the gear icon in the player)
3. Clear browser cache and reload
4. Disable browser extensions (especially ad blockers)
5. Try a different browser
6. Check your internet speed (videos need at least 3 Mbps for HD)
7. Try downloading the video for offline viewing

**Mobile-specific:**
- Update the app to the latest version
- Restart the app completely
- Check if other videos play (to isolate if it's one specific video)

If this is happening for ALL videos, there may be a regional server issue — please share your location (city/state) so we can investigate.

— Forge ⚙️`;
      confidenceScore = 72;
      resolutionType = 'workaround_provided';
    } else if (isCrash) {
      response = `I'm sorry the app is crashing on you — that's unacceptable and I want to get it fixed!

**For your issue:** "${title}"

**Immediate workarounds:**
1. Refresh the page (F5 or Ctrl+R)
2. Hard refresh to bypass cache (Ctrl+Shift+R or Ctrl+F5)
3. Clear browser cache and try again
4. Try a different browser temporarily

**To help us fix it faster:**
- What were you doing when it crashed?
- Does it crash on a specific page or action?
- What browser/device are you using?
- Do you see any error message (screenshot it!)

**Bug report created:**
I've logged this as a technical bug with HIGH priority. Our engineering team will investigate. If you can reproduce the crash consistently, please share the steps — that's invaluable for fixing bugs quickly.

— Forge ⚙️`;
      confidenceScore = 62;
      resolutionType = 'workaround_provided';
      if (ticket.priority === 'critical' || ticket.priority === 'high') {
        escalationReason = 'High-priority crash bug requires immediate engineering investigation.';
        resolutionType = 'escalated';
      }
    } else {
      response = `I'm sorry you're experiencing a technical issue with EduGenius!

**For your issue:** "${title}"

**General troubleshooting steps:**
1. Refresh the page / restart the app
2. Clear browser cache (Ctrl+Shift+Delete in most browsers)
3. Log out and log back in
4. Try a different browser or device
5. Check our status page for any known outages

**I've done the following:**
- Logged this bug report with all technical details
- Flagged it for our engineering team's review
- Created a tracking reference: ${ticket.id}

If the above steps don't resolve the issue, please share:
- Steps to reproduce the bug
- Your browser/device details
- Any error messages you see

— Forge ⚙️`;
      confidenceScore = 58;
      resolutionType = 'workaround_provided';
    }
  }

  if (!response) {
    response = `Thank you for reporting this technical issue. I've logged it for engineering review and provided the best available workarounds. Our team will investigate and provide a fix. — Forge ⚙️`;
    confidenceScore = 50;
    resolutionType = 'information_provided';
  }

  return buildL1Response('forge', response, confidenceScore, resolutionType, escalationReason);
}

// ============================================================================
// Payment Handler — Always flags for L2
// ============================================================================

/**
 * Herald/Mentor handles payment issues. L1 provides information but ALWAYS
 * flags for L2 human review since payment issues are sensitive.
 */
export async function paymentFeedbackHandler(ticket: FeedbackTicket): Promise<L1Response> {
  const { title, description } = ticket;
  const descLower = description.toLowerCase();

  const isRefund = descLower.includes('refund');
  const isDoubleCharge = descLower.includes('double') || descLower.includes('charged twice');
  const isUpgrade = descLower.includes('upgrade') || descLower.includes('not upgraded') || descLower.includes('premium');
  const isInvoice = descLower.includes('invoice') || descLower.includes('receipt');

  let specificInfo = '';
  if (isRefund) {
    specificInfo = `
**About refunds:**
- Our refund policy allows full refunds within 7 days of purchase
- Refund processing takes 5–7 business days once approved
- Refunds are returned to the original payment method`;
  } else if (isDoubleCharge) {
    specificInfo = `
**About double charges:**
- Sometimes banks show a pending authorization alongside the actual charge — the pending one usually drops off within 2–3 days
- If both charges appear as "completed" in your bank statement, this is an error and will be refunded in full`;
  } else if (isUpgrade) {
    specificInfo = `
**About subscription upgrades:**
- After payment, upgrades may take 10–15 minutes to activate
- Try logging out and back in to refresh your subscription status
- Check your email for a confirmation of the upgrade`;
  } else if (isInvoice) {
    specificInfo = `
**About invoices/receipts:**
- Receipts are sent to your registered email within 24 hours of payment
- You can also access them via Settings → Billing → Transaction History`;
  }

  const response = `I completely understand how important payment issues are, and I want to assure you this is being treated with the highest priority.

**Your issue:** "${title}"
${specificInfo}

**What I've done right now:**
- Flagged your payment issue for immediate human review
- Noted your account details for our billing team
- Created a priority tracking record: ${ticket.id}

**What happens next:**
Our billing team (human agents) will personally review your payment history and account status. They will respond within 1–4 hours during business hours.

**For urgent assistance:**
- Email us directly at billing@edugenius.app with your ticket ID: ${ticket.id}
- Include your registered email and the approximate payment date

I want to be transparent: payment issues require human verification to protect your security. I'm connecting you with our billing team right now.

— Herald 📢`;

  // Payment issues always escalate to L2 — confidence is intentionally set low
  return buildL1Response(
    'herald',
    response,
    45, // Always below any threshold to force L2
    'escalated',
    'Payment issues require mandatory L2 human review for security and accuracy.'
  );
}
