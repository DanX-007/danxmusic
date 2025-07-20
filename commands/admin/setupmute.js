const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { guild } = require('../../schemas/guild');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupmute')
    .setDescription('Set up mute role for the server')
    .addRoleOption(option => option.setName('role').setDescription('Role to use for muting').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const role = interaction.options.getRole('role');

    try {
      await guild.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { muteRole: role.id },
        { upsert: true }
      );

      await interaction.reply(`✅ Mute role set to ${role.name}`);
      await logAction(interaction.guild.id, `${interaction.user.tag} set mute role to ${role.name}`);
    } catch (error) {
      await interaction.reply(`❌ Failed to set mute role: ${error.message}`);
    }
  }
};