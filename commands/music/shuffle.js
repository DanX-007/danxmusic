const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Shuffle the current music queue")
        .setDMPermission(false),

    run: async ({ interaction, client }) => {
        try {
            await interaction.deferReply();

            const player = client.riffy.players.get(interaction.guildId);
            if (!player || !player.queue || player.queue.length < 2) {
                return interaction.editReply({
                    content: "`❌` | Queue must have at least 2 songs to shuffle.",
                    ephemeral: true
                });
            }

            // Simpan lagu yang sedang diputar
            const currentSong = player.queue.current;
            
            // Shuffle queue menggunakan Fisher-Yates algorithm
            for (let i = player.queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [player.queue[i], player.queue[j]] = [player.queue[j], player.queue[i]];
            }

            // Kembalikan lagu yang sedang diputar ke posisi pertama
            if (currentSong) {
                player.queue.unshift(currentSong);
                player.stop(); // Memainkan lagu pertama dari queue yang baru
            }

            return interaction.editReply({
                content: "`🔀` | Queue has been shuffled!",
                ephemeral: false
            });

        } catch (err) {
            logger(err, "error");
            return interaction.editReply({
                content: `\`❌\` | An error occurred: ${err.message}`,
                ephemeral: true
            });
        }
    },

    options: {
        inVoice: true,
        sameVoice: true,
        premium: true,
    }
};