// File: utils/buffCleanup.js
const { economy } = require('../schemas/economy');

async function cleanupExpiredBuffs() {
    try {
        const now = new Date();
        
        // Update semua dokumen yang memiliki buff kadaluarsa
        const result = await economy.updateMany(
            { 
                "tempBuffs.expiresAt": { $lt: now } 
            },
            { 
                $pull: { 
                    tempBuffs: { 
                        expiresAt: { $lt: now } 
                    } 
                } 
            }
        );
        
        console.log(`[Buff Cleanup] Membersihkan ${result.modifiedCount} buff kadaluarsa`);
        
        // Jadwalkan pembersihan berikutnya dalam 5 menit
        setTimeout(cleanupExpiredBuffs, 5 * 60 * 1000); 
    } catch (error) {
        console.error('[Buff Cleanup Error]', error);
        // Retry dalam 1 menit jika error
        setTimeout(cleanupExpiredBuffs, 60 * 1000);
    }
}

// Versi optimasi untuk banyak pengguna
async function optimizedBuffCleanup() {
    try {
        const now = new Date();
        const batchSize = 100;
        let lastProcessedId = null;
        let processedCount = 0;

        do {
            const query = { 
                "tempBuffs.expiresAt": { $lt: now },
                ...(lastProcessedId && { _id: { $gt: lastProcessedId } })
            };

            const users = await economy.find(query)
                .sort({ _id: 1 })
                .limit(batchSize)
                .lean();

            if (users.length === 0) break;

            for (const user of users) {
                const activeBuffs = user.tempBuffs.filter(b => 
                    new Date(b.expiresAt) >= now
                );

                if (activeBuffs.length !== user.tempBuffs.length) {
                    await economy.updateOne(
                        { _id: user._id },
                        { $set: { tempBuffs: activeBuffs } }
                    );
                    processedCount++;
                }
            }

            lastProcessedId = users[users.length - 1]._id;
        } while (true);

        console.log(`[Buff Cleanup] Memproses ${processedCount} pengguna`);
        setTimeout(optimizedBuffCleanup, 5 * 60 * 1000);
    } catch (error) {
        console.error('[Buff Cleanup Error]', error);
        setTimeout(optimizedBuffCleanup, 60 * 1000);
    }
}

// Pilih salah satu metode
module.exports = { 
    startBuffCleanup: optimizedBuffCleanup 
};