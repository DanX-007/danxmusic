const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("server-list")
        .setDescription("Show all servers the bot is in (dev only)"),

    run: async ({ interaction, client }) => {
        const guilds = client.guilds.cache;

        if (!guilds.size) {
            return interaction.reply({ content: "❌ No servers found.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(config.clientOptions.embedColor || 0x5865f2)
            .setTitle("🛡️ Bot Server List")
            .setDescription(`Total Servers: **${guilds.size}**\n` +
                guilds.map(g => `**• ${g.name}**\nID: \`${g.id}\`\nMembers: \`${g.memberCount || "?"}\``).join("\n\n")
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },

    options: {
        devOnly: true
    }
};
