import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Update page to set pageType based on persona
  const result = await mongoose.connection.db.collection('pages').updateOne(
    { _id: new mongoose.Types.ObjectId('697a8625f047b183f44c15f7') },
    { $set: { pageType: 'organization' } }
  );
  
  console.log('Updated:', result.modifiedCount, 'page(s)');
  
  // Verify
  const page = await mongoose.connection.db.collection('pages').findOne({ 
    _id: new mongoose.Types.ObjectId('697a8625f047b183f44c15f7') 
  });
  console.log('New pageType:', page.pageType);
  
  await mongoose.disconnect();
}

fix().catch(console.error);
