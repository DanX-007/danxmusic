const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { guild } = require('../../schemas/guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkwelcome')
        .setDescription('Check current welcome settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    options: { admin: true },
    run: async ({ interaction, client }) => {
        try {
            const guildData = await guild.findOne({ guildId: interaction.guild.id });
            if (!guildData) {
                return await interaction.reply('ℹ️ No welcome settings configured yet.');
            }

            const embed = new EmbedBuilder()
                .setTitle('Welcome Settings')
                .setColor('#0099ff')
                .addFields(
                    {
                        name: 'Welcome Channel',
                        value: guildData.welcomeChannel 
                            ? `<#${guildData.welcomeChannel}>` 
                            : 'Not set',
                        inline: true
                    },
                    {
                        name: 'Welcome Role',
                        value: guildData.welcomeRole 
                            ? `<@&${guildData.welcomeRole}>` 
                            : 'Not set',
                        inline: true
                    },
                    {
                        name: 'Welcome Message',
                        value: guildData.welcomeMessage || 'Not set'
                    }
                );

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply(`❌ Failed to check welcome settings: ${error.message}`);
        }
    }
};