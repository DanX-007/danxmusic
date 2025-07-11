const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const playlist = require("../../schemas/playlist");
const { parseTimeString } = require("../../utils/parseTimeString");
const { logger } = require("../../utils/logger");
const config = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pl-list")
    .setDescription("Show all playlists you have created")
    .setDMPermission(false),

  run: async ({ interaction }) => {
    const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);

    try {
       await interaction.deferReply({ ephemeral: true }); // Changed to false to make visible to others
      const userId = interaction.user.id;
      const playlists = await playlist.find({ userId });

      if (!playlists.length)
        return interaction.editReply({
          embeds: [embed.setDescription("`❌` You don't have any playlists.")]
        });

      const pageSize = 10;
      const totalPages = Math.ceil(playlists.length / pageSize);
      let currentPage = 0;

      const generateDescription = (page) => {
        return playlists
          .slice(page * pageSize, (page + 1) * pageSize)
          .map(pl =>
            `**\`\`\`autohotkey\nName        : ${pl.name}\nSongs       : ${pl.songs.length}\nCreated At  : ${new Date(pl.created).toLocaleString()}\n\`\`\`**`
          )
          .join("\n");
      };

      const embedMessage = () =>
        embed
          .setAuthor({ name: "🎼 Your Playlists" })
          .setDescription(generateDescription(currentPage))
          .setFooter({
            text: `Page ${currentPage + 1} of ${totalPages}`,
            iconURL: interaction.user.displayAvatarURL()
          });

      // First row: navigation + list
      const rowNav = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === totalPages - 1),
        new ButtonBuilder()
          .setCustomId("open_select")
          .setLabel("📜 List Playlist")
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.editReply({
        embeds: [embedMessage()],
        components: [rowNav],
        fetchReply: true
      });

      const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: parseTimeString("90s")
      });

      collector.on("collect", async (i) => {
        if (i.customId === "next_page") currentPage++;
        if (i.customId === "prev_page") currentPage--;

        if (i.customId === "open_select") {
          const menu = new StringSelectMenuBuilder()
            .setCustomId("select_playlist")
            .setPlaceholder("🗂 Select playlist to delete")
            .addOptions(
              playlists.map((pl) => ({
                label: pl.name,
                description: `${pl.songs.length} songs`,
                value: pl.name
              }))
            );

          const rowSelect = new ActionRowBuilder().addComponents(menu);

          return i.reply({
            content: "Select a playlist to delete:",
            components: [rowSelect],
            ephemeral: true
          });
        }

        // Update navigation buttons
        rowNav.components[0].setDisabled(currentPage === 0);
        rowNav.components[1].setDisabled(currentPage === totalPages - 1);
        await i.update({ embeds: [embedMessage()], components: [rowNav] });
      });

      collector.on("end", () => {
        rowNav.components.forEach(btn => btn.setDisabled(true));
        msg.edit({ components: [rowNav] }).catch(() => {});
      });

      // Handle playlist selection + confirmation
      interaction.client.on("interactionCreate", async (select) => {
        if (
          !select.isStringSelectMenu() ||
          select.customId !== "select_playlist" ||
          select.user.id !== userId
        ) return;

        const selected = select.values[0];

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_delete_${selected}`)
            .setLabel("✅ Confirm Delete")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("cancel_delete")
            .setLabel("❌ Cancel")
            .setStyle(ButtonStyle.Secondary)
        );

        await select.update({
          content: `Are you sure you want to delete playlist **${selected}**?`,
          components: [confirmRow],
          ephemeral: true
        });

        const confirmCollector = select.channel.createMessageComponentCollector({
          filter: (btn) =>
            btn.user.id === userId &&
            (btn.customId === `confirm_delete_${selected}` || btn.customId === "cancel_delete"),
          time: parseTimeString("30s")
        });

        confirmCollector.on("collect", async (btn) => {
          if (btn.customId === `confirm_delete_${selected}`) {
            await playlist.deleteOne({ userId, name: selected });
            await btn.update({
              content: `\`✅\` Playlist **${selected}** has been deleted.`,
              components: [],
              ephemeral: true
            });
          } else {
            await btn.update({
              content: "❌ Deletion cancelled.",
              components: [],
              ephemeral: true
            });
          }
          confirmCollector.stop();
        });
      });

    } catch (err) {
      logger(err, "error");
      return interaction.editReply({
        embeds: [embed.setDescription(`\`❌\` | An error occurred: ${err.message}`)],
        ephemeral: true
      });
    }
  }
};
