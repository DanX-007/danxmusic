const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { guild } = require('../../schemas/guild');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute or unmute a user')
    .addUserOption(option => option.setName('user').setDescription('User to mute/unmute').setRequired(true))
    .addBooleanOption(option => option.setName('state').setDescription('True to mute, false to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const user = interaction.options.getUser('user');
    const state = interaction.options.getBoolean('state');

    try {
      const guildData = await guild.findOne({ guildId: interaction.guild.id });
      if (!guildData?.muteRole) {
        return await interaction.reply('❌ Mute role not set up. Use /setupmute first.');
      }

      const member = await interaction.guild.members.fetch(user.id);
      if (state) {
        await member.roles.add(guildData.muteRole);
        await interaction.reply(`✅ Muted ${user.tag}`);
        await logAction(interaction.guild.id, `${interaction.user.tag} muted ${user.tag}`);
      } else {
        await member.roles.remove(guildData.muteRole);
        await interaction.reply(`✅ Unmuted ${user.tag}`);
        await logAction(interaction.guild.id, `${interaction.user.tag} unmuted ${user.tag}`);
      }
    } catch (error) {
      await interaction.reply(`❌ Failed to ${state ? 'mute' : 'unmute'} user: ${error.message}`);
    }
  }
};