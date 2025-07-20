const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const translate = require("bing-translate-api").translate;

// Internal configuration
const EMBED_COLORS = {
  SUCCESS: "#4CAF50",
  WARNING: "#FFC107",
  ERROR: "#F44336"
};

const LANGUAGES = {
  "ar": "Arabic",
  "zh": "Chinese",
  "en": "English",
  "fr": "French",
  "de": "German",
  "hi": "Hindi",
  "id": "Indonesian",
  "it": "Italian",
  "ja": "Japanese",
  "ko": "Korean",
  "pt": "Portuguese",
  "ru": "Russian",
  "es": "Spanish",
  "th": "Thai",
  "tr": "Turkish",
  "vi": "Vietnamese"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate text using Bing Translator")
    .addStringOption(option =>
      option
        .setName("language")
        .setDescription("Target language")
        .setRequired(true)
        .addChoices(
          ...Object.entries(LANGUAGES).map(([code, name]) => ({
            name: name,
            value: code
          })),
    ),
    )
    .addStringOption(option =>
      option
        .setName("text")
        .setDescription("Text to translate")
        .setRequired(true)
    ),

  cooldown: 15,
  run: async ({ interaction }) => {
      await interaction.deferReply();
    
    const targetLang = interaction.options.getString("language");
    const text = interaction.options.getString("text");

    try {
      // Detect source language automatically
      const translation = await translate(text, null, targetLang);
      
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.SUCCESS)
        .setTitle("🌍 Translation Result")
        .addFields(
          { name: `Original (${translation.language.from})`, value: text, inline: false },
          { name: `Translation (${LANGUAGES[targetLang]})`, value: translation.translation, inline: false }
        )
        .setFooter({ text: "Powered by Bing Translator" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Translation error:", error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setTitle("❌ Translation Failed")
        .setDescription("An error occurred while translating. Please try again later.")
        .setFooter({ text: `Error: ${error.message || "Unknown error"}` });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};