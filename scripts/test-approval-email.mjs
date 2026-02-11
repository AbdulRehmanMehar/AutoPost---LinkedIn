import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Inline email function for testing
async function sendApprovalEmail(to, data) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'noreply@schedular.primestrides.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'AutoPost';
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  const approveUrl = `${baseUrl}/api/posts/${data.postId}/approve?token=${data.approvalToken}&action=approve`;
  const rejectUrl = `${baseUrl}/api/posts/${data.postId}/approve?token=${data.approvalToken}&action=reject`;
  const editUrl = `${baseUrl}/dashboard/edit/${data.postId}`;
  
  const confidencePercent = Math.round(data.confidence * 100);
  const riskColor = data.riskLevel === 'high' ? '#dc2626' : data.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';

  const html = `
<!DOCTYPE html>
<html>
<head><title>Post Approval</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>📝 Post Approval Request</h1>
  <p><strong>Confidence:</strong> ${confidencePercent}%</p>
  <p><strong>Risk Level:</strong> <span style="color: ${riskColor}">${data.riskLevel}</span></p>
  <p><strong>AI Analysis:</strong> ${data.aiReasoning}</p>
  <h3>Post Content:</h3>
  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${data.postContent}</div>
  <div style="margin-top: 24px;">
    <a href="${approveUrl}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-right: 8px;">✓ Approve</a>
    <a href="${editUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-right: 8px;">✏️ Edit</a>
    <a href="${rejectUrl}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">✗ Reject</a>
  </div>
</body>
</html>`;

  if (!apiKey) {
    console.log('📧 Email would be sent (no RESEND_API_KEY):');
    console.log(`  To: ${to}`);
    console.log(`  Subject: Post Approval Request`);
    return true;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: '📝 Post Approval Request - AI-Generated Content',
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      return false;
    }

    const result = await response.json();
    console.log('Resend response:', result);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

function generateApprovalToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function testEmail() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('          TESTING APPROVAL EMAIL                                    ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Check env vars
  console.log('Environment Check:');
  console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('  EMAIL_FROM:', process.env.EMAIL_FROM || 'Using default');
  console.log('  NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'Using default');
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI);
  
  // Get the pending post
  const post = await mongoose.connection.db.collection('posts').findOne({ 
    _id: new mongoose.Types.ObjectId('697aadb8ef21bbeabb8ee669') 
  });
  
  // Get the user
  const page = await mongoose.connection.db.collection('pages').findOne({ 
    _id: post.pageId 
  });
  const user = await mongoose.connection.db.collection('users').findOne({ 
    _id: page.userId 
  });

  console.log('Post:', post._id.toString());
  console.log('User email:', user?.email || 'NOT FOUND');
  console.log('');

  if (!user?.email) {
    console.log('❌ Cannot send email - no user email found');
    await mongoose.disconnect();
    return;
  }

  // Test sending email
  console.log('Sending test approval email...');
  
  const token = generateApprovalToken();
  
  const result = await sendApprovalEmail(user.email, {
    postId: post._id.toString(),
    postContent: post.content,
    confidence: post.aiAnalysis?.confidence || 0.7,
    riskLevel: post.aiAnalysis?.riskLevel || 'low',
    riskReasons: post.aiAnalysis?.riskReasons || [],
    angle: post.aiAnalysis?.angle || 'insight',
    aiReasoning: post.aiReview?.reasoning || 'AI-generated content for review',
    scheduledFor: post.scheduledFor,
    includesLink: /https?:\/\//.test(post.content),
    linkUrl: post.content?.match(/https?:\/\/[^\s]+/)?.[0],
    approvalToken: token,
  });

  console.log('');
  if (result) {
    console.log('✅ Email sent successfully!');
  } else {
    console.log('❌ Email failed to send');
  }

  await mongoose.disconnect();
}

testEmail().catch(console.error);
