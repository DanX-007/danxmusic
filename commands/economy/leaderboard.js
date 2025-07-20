const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Show economy leaderboard")
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Ranking based on")
                .addChoices(
    { name: "Wallet Balance", value: "balance" },
    { name: "Bank Balance", value: "bank" },
    { name: "Net Worth", value: "networth" },
    { name: "XP", value: "xp" },
    { name: "Level", value: "level" },
    { name: "Attack", value: "attack" },
    { name: "Defense", value: "defense" }
)
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("limit")
                .setDescription("Number of users to show (default: 10)")
                .setMinValue(5)
                .setMaxValue(25)),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const type = interaction.options.getString("type");
        const limit = interaction.options.getInteger("limit") || 10;

        try {
            // Dapatkan data ekonomi semua user
            let users = await economy.find({}).sort({ createdAt: 1 }).lean();

            // Proses data untuk leaderboard
            if (type === "networth") {
                users = users.map(user => ({
                    ...user,
                    networth: user.balance + user.bank
                })).sort((a, b) => b.networth - a.networth);
            } else {
                users.sort((a, b) => b[type] - a[type]);
            }

            // Ambil top users
            const topUsers = users.slice(0, limit);

            // Buat deskripsi leaderboard
            let description = "";
            let rankEmojis = ["🥇", "🥈", "🥉", ...Array.from({ length: 7 }, (_, i) => `${i + 4}️⃣`)];

            topUsers.forEach((user, index) => {
                const value = type === "networth" ? user.networth : user[type];
                const emoji = rankEmojis[index] || ` ${index + 1}.`;
                description += `${emoji} **${user.username}** - ${value.toLocaleString()} coins\n`;
            });

            // Cek posisi user yang memerintah
            const requesterIndex = users.findIndex(u => u.userId === interaction.user.id);
            if (requesterIndex >= 0) {
                const requester = users[requesterIndex];
                const requesterValue = type === "networth" ? requester.networth : requester[type];
                description += `\n🏅 **Your Position**: #${requesterIndex + 1} (${requesterValue.toLocaleString()} coins)`;
            }

            // Tentukan judul berdasarkan tipe
            let title;
            switch (type) {
                case "balance":
                    title = "💰 Wallet Balance Leaderboard";
                    break;
                case "bank":
                    title = "🏦 Bank Balance Leaderboard";
                    break;
                case "networth":
                    title = "📊 Net Worth Leaderboard";
                    break;
                case "xp":
                    title = "🌟 XP Leaderboard";
                    break;
                case "level":
                    title = "🏆 Level Leaderboard";
                    break;
                case "attack":
                    title = "💪 Attack Leaderboard";
                    break;
                case "defense":
                    title = "🛡️ Defense Leaderboard";
                    break;
            }

            return interaction.reply({
                embeds: [embed
                    .setTitle(title)
                    .setDescription(description)
                    .setFooter({ text: `Showing top ${limit} users` })
                    .setTimestamp()
                ]
            });

        } catch (err) {
            logger(err, "error");
            return interaction.reply({ 
                embeds: [embed.setDescription(`\`❌\` | An error occurred: ${err.message}`)], 
                ephemeral: true 
            });
        }
    }
};