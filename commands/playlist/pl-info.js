const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { parseTimeString } = require("../../utils/parseTimeString");
const { logger } = require("../../utils/logger");
const formatDuration = require("../../utils/formatDuration");
const playlist = require("../../schemas/playlist");
const config = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pl-info")
    .setDescription("Show detailed info of a saved playlist")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Select your playlist name")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  run: async ({ interaction }) => {
    const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor || "#8e44ad");

    try {
       await interaction.deferReply({ ephemeral: true }); // Changed to false to make visible to others
      await interaction.editReply({
        embeds: [embed.setDescription("🔎 Loading playlist data...")],
      });

      const userId = interaction.user.id;
      const playlistName = interaction.options.getString("name");

      let selectedPlaylist = await playlist.findOne({ userId, name: playlistName });

      if (!selectedPlaylist)
        return interaction.editReply({
          embeds: [embed.setDescription("❌ Playlist not found.")],
        });

      if (!selectedPlaylist.songs?.length)
        return interaction.editReply({
          embeds: [embed.setDescription("⚠️ Playlist has no songs.")],
        });

      const songsPerPage = 10;
      let currentPage = 0;

      const totalPages = () =>
        Math.ceil(selectedPlaylist.songs.length / songsPerPage);

      const generateSongList = (page) => {
        const start = page * songsPerPage;
        const end = Math.min(start + songsPerPage, selectedPlaylist.songs.length);
        return selectedPlaylist.songs.slice(start, end).map((song, index) =>
          [
            `\`\`\`yaml`,
            `${start + index + 1}. ${song.title}`,
            `Duration: ${formatDuration(song.time)}`,
            `\`\`\``
          ].join("\n")
        ).join("\n");
      };

      const buildButtons = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setEmoji("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setEmoji("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages() - 1),
     /*   new ButtonBuilder()
          .setCustomId("delete_song")
          .setEmoji("🗑️")
          .setStyle(ButtonStyle.Danger)*/
      );

      const buildSelectMenu = () => {
        const start = currentPage * songsPerPage;
        const end = Math.min(start + songsPerPage, selectedPlaylist.songs.length);
        const options = selectedPlaylist.songs.slice(start, end).map((song, idx) => ({
          label: `${song.title}`,
          value: `${start + idx}`
        }));
        return new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("delete_song_select")
            .setPlaceholder("🎶 Select a song to delete")
            .addOptions(options)
        );
      };

      const getEmbedPage = () =>
        embed
          .setTitle("🎶 Playlist Info")
          .setDescription(generateSongList(currentPage) || "_(empty)_")
          .setFooter({
            text: `📁 ${selectedPlaylist.name} • Page ${currentPage + 1} of ${totalPages()}`,
            iconURL: interaction.user.displayAvatarURL(),
          })

      const rowButtons = buildButtons();
      const rowSelect = buildSelectMenu();

      const reply = await interaction.editReply({
        embeds: [getEmbedPage()],
        components: [rowButtons, rowSelect],
        fetchReply: true,
      });

      const collector = reply.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: parseTimeString("90s"),
      });

      collector.on("collect", async (i) => {
        try {
          await i.deferUpdate();

          if (i.customId === "prev_page") currentPage--;
          if (i.customId === "next_page") currentPage++;
     //     if (i.customId === "delete_song") return; // ignore button itself

          if (i.customId === "delete_song_select") {
            const index = parseInt(i.values[0]);
            const deletedSong = selectedPlaylist.songs.splice(index, 1)[0];
            await selectedPlaylist.save();

            await interaction.followUp({
              content: `🗑️ Removed **${deletedSong.title}** from playlist.`,
              ephemeral: true,
            });

            // Adjust page if needed
            if (currentPage >= totalPages()) currentPage = Math.max(0, totalPages() - 1);
          }

          // Update display
          const updatedRow = buildButtons();
          const updatedSelect = buildSelectMenu();

          await i.editReply({
            embeds: [getEmbedPage()],
            components:
              selectedPlaylist.songs.length > 0 ? [updatedRow, updatedSelect] : [],
          });
        } catch (err) {
          logger(err, "error");
        }
      });

      collector.on("end", () => {
        rowButtons.components.forEach((btn) => btn.setDisabled(true));
        interaction.editReply({ components: [rowButtons] }).catch(() => {});
      });
    } catch (err) {
      logger(err, "error");
      return interaction.editReply({
        embeds: [embed.setColor("Red").setDescription(`❌ Error: ${err.message}`)],
        ephemeral: true,
      });
    }
  },

  autocomplete: async ({ interaction }) => {
    const focused = interaction.options.getFocused();
    if (focused.length < 2) return;

    try {
      const userPlaylists = await playlist.find({ userId: interaction.user.id });
      const filtered = userPlaylists
        .filter((pl) => pl.name.toLowerCase().includes(focused.toLowerCase()))
        .map((pl) => ({
          name: pl.name,
          value: pl.name,
        }));
      await interaction.respond(filtered.slice(0, 10));
    } catch {
      // ignore
    }
  },
};
