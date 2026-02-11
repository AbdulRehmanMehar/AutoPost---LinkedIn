import dotenv from 'dotenv';
dotenv.config();

async function sendTestEmail() {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.log('No RESEND_API_KEY configured in .env');
    return;
  }
  
  console.log('Sending test email to mehars.6925@gmail.com...');
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'AutoPost <noreply@schedular.primestrides.com>',
      to: ['mehars.6925@gmail.com'],
      subject: 'Test Email from AutoPost',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">🎉 Test Email</h1>
          <p>This is a test email from your <strong>AutoPost</strong> application.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
      text: 'Test Email - This is a test email from your AutoPost application. If you received this, your email configuration is working correctly!',
    }),
  });
  
  const result = await response.text();
  console.log('Response status:', response.status);
  console.log('Response:', result);
  
  if (response.ok) {
    console.log('✅ Email sent successfully!');
  } else {
    console.log('❌ Failed to send email');
  }
}

sendTestEmail();
