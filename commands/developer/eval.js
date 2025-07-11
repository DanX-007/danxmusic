const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("eval")
        .setDescription("Execute JavaScript code (dev only)")
        .addStringOption(opt =>
            opt.setName("code")
                .setDescription("The JavaScript code to execute")
                .setRequired(true)
        ),

    run: async ({ interaction }) => {
        const input = interaction.options.getString("code");

        try {
            const result = await eval(input);
            const output = typeof result === "string" ? result : require("util").inspect(result);

            await interaction.reply({
                content: `✅ **Eval Result:**\n\`\`\`js\n${output.slice(0, 1900)}\n\`\`\``,
                ephemeral: false
            });

        } catch (err) {
            logger(err, "error");
            await interaction.reply({
                content: `❌ **Error:**\n\`\`\`js\n${err.message}\n\`\`\``,
                ephemeral: true
            });
        }
    },

    options: {
        devOnly: true
    }
};
