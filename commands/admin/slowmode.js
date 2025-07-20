const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmodes')
    .setDescription('Set slowmode for this channel')
    .addIntegerOption(option => 
      option.setName('seconds')
        .setDescription('Slowmode duration in seconds (0-21600)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const seconds = interaction.options.getInteger('seconds');

    try {
      await interaction.channel.setRateLimitPerUser(seconds);
      await interaction.reply(`✅ Set slowmode to ${seconds} seconds`);
      await logAction(interaction.guild.id, `${interaction.user.tag} set slowmode to ${seconds}s in #${interaction.channel.name}`);
    } catch (error) {
      await interaction.reply(`❌ Failed to set slowmode: ${error.message}`);
    }
  }
};