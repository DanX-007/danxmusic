const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("claim")
        .setDescription("Claim your rewards")
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName("daily")
                .setDescription("Claim your daily coins and XP")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("monthly")
                .setDescription("Claim your monthly reward")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("yearly")
                .setDescription("Claim your yearly reward")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("bonus")
                .setDescription("Claim bonus reward (12 hour cooldown)")
        ),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const subcommand = interaction.options.getSubcommand();

        // Reward amounts
        const REWARDS = {
            daily: { coins: 5000, xp: 100, cooldown: 24 * 60 * 60 * 1000 }, // 24 hours
            monthly: { coins: 150000, xp: 3000, cooldown: 30 * 24 * 60 * 60 * 1000 }, // 30 days
            yearly: { coins: 2000000, xp: 50000, cooldown: 365 * 24 * 60 * 60 * 1000 }, // 365 days
            bonus: { coins: 25000, xp: 500, cooldown: 12 * 60 * 60 * 1000 } // 12 hours
        };

        try {
            let userEconomy = await economy.findOne({ userId: interaction.user.id });

            if (!userEconomy) {
                userEconomy = new economy({
                    userId: interaction.user.id,
                    username: interaction.user.username
                });
            }

            // Check cooldown
            const now = new Date();
            const lastClaim = userEconomy[`last${subcommand.charAt(0).toUpperCase() + subcommand.slice(1)}`];
            
            if (lastClaim && (now - lastClaim) < REWARDS[subcommand].cooldown) {
                const nextClaim = new Date(lastClaim.getTime() + REWARDS[subcommand].cooldown);
                return interaction.reply({
                    embeds: [embed.setDescription(
                        `\`⏳\` | You've already claimed your ${subcommand} reward! Next claim available <t:${Math.floor(nextClaim.getTime() / 1000)}:R>`
                    )],
                    ephemeral: true
                });
            }

            // Give rewards
            userEconomy.balance += REWARDS[subcommand].coins;
            userEconomy.xp += REWARDS[subcommand].xp;
            userEconomy[`last${subcommand.charAt(0).toUpperCase() + subcommand.slice(1)}`] = now;
            await userEconomy.save();

            return interaction.reply({
                embeds: [embed.setDescription(
                    `\`🎉\` | You've claimed your ${subcommand} reward: **${REWARDS[subcommand].coins.toLocaleString()} coins** and **${REWARDS[subcommand].xp.toLocaleString()} xp**!\n` +
                    `New balance: **${userEconomy.balance.toLocaleString()} coins**\n` +
                    `New xp: **${userEconomy.xp.toLocaleString()} xp**`
                )]
            });

        } catch (err) {
            logger(err, "error");
            return interaction.reply({ 
                embeds: [embed.setDescription(`\`❌\` | An error occurred: ${err.message}`)], 
                ephemeral: true 
            });
        }
    },
    options: {
    verify: true
    }
};