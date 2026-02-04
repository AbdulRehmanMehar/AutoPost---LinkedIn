#!/usr/bin/env node
/**
 * Clear stuck conversation monitor lock
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

async function clearLock() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Delete ALL possible lock variations
    const lockNames = [
      'conversation-monitor',
      'cron:conversation-monitor',
    ];
    
    for (const lockName of lockNames) {
      // Try distributed_locks collection
      const result1 = await mongoose.connection.db.collection('distributed_locks').deleteOne({
        lockName: lockName
      });
      
      // Try cron_locks collection (used by newer code)
      const result2 = await mongoose.connection.db.collection('cron_locks').deleteOne({
        _id: lockName
      });
      
      if (result1.deletedCount > 0 || result2.deletedCount > 0) {
        console.log(`✅ Lock '${lockName}' cleared`);
      }
    }
    
    // Show all existing locks
    const cronLocks = await mongoose.connection.db.collection('cron_locks').find({}).toArray();
    const distLocks = await mongoose.connection.db.collection('distributed_locks').find({}).toArray();
    
    console.log(`\n📊 Remaining locks:`);
    console.log(`   cron_locks: ${cronLocks.length}`, cronLocks.map(l => l._id));
    console.log(`   distributed_locks: ${distLocks.length}`, distLocks.map(l => l.lockName));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearLock();
