const { logger } = require("../../../utils/logger");
const colors = require("colors");

module.exports = (client) => {
    // Hanya menampilkan log bahwa bot sudah online
    logger(`Successfully logged in as ${colors.red(`[${client.user.tag}]`)}`, "debug");
    
    // Tidak ada pengaturan presence/activities di sini
};