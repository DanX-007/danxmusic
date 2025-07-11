const premium = require("../schemas/premium");

/**
 * Mendapatkan semua user premium
 * @returns {Promise<string[]>} array of userId
 */
async function getPremiumUsers() {
    const users = await premium.find({});
    return users.map(u => u.userId);
}

/**
 * Menambahkan user ke daftar premium
 * @param {string} userId 
 */
async function addPremiumUser(userId) {
    const existing = await premium.findOne({ userId });
    if (!existing) {
        await premium.create({ userId });
    }
}

/**
 * Menghapus user dari daftar premium
 * @param {string} userId 
 */
async function removePremiumUser(userId) {
    await premium.deleteOne({ userId });
}

module.exports = {
    getPremiumUsers,
    addPremiumUser,
    removePremiumUser
};
