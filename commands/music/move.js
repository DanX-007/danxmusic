const { SlashCommandBuilder, ChannelType } = require("discord.js");
const { logger } = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("move")
        .setDescription("Move all users from current voice channel to another")
        .setDMPermission(false)
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Target voice channel")
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)),

    run: async ({ interaction, client }) => {
        try {
            await interaction.deferReply();

            const member = interaction.member;
            const currentVoiceChannel = member.voice.channel;
            const targetChannel = interaction.options.getChannel("channel");

            if (!currentVoiceChannel) {
                return interaction.editReply({
                    content: "`❌` | You must be in a voice channel to use this command.",
                    ephemeral: true
                });
            }

            if (currentVoiceChannel.id === targetChannel.id) {
                return interaction.editReply({
                    content: "`❌` | You're already in that voice channel.",
                    ephemeral: true
                });
            }

            // Pindahkan semua anggota
            const members = currentVoiceChannel.members;
            let movedCount = 0;

            for (const [id, member] of members) {
                try {
                    await member.voice.setChannel(targetChannel);
                    movedCount++;
                } catch (err) {
                    logger(`Failed to move ${member.user.tag}: ${err}`, "warn");
                }
            }

            return interaction.editReply({
                content: `\`✅\` | Moved ${movedCount} user(s) to ${targetChannel}.`,
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
        premium: true,
    }
};