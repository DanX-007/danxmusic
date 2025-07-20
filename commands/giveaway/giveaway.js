const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ComponentType,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const { giveaway } = require('../../schemas/guild');
const { pickWinners, endGiveaway } = require('../../utils/giveawayUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Giveaway management commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a new giveaway')
                .addStringOption(option => option.setName('prize').setDescription('Prize to win').setRequired(true))
                .addIntegerOption(option => option.setName('winners').setDescription('Number of winners').setRequired(true))
                .addStringOption(option => option.setName('duration').setDescription('Duration (e.g. 1h, 2d)').setRequired(true))
                .addChannelOption(option => option.setName('channel').setDescription('Channel to host in').addChannelTypes(ChannelType.GuildText).setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reroll')
                .setDescription('Reroll giveaway winners')
                .addStringOption(option => option.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
                .addIntegerOption(option => option.setName('winners').setDescription('New number of winners').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('End a giveaway early')
                .addStringOption(option => option.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        ),
    
    options: { admin: true },
    
    run: async ({ interaction, client }) => {
        if (!interaction.isCommand()) return;

        // Permission check
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: '❌ You need the "Manage Messages" permission to run giveaways',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
            await handleStart(interaction, client);
        } else if (subcommand === 'reroll') {
            await handleReroll(interaction, client);
        } else if (subcommand === 'end') {
            await handleEnd(interaction, client);
        }
    }
};

async function handleStart(interaction, client) {
    const prize = interaction.options.getString('prize');
    const winners = interaction.options.getInteger('winners');
    const duration = interaction.options.getString('duration');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    // Parse duration
    const durationMs = parseDuration(duration);
    if (!durationMs) return interaction.reply({
        content: '❌ Invalid duration format. Use like 1h, 2d, 30m',
        ephemeral: true
    });

    const endTime = new Date(Date.now() + durationMs);

    try {
        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`🎉 **${prize}** 🎉`)
            .setDescription(
                `Hosted by: ${interaction.user}\n` +
                `Winners: **${winners}**\n` +
                `Ends: <t:${Math.floor(endTime.getTime()/1000)}:R>\n\n` +
                'Click the button below to enter!'
            )
            .setColor('#FFD700')
            .setFooter({ text: 'Ends at' })
            .setTimestamp(endTime);

        // Create button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join')
                .setLabel('Join Giveaway')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎉')
        );

        // Send message
        const message = await channel.send({ 
            embeds: [embed], 
            components: [row] 
        });

        // Save to database
        await giveaway.create({
            guildId: interaction.guild.id,
            channelId: channel.id,
            messageId: message.id,
            prize,
            winners,
            endTime,
            hostId: interaction.user.id,
            participants: [],
            ended: false
        });

        await interaction.reply({ 
            content: `✅ Giveaway started in ${channel}`, 
            ephemeral: true 
        });

        // Create button collector
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: durationMs
        });

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.customId !== 'giveaway_join') return;

            try {
                await buttonInteraction.deferReply({ ephemeral: true });
                
                const gw = await giveaway.findOne({ 
                    messageId: buttonInteraction.message.id,
                    ended: false
                });
                
                if (!gw) {
                    return buttonInteraction.editReply('❌ Giveaway not found or already ended');
                }
                
                if (gw.participants.includes(buttonInteraction.user.id)) {
                    return buttonInteraction.editReply('⚠️ You already joined this giveaway!');
                }
                
                gw.participants.push(buttonInteraction.user.id);
                await gw.save();
                await buttonInteraction.editReply('🎉 Successfully joined the giveaway! Good luck!');
            } catch (error) {
                console.error('Giveaway join error:', error);
                await buttonInteraction[buttonInteraction.deferred ? 'editReply' : 'reply']({
                    content: '❌ Failed to join giveaway',
                    ephemeral: true
                });
            }
        });

        collector.on('end', async () => {
            // Handle giveaway ending
            const endedGw = await giveaway.findOneAndUpdate(
                { messageId: message.id },
                { ended: true },
                { new: true }
            );

            if (endedGw) {
                // Pick winners and announce
                const winners = selectWinners(endedGw.participants, endedGw.winners);
                const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

                const endEmbed = new EmbedBuilder()
                    .setTitle(`🎉 Giveaway Ended: ${endedGw.prize}`)
                    .setDescription(
                        `Winner(s): ${winnerMentions}\n` +
                        `Participants: ${endedGw.participants.length}\n\n` +
                        `Congratulations to the winner(s)!`
                    )
                    .setColor('#00FF00')
                    .setFooter({ text: 'Giveaway ended' })
                    .setTimestamp();

                await message.edit({
                    embeds: [endEmbed],
                    components: []
                });
            }
        });

    } catch (error) {
        console.error('Giveaway error:', error);
        await interaction.reply({
            content: `❌ Failed to start giveaway: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleReroll(interaction, client) {
    const messageId = interaction.options.getString('message_id');
    const winners = interaction.options.getInteger('winners');

    try {
        const gw = await giveaway.findOne({ 
            messageId, 
            guildId: interaction.guild.id 
        });
        
        if (!gw) return interaction.reply('❌ Giveaway not found');
        if (!gw.ended) return interaction.reply('❌ Giveaway is still running');
        
        // Update jumlah pemenang jika diubah
        if (winners) gw.winners = winners;
        
        // Panggil fungsi pick winners
        await pickWinners(client, gw, true);
        
        await interaction.reply('✅ Winners rerolled successfully');
    } catch (error) {
        await interaction.reply(`❌ Failed to reroll giveaway: ${error.message}`);
    }
}

async function handleEnd(interaction, client) {
    const messageId = interaction.options.getString('message_id');

    try {
        const gw = await giveaway.findOne({ 
            messageId, 
            guildId: interaction.guild.id 
        });
        
        if (!gw) return interaction.reply('❌ Giveaway not found');
        if (gw.ended) return interaction.reply('❌ Giveaway already ended');
        
        // Panggil fungsi end giveaway
        await endGiveaway(client, gw);
        
        await interaction.reply('✅ Giveaway ended successfully');
    } catch (error) {
        await interaction.reply(`❌ Failed to end giveaway: ${error.message}`);
    }
}

function parseDuration(duration) {
    const units = {
        s: 1000,
        m: 1000 * 60,
        h: 1000 * 60 * 60,
        d: 1000 * 60 * 60 * 24
    };
    const match = duration?.match(/^(\d+)([smhd])$/);
    return match ? match[1] * units[match[2]] : null;
}

function selectWinners(participants, winnerCount) {
    if (!participants.length) return [];
    const shuffled = [...participants].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(winnerCount, shuffled.length));
}