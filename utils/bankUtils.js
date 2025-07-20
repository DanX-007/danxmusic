module.exports = {
    // Hitung kapasitas bank berdasarkan level
    calculateBankCapacity: (level) => {
        const baseCapacity = 10000;
        const multiplier = Math.pow(1.5, level - 1); // 1.5 pangkat (level-1)
        return Math.floor(baseCapacity * multiplier);
    },
    
    // Update bank capacity ketika level up
    updateBankCapacity: async (userId) => {
        const { economy } = require("../schemas/economy");
        const user = await economy.findOne({ userId });
        
        if (user) {
            const newCapacity = module.exports.calculateBankCapacity(user.level);
            if (newCapacity > user.bankCapacity) {
                user.bankCapacity = newCapacity;
                await user.save();
                return { updated: true, newCapacity };
            }
        }
        return { updated: false };
    }
};