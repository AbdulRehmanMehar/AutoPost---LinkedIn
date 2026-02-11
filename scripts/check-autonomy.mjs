import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const page = await mongoose.connection.db.collection('pages').findOne({ 
    _id: new mongoose.Types.ObjectId('697a8625f047b183f44c15f7') 
  });
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║     AUTONOMY STATUS CHECK              ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('📄 Page:', page.name);
  console.log('');
  
  console.log('🔧 SCHEDULE SETTINGS:');
  console.log('   ├─ autoGenerate:', page.schedule?.autoGenerate ? '✅ ON' : '❌ OFF');
  console.log('   ├─ autoApprove:', page.schedule?.autoApprove ? '✅ ON' : '❌ OFF');
  console.log('   ├─ preferredDays:', page.schedule?.preferredDays?.join(', ') || 'not set');
  console.log('   └─ preferredTimes:', page.schedule?.preferredTimes?.join(', ') || 'not set');
  console.log('');
  
  console.log('🗄️  DATA SOURCES:');
  const dbCount = page.dataSources?.databases?.length || 0;
  const activeCount = page.dataSources?.databases?.filter(d => d.isActive).length || 0;
  console.log('   ├─ Total:', dbCount);
  console.log('   └─ Active:', activeCount ? `✅ ${activeCount}` : '❌ 0');
  console.log('');
  
  console.log('📝 CONTENT STRATEGY:');
  console.log('   ├─ Persona:', page.contentStrategy?.persona ? '✅ Configured' : '❌ Not set');
  console.log('   ├─ Topics:', page.contentStrategy?.topics?.length || 0);
  console.log('   └─ Tone:', page.contentStrategy?.tone || 'not set');
  console.log('');
  
  // Check what's needed for full autonomy
  console.log('════════════════════════════════════════');
  console.log('📊 AUTONOMY VERDICT:');
  
  const issues = [];
  if (!page.schedule?.autoGenerate) issues.push('Enable autoGenerate in schedule settings');
  if (!page.schedule?.autoApprove) issues.push('Enable autoApprove for hands-free operation');
  if (!activeCount) issues.push('Add and activate at least one data source');
  if (!page.contentStrategy?.persona) issues.push('Configure content strategy persona');
  
  if (issues.length === 0) {
    console.log('   ✅ FULLY AUTONOMOUS!');
    console.log('   The system will automatically:');
    console.log('   1. Fetch content from MySQL database');
    console.log('   2. Generate LinkedIn posts using AI');
    console.log('   3. Schedule & publish without approval');
  } else {
    console.log('   ⚠️  NOT FULLY AUTONOMOUS');
    console.log('   To enable full autonomy, fix:');
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }
  console.log('════════════════════════════════════════');
  
  await mongoose.disconnect();
}

check().catch(console.error);
