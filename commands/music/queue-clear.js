const {
    SlashCommandBuilder,
} = require("discord.js");
const { logger } = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue-clear")
        .setDescription("Clear all songs in the queue (except the currently playing song)")
        .setDMPermission(false),

    run: async ({ interaction, client }) => {
        try {
            const player = client.riffy.players.get(interaction.guildId);
            if (!player || !player.queue || player.queue.length === 0) {
                return interaction.reply({ content: "`❌` | Nothing to clear.", ephemeral: true });
            }

            player.queue = [];

            return interaction.reply({ content: "`🗑️` | Queue has been cleared.", ephemeral: true });

        } catch (err) {
            logger(err, "error");
            return interaction.reply({ content: `\`❌\` | An error occurred: ${err.message}`, ephemeral: true });
        }
    },

    options: {
        inVoice: true,
        sameVoice: true
    }
};
