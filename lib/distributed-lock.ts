/**
 * Distributed Locking for Cron Jobs
 * 
 * Uses MongoDB to implement a simple but effective distributed lock
 * to prevent concurrent execution of cron jobs across multiple instances.
 */

import mongoose from 'mongoose';

// Lock document schema
interface ICronLock {
  _id: string;           // Lock name (e.g., 'cron:auto-generate')
  holder: string;        // Instance identifier
  acquiredAt: Date;      // When lock was acquired
  expiresAt: Date;       // Auto-expiry for stale locks
  metadata?: Record<string, unknown>;
}

const CronLockSchema = new mongoose.Schema<ICronLock>(
  {
    _id: { type: String, required: true },
    holder: { type: String, required: true },
    acquiredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { collection: 'cron_locks' }
);

// Create model if it doesn't exist
const CronLock = mongoose.models.CronLock || mongoose.model<ICronLock>('CronLock', CronLockSchema);

// Generate unique instance ID
const INSTANCE_ID = `${process.env.HOSTNAME || 'local'}-${process.pid}-${Date.now()}`;

export interface LockOptions {
  lockName: string;
  ttlSeconds?: number;    // Lock expiry time (default: 5 minutes)
  waitTimeoutMs?: number; // Max time to wait for lock (default: 0 = don't wait)
  retryIntervalMs?: number; // Retry interval when waiting (default: 1000ms)
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  holder?: string;
  error?: string;
}

/**
 * Attempt to acquire a distributed lock
 */
export async function acquireLock(options: LockOptions): Promise<LockResult> {
  const {
    lockName,
    ttlSeconds = 300, // 5 minutes default
    waitTimeoutMs = 0,
    retryIntervalMs = 1000,
  } = options;

  const lockId = `cron:${lockName}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const tryAcquire = async (): Promise<LockResult> => {
    try {
      // Try to insert a new lock or update an expired one
      const result = await CronLock.findOneAndUpdate(
        {
          _id: lockId,
          $or: [
            { expiresAt: { $lt: now } }, // Lock expired
          ],
        },
        {
          _id: lockId,
          holder: INSTANCE_ID,
          acquiredAt: now,
          expiresAt,
          metadata: { 
            attemptedAt: now,
            environment: process.env.NODE_ENV,
          },
        },
        { upsert: false, new: true }
      );

      if (result) {
        console.log(`Lock acquired: ${lockId} by ${INSTANCE_ID}`);
        return { acquired: true, lockId, holder: INSTANCE_ID };
      }

      // Lock exists and isn't expired - try upsert for new locks
      try {
        await CronLock.create({
          _id: lockId,
          holder: INSTANCE_ID,
          acquiredAt: now,
          expiresAt,
        });
        console.log(`Lock created: ${lockId} by ${INSTANCE_ID}`);
        return { acquired: true, lockId, holder: INSTANCE_ID };
      } catch (createError: unknown) {
        // Duplicate key error means another process got the lock
        if ((createError as { code?: number }).code === 11000) {
          const existingLock = await CronLock.findById(lockId);
          return { 
            acquired: false, 
            holder: existingLock?.holder,
            error: `Lock held by ${existingLock?.holder}`,
          };
        }
        throw createError;
      }
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return { 
        acquired: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  // First attempt
  let result = await tryAcquire();
  
  if (result.acquired || waitTimeoutMs <= 0) {
    return result;
  }

  // Wait and retry
  const startTime = Date.now();
  while (Date.now() - startTime < waitTimeoutMs) {
    await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
    result = await tryAcquire();
    if (result.acquired) {
      return result;
    }
  }

  return { 
    acquired: false, 
    error: `Timeout waiting for lock: ${lockId}`,
  };
}

/**
 * Release a distributed lock
 */
export async function releaseLock(lockName: string): Promise<boolean> {
  const lockId = `cron:${lockName}`;
  
  try {
    const result = await CronLock.deleteOne({
      _id: lockId,
      holder: INSTANCE_ID, // Only release if we hold it
    });
    
    if (result.deletedCount > 0) {
      console.log(`Lock released: ${lockId}`);
      return true;
    }
    
    console.log(`Lock not released (not held by us): ${lockId}`);
    return false;
  } catch (error) {
    console.error('Error releasing lock:', error);
    return false;
  }
}

/**
 * Extend the TTL of a held lock
 */
export async function extendLock(lockName: string, additionalSeconds: number): Promise<boolean> {
  const lockId = `cron:${lockName}`;
  const newExpiry = new Date(Date.now() + additionalSeconds * 1000);
  
  try {
    const result = await CronLock.updateOne(
      {
        _id: lockId,
        holder: INSTANCE_ID,
      },
      {
        $set: { expiresAt: newExpiry },
      }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error extending lock:', error);
    return false;
  }
}

/**
 * Check if a lock is currently held
 */
export async function isLocked(lockName: string): Promise<{ locked: boolean; holder?: string; expiresAt?: Date }> {
  const lockId = `cron:${lockName}`;
  
  try {
    const lock = await CronLock.findById(lockId);
    
    if (!lock || lock.expiresAt < new Date()) {
      return { locked: false };
    }
    
    return { 
      locked: true, 
      holder: lock.holder,
      expiresAt: lock.expiresAt,
    };
  } catch (error) {
    console.error('Error checking lock:', error);
    return { locked: false };
  }
}

/**
 * Execute a function with distributed locking
 * Automatically acquires and releases the lock
 */
export async function withLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  options: Omit<LockOptions, 'lockName'> = {}
): Promise<{ success: boolean; result?: T; error?: string; skipped?: boolean }> {
  const lockResult = await acquireLock({ lockName, ...options });
  
  if (!lockResult.acquired) {
    return { 
      success: false, 
      skipped: true,
      error: lockResult.error || 'Could not acquire lock',
    };
  }
  
  try {
    const result = await fn();
    return { success: true, result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await releaseLock(lockName);
  }
}
