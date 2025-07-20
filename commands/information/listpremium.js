const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const PremiumUser = require("../../schemas/premium"); // Pastikan path benar
const config = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("listpremium")
    .setDescription("Melihat semua user premium"),

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply();

      const premiumUsers = await PremiumUser.find(); // Ambil semua user premium dari database

      if (!premiumUsers.length) {
        return interaction.editReply({
          content: "❌ | Tidak ada user premium saat ini.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("👑 Premium Users")
        .setColor(config.clientOptions?.embedColor || 0x00aeff)
        .setDescription(
          premiumUsers
            .map((user, i) => `\`${i + 1}.\` <@${user.userId}> | \`ID: ${user.userId}\``)
            .join("\n")
        )
        .setFooter({ text: `Total: ${premiumUsers.length} user premium` });

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply({
        content: `❌ | Terjadi error: ${err.message}`,
        ephemeral: true
      });
    }
  },

  options: {
    devOnly: true // Hanya dev yang bisa pakai
  }
};
