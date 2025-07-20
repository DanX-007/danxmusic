const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { guild } = require('../../schemas/guild');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    try {
      // Add warning to database
      await guild.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { $push: { warns: { userId: user.id, moderatorId: interaction.user.id, reason } } },
        { upsert: true }
      );

      // Get total warnings
      const guildData = await guild.findOne({ guildId: interaction.guild.id });
      const userWarns = guildData?.warns?.filter(w => w.userId === user.id) || [];
      
      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('⚠️ User Warned')
        .setDescription(`${user.tag} has been warned`)
        .addFields(
          { name: 'Reason', value: reason },
          { name: 'Total Warnings', value: userWarns.length.toString() }
        );

      await interaction.reply({ embeds: [embed] });
      await logAction(interaction.guild.id, `${interaction.user.tag} warned ${user.tag}. Reason: ${reason}. Total warns: ${userWarns.length}`);
    } catch (error) {
      await interaction.reply(`❌ Failed to warn user: ${error.message}`);
    }
  }
};