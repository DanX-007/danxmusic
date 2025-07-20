const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType,
    PermissionFlagsBits,
    ComponentType
} = require('discord.js');
const { ticket } = require('../../schemas/guild'); // Make sure this schema exists

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Setup ticket system in this server')
        .addChannelOption(option => 
            option.setName('category')
                .setDescription('Category for ticket channels')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    options: { admin: true },
    
    run: async ({ interaction, client }) => {
        try {
            if (!interaction.isCommand()) return;

            // Validate permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: '❌ You need the "Manage Server" permission to setup tickets',
                    ephemeral: true
                });
            }

            const category = interaction.options.getChannel('category');

            // Create the ticket panel embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎫 Support Ticket')
                .setDescription('Click the button below to create a support ticket')
                .setFooter({ text: `${interaction.guild.name} Support System` });

            // Create the ticket button
            const button = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder().addComponents(button);

            // Send the ticket panel
            await interaction.channel.send({ 
                embeds: [embed], 
                components: [row] 
            });
            
            await interaction.reply({ 
                content: '✅ Ticket system setup successfully!', 
                ephemeral: true 
            });

            // Create button collector for the panel
            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.customId === 'create_ticket'
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    await buttonInteraction.deferReply({ ephemeral: true });

                    // Check for existing open ticket
                    const existingTicket = await ticket.findOne({
                        guildId: buttonInteraction.guild.id,
                        userId: buttonInteraction.user.id,
                        status: 'open'
                    });

                    if (existingTicket) {
                        return buttonInteraction.editReply({
                            content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
                            ephemeral: true
                        });
                    }

                    // Create ticket channel
                    const channel = await buttonInteraction.guild.channels.create({
                        name: `ticket-${buttonInteraction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                        type: ChannelType.GuildText,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: buttonInteraction.guild.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: buttonInteraction.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.EmbedLinks
                                ]
                            },
                            {
                                id: client.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.SendMessages
                                ]
                            }
                        ]
                    });

                    // Create ticket in database
                    await ticket.create({
                        guildId: buttonInteraction.guild.id,
                        channelId: channel.id,
                        userId: buttonInteraction.user.id,
                        status: 'open',
                        createdAt: new Date()
                    });

                    // Create ticket welcome message
                    const ticketEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`🎫 Ticket - ${buttonInteraction.user.tag}`)
                        .setDescription('Support will be with you shortly\n\nClick 🔒 to close this ticket')
                        .setFooter({ text: `Ticket ID: ${channel.id}` });

                    const closeButton = new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒');

                    const closeRow = new ActionRowBuilder().addComponents(closeButton);

                    await channel.send({
                        content: `${buttonInteraction.user} Welcome to your ticket!`,
                        embeds: [ticketEmbed],
                        components: [closeRow]
                    });

                    await buttonInteraction.editReply({
                        content: `✅ Ticket created: ${channel}`,
                        ephemeral: true
                    });

                    // Create button collector for the ticket
                    const ticketCollector = channel.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        filter: i => i.customId === 'close_ticket'
                    });

                    ticketCollector.on('collect', async (closeInteraction) => {
                        try {
                            await closeInteraction.deferReply({ ephemeral: true });

                            const ticketData = await ticket.findOne({ 
                                channelId: closeInteraction.channel.id 
                            });

                            if (!ticketData) {
                                return closeInteraction.editReply({
                                    content: '❌ This is not a valid ticket',
                                    ephemeral: true
                                });
                            }

                            // Update ticket status
                            await ticket.updateOne(
                                { channelId: closeInteraction.channel.id },
                                { 
                                    status: 'closed', 
                                    closedAt: new Date(),
                                    closedBy: closeInteraction.user.id
                                }
                            );

                            // Create log embed
                            const logEmbed = new EmbedBuilder()
                                .setColor('#FF0000')
                                .setTitle('🎫 Ticket Closed')
                                .addFields(
                                    { name: 'User', value: `<@${ticketData.userId}>`, inline: true },
                                    { name: 'Opened', value: `<t:${Math.floor(ticketData.createdAt.getTime()/1000)}:R>`, inline: true },
                                    { name: 'Closed by', value: closeInteraction.user.tag, inline: true },
                                    { name: 'Duration', value: formatDuration(new Date() - ticketData.createdAt), inline: true }
                                )
                                .setFooter({ text: `Ticket ID: ${ticketData.channelId}` });

                            // Find or create log channel
                            let logChannel = closeInteraction.guild.channels.cache.find(
                                c => c.name === 'ticket-logs' && c.type === ChannelType.GuildText
                            );

                            if (!logChannel) {
                                logChannel = await closeInteraction.guild.channels.create({
                                    name: 'ticket-logs',
                                    type: ChannelType.GuildText,
                                    permissionOverwrites: [
                                        {
                                            id: closeInteraction.guild.id,
                                            deny: [PermissionFlagsBits.SendMessages]
                                        },
                                        {
                                            id: client.user.id,
                                            allow: [
                                                PermissionFlagsBits.ViewChannel,
                                                PermissionFlagsBits.SendMessages,
                                                PermissionFlagsBits.EmbedLinks
                                            ]
                                        }
                                    ]
                                });
                            }

                            // Send log and delete channel
                            await logChannel.send({ embeds: [logEmbed] });
                            await closeInteraction.channel.delete('Ticket closed by user');
                            
                        } catch (error) {
                            console.error('Close ticket error:', error);
                            await closeInteraction.editReply({
                                content: '❌ Failed to close ticket',
                                ephemeral: true
                            });
                        }
                    });

                } catch (error) {
                    console.error('Ticket creation error:', error);
                    await buttonInteraction.editReply({
                        content: '❌ Failed to create ticket',
                        ephemeral: true
                    });
                }
            });

        } catch (error) {
            console.error('Ticket setup error:', error);
            await interaction.reply({ 
                content: '❌ Failed to setup ticket system', 
                ephemeral: true 
            });
        }
    }
};

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}