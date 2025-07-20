const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logger } = require("../../utils/logger");
const axios = require('axios');

const GROQ_API_KEY = '';

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ai")
        .setDescription("Interact with an AI assistant")
        .addStringOption(opt =>
            opt.setName("prompt")
                .setDescription("Your question or prompt for the AI")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("model")
                .setDescription("The AI model to use")
                .setRequired(false)
                .addChoices(
                    { name: "Qwen 32B", value: "qwen-qwq-32b" },
                    { name: "Mixtral 8x7B", value: "mixtral-8x7b-32768" },
                    { name: "Llama3 70B", value: "llama3-70b-8192" },
                    { name: "Llama3 8B", value: "llama3-8b-8192" },
                    { name: "Gemma 7B", value: "gemma-7b-it" }
                )
        ),

    run: async ({ interaction }) => {
        await interaction.deferReply({ ephemeral: true }); // Changed to false to make visible to others
        
        const prompt = interaction.options.getString("prompt");
        const model = interaction.options.getString("model") || "llama3-70b-8192";
        const user = interaction.user;
        
        try {
            // Create initial "thinking" embed
            const thinkingEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("🤖 AI is thinking...")
                .setDescription(`Processing your request with ${model} model`)
                .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [thinkingEmbed] });

            // Call Groq API
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message.content;
            
            // Create result embed
            const resultEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("🤖 AI Response")
                .addFields(
                    { name: "Model", value: model, inline: true },
                    { name: "Prompt", value: `\`\`\`${prompt.slice(0, 1000)}\`\`\`` }
                )
                .setDescription(`\`\`\`${aiResponse.slice(0, 4000)}\`\`\``)
                .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [resultEmbed],
                content: `${user} Here's your AI response:`,
            });

        } catch (err) {
            logger(err, "error");
            const errorMessage = err.response?.data?.error?.message || err.message;
            
            // Create error embed
            const errorEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("❌ AI Error")
                .setDescription(`\`\`\`${errorMessage.slice(0, 4000)}\`\`\``)
                .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [errorEmbed],
                content: `${user} Sorry, there was an error:`
            });
        }
    },

    options: {
        premium: true
    }
};