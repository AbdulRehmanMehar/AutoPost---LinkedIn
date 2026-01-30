import dotenv from 'dotenv';
dotenv.config();

const baseUrl = 'http://localhost:3000';
const secret = process.env.CRON_SECRET;

console.log('Testing auto-generate with CRON_SECRET from .env...');
console.log('Secret length:', secret?.length);

async function test() {
  try {
    const response = await fetch(`${baseUrl}/api/cron/auto-generate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secret}`,
      },
    });
    
    const data = await response.json();
    console.log('\nResponse status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
