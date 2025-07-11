const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const axios = require("axios");
const config = require("../../config");
const { parseTimeString } = require("../../utils/parseTimeString");
const { logger } = require("../../utils/logger");

function parseTimestamp(timestamp) {
  const match = timestamp.match(/(\d+):(\d{2})\.(\d+)/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const milliseconds = parseInt(match[3], 10) / Math.pow(10, match[3].length);
  return minutes * 60 + seconds + milliseconds;
}

function cleanLyrics(lyrics) {
  if (!lyrics) return '';
  return lyrics.replace(/\]/g, '').trim();
}

async function searchLyrics(query) {
  try {
    const res = await axios.get("https://lrclib.net/api/search", {
      params: { q: query },
      timeout: 5000
    });
    const result = res.data[0];
    if (result) {
      return {
        title: result.trackName || result.name,
        artist: result.artistName || result.artist,
        lyrics: cleanLyrics(result.plainLyrics || result.lyrics),
        syncedLyrics: result.syncedLyrics
      };
    }
    return null;
  } catch (err) {
    logger(`Lyrics search error: ${err.message}`, "warn");
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Display real-time synced lyrics for the current song")
    .setDMPermission(false),

  run: async ({ interaction, client }) => {
     await interaction.deferReply(); // Changed to false to make visible to others

    const player = client.riffy.players.get(interaction.guildId);
    if (!player || !player.current) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ No Music Playing")
            .setDescription("There is no song currently playing.")
        ]
      });
    }

    const track = player.current;
    const query = `${track.info.title} ${track.info.author || ""}`;
    const lyricsData = await searchLyrics(query);

    if (!lyricsData || !lyricsData.syncedLyrics) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Lyrics Not Found")
            .setDescription(`Could not find synced lyrics for **${track.info.title}**.`)
        ]
      });
    }

    const lines = lyricsData.syncedLyrics
      .split("\n")
      .map((line) => {
        const match = line.match(/(\d+:\d{2}\.\d+)\s*(.*)/);
        if (match) {
          return { time: parseTimestamp(match[1]), text: cleanLyrics(match[2]) };
        }
        return null;
      })
      .filter((line) => line && line.text);

    if (!lines.length) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Sync Error")
            .setDescription("No valid lines found in synced lyrics.")
        ]
      });
    }

    let currentIndex = 0;
    let isActive = true;

    const updateSync = async () => {
      if (!isActive || !player || !player.current) return;

      const currentTime = (typeof player.position === "number" ? player.position / 1000 : 0);
      while (currentIndex < lines.length && lines[currentIndex].time <= currentTime) {
        currentIndex++;
      }

      const halfWindow = 2;
      const startIndex = Math.max(0, currentIndex - halfWindow);
      const endIndex = Math.min(lines.length, currentIndex + halfWindow);
      const visibleLines = lines.slice(startIndex, endIndex);

      const lyricsDisplay = visibleLines
        .map((line, i) => {
          const globalIndex = startIndex + i;
          return globalIndex === currentIndex ? `🎤 **${line.text}**` : `♫ ${line.text}`;
        })
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor("Purple")
        .setTitle(`🎵 ${lyricsData.title} - ${lyricsData.artist}`)
        .setDescription(lyricsDisplay)
        .setFooter({ text: `Syncing... Line ${currentIndex + 1}/${lines.length}` });

      await interaction.editReply({ embeds: [embed] });

      if (isActive && currentIndex < lines.length) {
        setTimeout(updateSync, 800);
      }
    };

    updateSync();
  },

  options: {
    inVoice: true,
    sameVoice: true
  }
};
