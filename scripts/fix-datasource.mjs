import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await mongoose.connection.db.collection('pages').updateOne(
    { _id: new mongoose.Types.ObjectId('697a8625f047b183f44c15f7') },
    {
      $set: {
        dataSources: {
          databases: [{
            id: 'test-123',
            name: 'PrimeStrides Blog',
            type: 'mysql',
            connectionString: 'mysql://g1UK7SLKJj2K3Ph.root:tFXOt30PRF6osrUQ@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/main',
            query: 'SELECT id, title, content_json FROM posts WHERE website_id = "3a4c8244-f868-11f0-9dba-e6708e15feb9" AND status = "published"',
            description: 'PrimeStrides blog posts',
            isActive: true,
            refreshInterval: 0
          }],
          apis: []
        }
      }
    }
  );
  
  console.log('Update result:', result);
  
  // Verify
  const page = await mongoose.connection.db.collection('pages').findOne({ 
    _id: new mongoose.Types.ObjectId('697a8625f047b183f44c15f7') 
  });
  console.log('DataSources now:', JSON.stringify(page?.dataSources, null, 2));
  
  await mongoose.disconnect();
}

fix();
