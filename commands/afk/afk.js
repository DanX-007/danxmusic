// commands/utility/afk.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { afk } = require("../../schemas/afk");
const moment = require("moment");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("afk")
        .setDescription("AFK related commands")
        .addSubcommand(sub =>
            sub.setName("set")
                .setDescription("Set your AFK status")
                .addStringOption(option =>
                    option.setName("reason")
                        .setDescription("Reason for being AFK")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("List all AFK members")
        ),

    run: async ({ interaction }) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "set") {
            const reason = interaction.options.getString("reason") || "No reason provided";
            const userId = interaction.user.id;
            const username = interaction.user.username;

            try {
                await afk.findOneAndUpdate(
                    { userId },
                    {
                        $set: {
                            isAfk: true,
                            afkReason: reason,
                            afkSince: new Date(),
                            username
                        }
                    },
                    { upsert: true, new: true }
                );

                const embed = new EmbedBuilder()
                    .setColor("#5865F2")
                    .setDescription(`**${interaction.user.tag}** is now AFK: ${reason}`)
                    .setFooter({ text: "You'll be marked as back when you send a message" });

                await interaction.reply({ embeds: [embed] });

            } catch (error) {
                console.error("AFK set error:", error);
                await interaction.reply({
                    content: "Failed to set AFK status",
                    ephemeral: true
                });
            }

        } else if (subcommand === "list") {
            await interaction.deferReply();

            try {
                const afkUsers = await afk.find({ isAfk: true }).limit(25);

                if (afkUsers.length === 0) {
                    return interaction.editReply({ content: "No users are currently AFK" });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🚪 AFK Members (${afkUsers.length})`)
                    .setColor("#5865F2");

                const chunks = [];
                for (let i = 0; i < afkUsers.length; i += 5) {
                    chunks.push(afkUsers.slice(i, i + 5));
                }

                chunks[0].forEach(user => {
                    const duration = moment(user.afkSince).fromNow();
                    embed.addFields({
                        name: user.username,
                        value: `• Reason: ${user.afkReason || "None"}\n• Since: ${duration}`,
                        inline: true
                    });
                });

                if (chunks.length > 1) {
                    embed.setFooter({ text: `Showing first 5 of ${afkUsers.length} AFK users` });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error("AFK list error:", error);
                await interaction.editReply({
                    content: "Failed to fetch AFK users. Please try again later."
                });
            }
        }
    },
    option: {
    verify: true
    }
};
