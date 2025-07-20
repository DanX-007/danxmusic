const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");

const EMBED_COLORS = {
  URBAN: 0x1D2439,
  ERROR: 0xFF0000
};

async function fetchUrbanDefinition(term) {
  const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
  
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  
  const data = await response.json();
  if (!data.list?.length) throw new Error("No results found");
  
  const definition = data.list[0];
  const writtenDate = new Date(definition.written_on).toLocaleDateString();

  const cleanDefinition = definition.definition
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const cleanExample = definition.example
    ? definition.example
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
    : "No example provided";

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.URBAN)
    .setTitle(definition.word)
    .setURL(definition.permalink)
    .setDescription(`**Definition**\n${cleanDefinition.slice(0, 4096)}`)
    .addFields(
      {
        name: "Example",
        value: cleanExample.slice(0, 1024),
        inline: false
      },
      {
        name: "Rating",
        value: `👍 ${definition.thumbs_up} | 👎 ${definition.thumbs_down}`,
        inline: true
      },
      {
        name: "Author",
        value: definition.author || "Anonymous",
        inline: true
      }
    )
    .setFooter({ text: `Submitted on ${writtenDate}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("urban")
    .setDescription("Search Urban Dictionary")
    .addStringOption(option =>
      option
        .setName("word")
        .setDescription("Word to search")
        .setRequired(true)
    ),
  cooldown: 5,
  run: async ({ interaction }) => {
    await interaction.deferReply();
    const word = interaction.options.getString("word");

    try {
      const embed = await fetchUrbanDefinition(word);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Urban Dictionary error:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(error.message.includes("No results") 
          ? `No definitions found for \`${word}\``
          : "Failed to fetch from Urban Dictionary. Please try again later.");
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};