const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const playlist = require("../../schemas/playlist");
const config = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pl-rename")
    .setDescription("Rename one of your playlists")
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName("old_name")
        .setDescription("Select the playlist to rename")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName("new_name")
        .setDescription("Enter the new name for your playlist")
        .setRequired(true)
    ),

  run: async ({ interaction }) => {
    const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
    const userId = interaction.user.id;
    const oldName = interaction.options.getString("old_name").trim();
    const newName = interaction.options.getString("new_name").trim();

    if (oldName.toLowerCase() === newName.toLowerCase()) {
      return interaction.reply({
        embeds: [embed.setDescription("`⚠️` New name must be different from the old name.")],
        ephemeral: true
      });
    }

    try {
      const existing = await playlist.findOne({ userId, name: newName });
      if (existing) {
        return interaction.reply({
          embeds: [embed.setDescription("`❌` A playlist with that name already exists.")],
          ephemeral: true
        });
      }

      const target = await playlist.findOne({ userId, name: oldName });
      if (!target) {
        return interaction.reply({
          embeds: [embed.setDescription("`❌` Playlist not found.")],
          ephemeral: true
        });
      }

      target.name = newName;
      await target.save();

      return interaction.reply({
        embeds: [embed.setDescription(`\`✅\` Playlist **${oldName}** renamed to **${newName}**.`)],
        ephemeral: true
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        embeds: [embed.setDescription("`❌` An error occurred while renaming the playlist.")],
        ephemeral: true
      });
    }
  },

  autocomplete: async ({ interaction }) => {
    const focused = interaction.options.getFocused();
    const userId = interaction.user.id;

    const playlists = await playlist.find({ userId });
    const filtered = playlists
      .filter(p => p.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25);

    return interaction.respond(
      filtered.map(p => ({ name: p.name, value: p.name }))
    );
  }
};
