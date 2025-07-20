const {
    SlashCommandBuilder,
} = require("discord.js");
const { logger } = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue-move")
        .setDescription("Move a song to a different position in the queue")
        .addIntegerOption(opt =>
            opt.setName("from")
                .setDescription("The number of the song you want to move")
                .setRequired(true))
        .addIntegerOption(opt =>
            opt.setName("to")
                .setDescription("The position to move the song to")
                .setRequired(true))
        .setDMPermission(false),

    run: async ({ interaction, client }) => {
        try {
            const fromIndex = interaction.options.getInteger("from") - 1;
            const toIndex = interaction.options.getInteger("to") - 1;
            const player = client.riffy.players.get(interaction.guildId);

            if (!player || !player.queue || player.queue.length === 0) {
                return interaction.reply({ content: "`❌` | The queue is empty.", ephemeral: true });
            }

            if (fromIndex < 0 || fromIndex >= player.queue.length || toIndex < 0 || toIndex >= player.queue.length) {
                return interaction.reply({ content: "`❌` | Invalid positions.", ephemeral: true });
            }

            const [movedSong] = player.queue.splice(fromIndex, 1);
            player.queue.splice(toIndex, 0, movedSong);

            return interaction.reply({
                content: `✅ | Moved **${movedSong.info.title}** from position \`${fromIndex + 1}\` to \`${toIndex + 1}\`.`,
                ephemeral: true
            });

        } catch (err) {
            logger(err, "error");
            return interaction.reply({ content: `\`❌\` | An error occurred: ${err.message}`, ephemeral: true });
        }
    },

    options: {
        inVoice: true,
        sameVoice: true,
      premium: true,
    }
};
