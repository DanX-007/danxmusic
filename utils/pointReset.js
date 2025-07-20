// File: utils/pointReset.js
const { economy } = require('../schemas/economy');
const { setTimeout } = require('timers/promises');

const POINTS_RESET_INTERVAL = 30 * 60 * 1000; // 30 menit
const RESET_POINT_VALUE = 5;
const BATCH_SIZE = 100; // Untuk handle banyak user

async function resetPointsBatch(lastId = null) {
    try {
        const now = new Date();
        const cutoffTime = new Date(now - POINTS_RESET_INTERVAL);

        const query = {
            $or: [
                { 'points.lastReset': { $lt: cutoffTime } },
                { 'points.lastReset': { $exists: false } }
            ],
            ...(lastId && { _id: { $gt: lastId } })
        };

        const users = await economy.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE)
            .lean();

        if (users.length === 0) return null;

        const bulkOps = users.map(user => ({
            updateOne: {
                filter: { _id: user._id },
                update: {
                    $set: {
                        'points.current': RESET_POINT_VALUE,
                        'points.lastReset': now
                    }
                }
            }
        }));

        await economy.bulkWrite(bulkOps);
        return users[users.length - 1]._id;

    } catch (error) {
        console.error('[Point Reset Error]', error);
        throw error;
    }
}

async function resetPoints() {
    try {
        console.log('[Point Reset] Memulai proses reset points...');
        let lastProcessedId = null;
        let totalProcessed = 0;

        do {
            lastProcessedId = await resetPointsBatch(lastProcessedId);
            if (lastProcessedId) totalProcessed += BATCH_SIZE;
        } while (lastProcessedId);

        console.log(`[Point Reset] Selesai. Total direset: ~${totalProcessed} pengguna`);
        
    } catch (error) {
        console.error('[Point Reset Fatal Error]', error);
    } finally {
        // Jadwalkan berikutnya dengan interval tetap
        setTimeout(resetPoints, POINTS_RESET_INTERVAL);
    }
}

// Tambahan: Fungsi untuk reset manual (opsional)
async function manualReset() {
    await resetPoints();
    return 'Reset points manual selesai';
}

module.exports = { 
    startPointReset: resetPoints,
    manualReset
};