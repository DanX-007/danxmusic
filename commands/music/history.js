const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logger } = require("../../utils/logger");
const { msToTime } = require("../../utils/msToTime");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("history")
        .setDescription("Show the recently played songs")
        .setDMPermission(false),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);

        try {
            const player = client.riffy.players.get(interaction.guildId);

            if (!player || !Array.isArray(player.history) || player.history.length === 0) {
                return interaction.reply({
                    embeds: [embed.setDescription("`❌` | No song history found.")],
                    ephemeral: true
                });
            }

            const historyList = player.history.slice(-10).reverse().map((track, index) =>
                `\`${index + 1}.\` [${track.info.title}](${track.info.uri}) - \`${msToTime(track.info.length)}\``
            ).join("\n");

            embed.setTitle("📜 Recently Played")
                .setDescription(historyList);

            return interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (err) {
            logger(err, "error");
            return interaction.reply({
                embeds: [embed.setDescription(`\`❌\` | An error occurred: ${err.message}`)],
                ephemeral: true
            });
        }
    },

    options: {
        inVoice: true,
        sameVoice: false // tidak harus di VC untuk melihat history
    }
};
