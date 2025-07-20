const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logger } = require("../../utils/logger");
const { msToTime } = require("../../utils/msToTime");
const { progressBar } = require("../../utils/progressbar");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("Shows information about the currently playing song")
        .setDMPermission(false),

    run: async ({ client, interaction }) => {
        try {
            await interaction.deferReply();
            const player = client.riffy.players.get(interaction.guildId);

            if (!player || !player.playing) {
                return interaction.editReply({
                    content: "`❌` | There's nothing playing in this server.",
                    ephemeral: true
                });
            }

            const track = player.current;
            
            if (!track || !track.info) {
                return interaction.editReply({
                    content: "`❌` | No track found in queue.",
                    ephemeral: true
                });
            }

            const position = player.position;
            const duration = track.info.length;
            const progress = Math.round((position / duration) * 100);
            const trackThumbnail = await (track.info.thumbnail || client.user.displayAvatarURL());
            const progressBar = createProgressBar(progress);
            // Create progress bar
         //   const progressBarString = progressBar(progress, 20);

            const embed = new EmbedBuilder()
                .setColor(0x6a1b9a)
                .setTitle("🎵 Now Playing")
                .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                .setThumbnail(trackThumbnail)
                .addFields(
                    {
                        name: "Artist",
                        value: track.info.author || "Unknown",
                        inline: true
                    },
                    {
                        name: "Duration",
                        value: `${msToTime(position)} / ${msToTime(duration)}`,
                        inline: true
                    },
                    {
                        name: "Progress",
                        value: `${progressBar}\n ${progress}%`,
                        
                        inline: false
                    }
                )
                .setFooter({
                    text: `Requested by: ${track.info.requester?.username || track.info.requester?.displayName || "Unknown"}`
                });

            return interaction.editReply({
                embeds: [embed]
            });

        } catch (err) {
            logger(err, "error");
            return interaction.editReply({
                content: `\`❌\` | An error occurred: ${err.message}`,
                ephemeral: true
            });
        }
    }
};

function createProgressBar(percentage) {
    const progressBarLength = 15;
    const filled = Math.round(progressBarLength * (percentage / 100));
    return '🟩'.repeat(filled) + '⬜'.repeat(progressBarLength - filled);
}