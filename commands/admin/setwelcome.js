const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { guild } = require('../../schemas/guild');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Configure welcome settings')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel for welcome messages')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Welcome message (use {user} and {server})')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to give new members')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    options: { admin: true },
    run: async ({ interaction, client }) => {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');
        const role = interaction.options.getRole('role');

        try {
            const updateData = {};
            if (channel) updateData.welcomeChannel = channel.id;
            if (message) updateData.welcomeMessage = message;
            if (role) updateData.welcomeRole = role.id;

            await guild.findOneAndUpdate(
                { guildId: interaction.guild.id },
                updateData,
                { upsert: true }
            );

            let response = "✅ Welcome settings updated:\n";
            if (channel) response += `- Channel: ${channel}\n`;
            if (message) response += `- Message: "${message}"\n`;
            if (role) response += `- Role: ${role}\n`;

            await interaction.reply(response);
        } catch (error) {
            await interaction.reply(`❌ Failed to update welcome settings: ${error.message}`);
        }
    }
};