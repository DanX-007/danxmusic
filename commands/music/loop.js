const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Toggle loop mode for current track or queue")
        .addStringOption(option =>
            option.setName("mode")
                .setDescription("Loop mode")
                .setRequired(true)
                .addChoices(
                    { name: "Track", value: "track" },
                    { name: "Queue", value: "queue" },
                    { name: "Off", value: "none" }
                ))
        .setDMPermission(false),

    run: async ({ interaction, client }) => {
        try {
            await interaction.deferReply();

            const player = client.riffy.players.get(interaction.guildId);
            if (!player) {
                return interaction.editReply({
                    content: "`❌` | No active player found.",
                    ephemeral: true
                });
            }

            const mode = interaction.options.getString("mode");
            
            // Set loop mode
            await player.setLoop(mode);

            const modeNames = {
                "track": "Track",
                "queue": "Queue", 
                "none": "Off"
            };

            return interaction.editReply({
                content: `\`🔁\` | Loop mode set to: \`${modeNames[mode]}\``,
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
        sameVoice: true
    }
};