const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option => option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.kick(user, reason);
      await interaction.reply(`✅ Kicked ${user.tag}. Reason: ${reason}`);
      await logAction(interaction.guild.id, `${interaction.user.tag} kicked ${user.tag}. Reason: ${reason}`);
    } catch (error) {
      await interaction.reply(`❌ Failed to kick user: ${error.message}`);
    }
  }
};