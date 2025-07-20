// utils/permissionHandler.js
const { getPremiumUsers } = require("../utils/premiumManager");
const config = require("../config");
const { economy } = require("../schemas/economy");

module.exports = async ({ interaction, commandObj }) => {
    if (interaction.isAutocomplete() || interaction.isButton()) return;

    // Check admin permission
    if (commandObj.options?.admin) {
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
            return handlePermissionError(interaction, "This command requires administrator permissions");
        }
    }

    // Check premium permission
    if (commandObj.options?.premium) {
        const isDev = interaction.user.id === "1373949053414670396";
        if (!isDev) {
            const premiumUsers = await getPremiumUsers();
            if (!premiumUsers.includes(interaction.user.id)) {
                return handlePermissionError(interaction, "This command is only available to premium users");
            }
        }
    }

    // Check verification status
    if (commandObj.options?.verify) {
        try {
            const userEconomy = await economy.findOne({ userId: interaction.user.id });
            if (!userEconomy || !userEconomy.verify) {
                return handlePermissionError(interaction, "Kamu belum terdaftar! Daftar dengan cara /setup");
            }
        } catch (error) {
            console.error("Error checking verification status:", error);
            return handlePermissionError(interaction, "Terjadi kesalahan saat memeriksa status verifikasi");
        }
    }
};

function handlePermissionError(interaction, message) {
    const content = `\`🔒\` | ${message}`;
    return interaction.deferred
        ? interaction.editReply({ content, ephemeral: true })
        : interaction.reply({ content, ephemeral: true });
}