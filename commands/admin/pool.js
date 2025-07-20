const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(option => option.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(option => option.setName('options').setDescription('Comma-separated options (max 5)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const question = interaction.options.getString('question');
    const options = interaction.options.getString('options').split(',').slice(0, 5).map(opt => opt.trim());

    if (options.length < 2) {
      return await interaction.reply('❌ You need at least 2 options for a poll');
    }

    try {
      // Create buttons for each option
      const buttons = options.map((option, index) => 
        new ButtonBuilder()
          .setCustomId(`poll_${index}`)
          .setLabel(option)
          .setStyle(ButtonStyle.Primary)
      );

      const row = new ActionRowBuilder().addComponents(buttons);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(question)
        .setDescription('Vote using the buttons below:')
        .addFields(
          options.map((option, index) => ({
            name: `Option ${index + 1}`,
            value: option,
            inline: true
          }))
        );

      await interaction.reply({ embeds: [embed], components: [row] });
      await logAction(interaction.guild.id, `${interaction.user.tag} created a poll: "${question}"`);
    } catch (error) {
      await interaction.reply(`❌ Failed to create poll: ${error.message}`);
    }
  }
};