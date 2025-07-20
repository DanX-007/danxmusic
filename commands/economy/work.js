const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

// Job types with different reward ranges
const JOBS = {
    MINER: { min: 50, max: 150, emoji: "⛏️" },
    FISHER: { min: 40, max: 120, emoji: "🎣" },
    FARMER: { min: 30, max: 100, emoji: "👨‍🌾" },
    PROGRAMMER: { min: 80, max: 250, emoji: "💻" },
    CHEF: { min: 60, max: 180, emoji: "👨‍🍳" }
};

// Cooldown in hours
const WORK_COOLDOWN = 12;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("work")
        .setDescription("Work to earn coins")
        .addStringOption(option =>
            option.setName("job")
                .setDescription("Choose your job")
                .setRequired(true)
                .addChoices(
                    { name: "Miner ⛏️", value: "MINER" },
                    { name: "Fisher 🎣", value: "FISHER" },
                    { name: "Farmer 👨‍🌾", value: "FARMER" },
                    { name: "Programmer 💻", value: "PROGRAMMER" },
                    { name: "Chef 👨‍🍳", value: "CHEF" }
                )),

    run: async ({ interaction }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const jobType = interaction.options.getString("job");
        const job = JOBS[jobType];

        try {
            // Get user economy data
            let userEconomy = await economy.findOne({ userId: interaction.user.id });
            if (!userEconomy) {
                userEconomy = new economy({
                    userId: interaction.user.id,
                    username: interaction.user.username
                });
            }

            // Check cooldown
            const now = new Date();
            if (userEconomy.lastWork && (now - userEconomy.lastWork) < WORK_COOLDOWN * 3600000) {
                const nextWork = new Date(userEconomy.lastWork.getTime() + WORK_COOLDOWN * 3600000);
                return interaction.reply({
                    embeds: [embed.setDescription(
                        `⏳ You can work again <t:${Math.floor(nextWork.getTime() / 1000)}:R>\n` +
                        `Cooldown: ${WORK_COOLDOWN} hours`
                    )],
                    ephemeral: true
                });
            }

            // Calculate earnings
            const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
            const bonus = Math.random() < 0.1 ? Math.floor(earnings * 0.5) : 0; // 10% chance for bonus
            const totalEarned = earnings + bonus;

            // Update user data
            userEconomy.balance += totalEarned;
            userEconomy.lastWork = now;
            await userEconomy.save();

            // Build response
            embed.setTitle(`${job.emoji} ${jobType.charAt(0) + jobType.slice(1).toLowerCase()} Work`)
                .setDescription(`You earned **${totalEarned.toLocaleString()} coins**!`)
                .addFields(
                    { name: "Base Pay", value: `${earnings.toLocaleString()} coins`, inline: true },
                    { name: "Bonus", value: bonus > 0 ? `+${bonus.toLocaleString()} coins` : "None", inline: true }
                )
                .setFooter({ text: `Next work available in ${WORK_COOLDOWN} hours` });

            await interaction.reply({ embeds: [embed] });

        } catch (err) {
            logger(err, "error");
            await interaction.reply({
                embeds: [embed.setDescription("❌ An error occurred while processing your work")],
                ephemeral: true
            });
        }
    },
    options: {
    verify: true
    }
};