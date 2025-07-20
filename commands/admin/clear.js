const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages in this channel')
    .addIntegerOption(option => 
      option.setName('amount')
        .setDescription('Number of messages to clear (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const amount = interaction.options.getInteger('amount');

    try {
      await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `✅ Cleared ${amount} messages`, ephemeral: true });
      await logAction(interaction.guild.id, `${interaction.user.tag} cleared ${amount} messages in #${interaction.channel.name}`);
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to clear messages: ${error.message}`, ephemeral: true });
    }
  }
};