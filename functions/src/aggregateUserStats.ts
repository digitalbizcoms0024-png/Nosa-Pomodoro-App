// Scheduled Cloud Function to calculate user percentile rankings
// Runs daily at 3am UTC to aggregate weekly session totals and compute percentiles

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

export const aggregateUserStats = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'UTC',
    memory: '512MiB',
  },
  async (event) => {
    const db = getFirestore();

    try {
      console.log('Starting user stats aggregation...');

      // Calculate date range for past week
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all users
      const usersSnapshot = await db.collection('users').get();
      const userStats: Array<{ uid: string; weeklyMinutes: number }> = [];

      // Calculate weekly session totals for each user
      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        const sessionsSnapshot = await db
          .collection('users')
          .doc(uid)
          .collection('sessions')
          .where('timestamp', '>=', weekAgo)
          .where('timestamp', '<=', now)
          .get();

        const weeklyMinutes = sessionsSnapshot.docs.reduce(
          (sum, doc) => sum + (doc.data().minutesCompleted || 0),
          0
        );

        userStats.push({ uid, weeklyMinutes });
      }

      console.log(`Calculated stats for ${userStats.length} users`);

      // Sort by weekly minutes descending
      userStats.sort((a, b) => b.weeklyMinutes - a.weeklyMinutes);

      // Calculate percentiles and write to userStats collection
      const totalUsers = userStats.length;
      const batchSize = 450; // Stay under Firestore's 500 write limit per batch
      let batchCount = 0;
      let batch = db.batch();

      for (let i = 0; i < userStats.length; i++) {
        const { uid, weeklyMinutes } = userStats[i];
        const percentile = Math.round((i / totalUsers) * 100);

        const userStatsRef = db.collection('userStats').doc(uid);
        batch.set(
          userStatsRef,
          {
            percentile,
            weeklyMinutes,
            rank: i + 1,
            totalUsers,
            lastUpdated: new Date(),
          },
          { merge: true }
        );

        batchCount++;

        // Commit batch when hitting batch size limit
        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} writes`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining writes
      if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} writes`);
      }

      console.log(`User stats aggregation complete. Processed ${totalUsers} users.`);
    } catch (error) {
      console.error('Error aggregating user stats:', error);
      throw error;
    }
  }
);
