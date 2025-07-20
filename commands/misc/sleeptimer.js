const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { logger } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sleeptimer')
        .setDescription('Set a timer to automatically stop music playback')
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration before stopping (e.g. 1h 30m 45s)')
                .setRequired(true)
        ),

    options: {
        premium: true,
        inVoice: true,
        sameVoice: true
    },

    run: async ({ interaction, client }) => {
        try {
            await interaction.deferReply({ ephemeral: true }); // Defer first
            
            const duration = interaction.options.getString('duration');
            const ms = await parseTime(duration);
            const user = interaction.user;

            if (!ms || ms <= 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('❌ Invalid Time Format')
                    .setDescription('Please use format like `1h`, `30m`, `45s`, or combinations');
                
                return interaction.editReply({ embeds: [errorEmbed] }); // Changed to editReply
            }

            // Max 6 hours duration for music
            if (ms > 21600000) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('❌ Duration Too Long')
                            .setDescription('Maximum sleep timer duration is 6 hours')
                    ]
                });
            }

            const player = client.riffy.players.get(interaction.guildId);
            if (!player || !player.queue) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('❌ No Player Found')
                            .setDescription('There is no music playing in this server')
                    ]
                });
            }

            const formattedTime = duration.replace(/([a-z])/gi, '$1 ');
            const endTime = Math.floor((Date.now() + ms) / 1000);

            // Initial response
            const timerEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('⏳ Music Sleep Timer Started')
                .setDescription(`Player will stop automatically at <t:${endTime}:t> (<t:${endTime}:R>)`)
                .addFields(
                    { name: 'Duration', value: formattedTime, inline: true },
                    { name: 'Queue', value: `${player.queue.length} tracks`, inline: true }
                )
                .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() });

            await interaction.editReply({ embeds: [timerEmbed], ephemeral: false });

            // Set the timeout
            setTimeout(async () => {
                try {
                    let actionTaken = false;
                    const resultEmbed = new EmbedBuilder().setColor(0x2ecc71);

                    // Check if player still exists and is playing
                    const currentPlayer = client.riffy.players.get(interaction.guildId);
                    if (currentPlayer?.playing) {
                       await currentPlayer.stop();
                       currentPlayer.queue.clear();
                       // await currentPlayer.paused = true;
                        actionTaken = true;
                        
                        resultEmbed
                            .setTitle('🌙 Music Stopped')
                            .setDescription(`Sleep timer completed\nClear the music queue`);
                    } else {
                        resultEmbed
                            .setTitle('⏲️ Timer Completed')
                            .setDescription('Sleep timer ended but no music was playing');
                    }

                    await interaction.followUp({ 
                        embeds: [resultEmbed],
                        ephemeral: false
                    });

                } catch (error) {
                    logger(`SleepTimer Error: ${error.message}`, 'error');
                    await interaction.followUp({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xe74c3c)
                                .setTitle('❌ Timer Error')
                                .setDescription('Failed to stop player automatically')
                        ],
                        ephemeral: true
                    });
                }
            }, ms);
        } catch (error) {
            logger(`SleepTimer Command Error: ${error.message}`, 'error');
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('❌ Command Error')
                            .setDescription('An error occurred while setting the sleep timer')
                    ]
                });
            } else {
                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('❌ Command Error')
                            .setDescription('An error occurred while setting the sleep timer')
                    ],
                    ephemeral: true
                });
            }
        }
    }
};

async function parseTime(timeStr) {
    const timePattern = /(\d+)(h|m|s)/g;
    let match;
    let totalMs = 0;

    while ((match = timePattern.exec(timeStr)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];
        if (unit === 'h') totalMs += value * 60 * 60 * 1000;
        else if (unit === 'm') totalMs += value * 60 * 1000;
        else if (unit === 's') totalMs += value * 1000;
    }

    return totalMs;
}