const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Seek to a position in the current track (mm:ss or seconds)")
    .addStringOption(opt =>
      opt.setName("position")
        .setDescription("Target time (e.g. 1:23 or 83)")
        .setRequired(true)),
  run: async ({ interaction, client }) => {
    const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
    try {
      const input = interaction.options.getString("position");
      const match = input.match(/^(\d+):([0-5]\d)$/) || input.match(/^(\d+)$/);
      if (!match) return interaction.reply({ embeds: [embed.setDescription("❌ | Invalid format. Use mm:ss or seconds.")], ephemeral: true });

      let seconds;
      if (match.length === 3) seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      else seconds = parseInt(match[1]);

      const player = client.riffy.players.get(interaction.guildId);
      if (!player) return interaction.reply({ embeds: [embed.setDescription("❌ | No player found.")], ephemeral: true });
      if (!player.playing) return interaction.reply({ embeds: [embed.setDescription("❌ | No track is playing.")], ephemeral: true });

      const duration = player.current.info.length / 1000;
      if (seconds < 0 || seconds > duration) {
        return interaction.reply({ embeds: [embed.setDescription(`❗ | Time must be between 0 and ${Math.floor(duration)} seconds.`)], ephemeral: true });
      }

      await player.seek(seconds * 1000);
      return interaction.reply({ embeds: [embed.setDescription(`⏩ | Seeked to **${Math.floor(seconds/60)}:${String(seconds % 60).padStart(2,'0')}**`)], ephemeral: true });
    } catch (err) {
      return interaction.reply({ embeds: [embed.setDescription(`❌ | Error: ${err.message}`)], ephemeral: true });
    }
  },
  options: { inVoice: true, sameVoice: true, premium: true, }
};
