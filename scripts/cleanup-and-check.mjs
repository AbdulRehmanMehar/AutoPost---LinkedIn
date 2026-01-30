import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Delete the pending post
  const result = await mongoose.connection.db.collection('posts').deleteOne({ 
    _id: new mongoose.Types.ObjectId('697aadb8ef21bbeabb8ee669') 
  });
  console.log('✅ Deleted pending post:', result.deletedCount);
  
  // Check page schedule settings
  const page = await mongoose.connection.db.collection('pages').findOne({ 
    _id: new mongoose.Types.ObjectId('697a8625f047b183f44c15f7') 
  });
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('PAGE SCHEDULE SETTINGS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  postingFrequency:', page.contentStrategy?.postingFrequency, 'posts/week');
  console.log('  preferredDays:', page.schedule?.preferredDays?.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', '));
  console.log('  preferredTimes:', page.schedule?.preferredTimes?.join(', '));
  console.log('  autoGenerate:', page.schedule?.autoGenerate);
  console.log('  autoApprove:', page.schedule?.autoApprove);
  console.log('  minConfidenceForAutoApprove:', page.schedule?.minConfidenceForAutoApprove);
  
  await mongoose.disconnect();
}

cleanup().catch(console.error);
