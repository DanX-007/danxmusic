// commands/utility/level.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

// Perhitungan XP untuk naik level
function xpForLevel(level) {
    return 100 * Math.pow(level, 2);
}

// Membuat progress bar visual
function createProgressBar(percentage) {
    const progressBarLength = 15;
    const filled = Math.round(progressBarLength * (percentage / 100));
    return '🟩'.repeat(filled) + '⬜'.repeat(progressBarLength - filled);
}

// Lencana level
function getLevelBadge(level) {
    if (level >= 100) return '🏆';
    if (level >= 50) return '🎖️';
    if (level >= 25) return '⭐';
    if (level >= 10) return '🔹';
    return '';
}

// Hitung posisi rank pengguna
async function calculateUserRank(userId, userLevel) {
    try {
        const allUsers = await economy.find({}).sort({ level: -1, xp: -1 });
        const userIndex = allUsers.findIndex(u => u.userId === userId);
        const totalUsers = allUsers.length;

        return {
            position: userIndex + 1,
            percentile: Math.round(((totalUsers - userIndex) / totalUsers) * 100)
        };
    } catch (err) {
        return { position: '?', percentile: '?' };
    }
}

// Hitung progress XP user
function calculateLevelProgress(xp, level) {
    const currentLevelXP = xpForLevel(level);
    const nextLevelXP = xpForLevel(level + 1);
    const progress = (xp / currentLevelXP) * 100;
    const xpNeeded = currentLevelXP - xp;

    return {
        currentLevelXP,
        nextLevelXP,
        progress: Math.min(progress, 100),
        xpNeeded: Math.max(xpNeeded, 0)
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("level")
        .setDescription("Check your level or level up")
        .addSubcommand(sub =>
            sub.setName("check")
                .setDescription("Check your or another user's level")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to check")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("up")
                .setDescription("Level up if you have enough XP")
        ),

    run: async ({ interaction }) => {
        const subcommand = interaction.options.getSubcommand();
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);

        if (subcommand === "check") {
            const targetUser = interaction.options.getUser("user") || interaction.user;

            try {
                let userEconomy = await economy.findOne({ userId: targetUser.id });
                if (!userEconomy) {
                    userEconomy = new economy({
                        userId: targetUser.id,
                        username: targetUser.username
                    });
                    await userEconomy.save();
                }

                const { currentLevelXP, nextLevelXP, progress, xpNeeded } = calculateLevelProgress(
                    userEconomy.xp,
                    userEconomy.level
                );

                const progressBar = createProgressBar(progress);
                const rank = await calculateUserRank(targetUser.id, userEconomy.level);

                embed
                    .setAuthor({
                        name: `${targetUser.username}'s Level Profile`,
                        iconURL: targetUser.displayAvatarURL()
                    })
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setDescription(
                        `**Level ${userEconomy.level}** ${getLevelBadge(userEconomy.level)}\n` +
                        `XP: ${userEconomy.xp.toLocaleString()}/${currentLevelXP.toLocaleString()}\n` +
                        `${progressBar} ${progress.toFixed(1)}%\n\n` +
                        `Next level: **${userEconomy.level + 1}** (${xpNeeded.toLocaleString()} XP needed)\n` +
                        `Server Rank: **#${rank.position}** (Top ${rank.percentile}%)`
                    )
                    .setFooter({ text: "Keep chatting to earn more XP!" });

                if (progress > 80) {
                    embed.addFields({
                        name: "Level Up Soon!",
                        value: `Only ${xpNeeded.toLocaleString()} XP left to reach level ${userEconomy.level + 1}!`,
                        inline: false
                    });
                }

                return interaction.reply({ embeds: [embed] });

            } catch (err) {
                logger(err, "error");
                return interaction.reply({
                    embeds: [embed.setDescription("❌ An error occurred while checking level.")],
                    ephemeral: true
                });
            }
        }

        if (subcommand === "up") {
    try {
        let userEconomy = await economy.findOne({ userId: interaction.user.id });

        if (!userEconomy) {
            userEconomy = new economy({
                userId: interaction.user.id,
                username: interaction.user.username
            });
            await userEconomy.save();
        }

        let levelsGained = 0;
        let totalXpNeeded = 0;
        let totalReward = 0;
        let currentLevel = userEconomy.level;
        let remainingXP = userEconomy.xp;

        // Calculate how many levels can be gained
        while (remainingXP >= xpForLevel(currentLevel + levelsGained)) {
            const xpRequired = xpForLevel(currentLevel + levelsGained);
            remainingXP -= xpRequired;
            levelsGained++;
        }

        if (levelsGained === 0) {
            const xpNeeded = xpForLevel(currentLevel);
            const xpRemaining = xpNeeded - userEconomy.xp;
            return interaction.reply({
                embeds: [embed.setDescription(
                    `\`❌\` | You need **${xpRemaining.toLocaleString()} more XP** to level up!\n` +
                    `Current level: **${currentLevel}** (${userEconomy.xp.toLocaleString()}/${xpNeeded.toLocaleString()} XP)`
                )],
                ephemeral: true
            });
        }

        // Update user's level and XP
        userEconomy.level += levelsGained;
        userEconomy.xp = remainingXP;

        // Calculate reward for all levels gained (500 coins per level)
        for (let i = 0; i < levelsGained; i++) {
            totalReward += 500 * (currentLevel + i + 1);
        }
        userEconomy.balance += totalReward;

        await userEconomy.save();

        // Prepare level up message
        let levelUpMessage = `**${interaction.user.username}** has leveled up `;
        if (levelsGained > 1) {
            levelUpMessage += `**${levelsGained} times** from level ${currentLevel} to **level ${userEconomy.level}**!`;
        } else {
            levelUpMessage += `to **level ${userEconomy.level}**!`;
        }

        return interaction.reply({
            embeds: [embed
                .setAuthor({
                    name: `Level Up! 🎉`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription(
                    `${levelUpMessage}\n\n` +
                    `You received a total reward of **${totalReward.toLocaleString()} coins**!\n` +
                    `New balance: **${userEconomy.balance.toLocaleString()} coins**\n` +
                    `Remaining XP: **${remainingXP.toLocaleString()}**`
                )
            ]
        });

    } catch (err) {
        logger(err, "error");
        return interaction.reply({
            embeds: [embed.setDescription(`❌ An error occurred: ${err.message}`)],
            ephemeral: true
        });
    }
}
    },
    options: {
    verifys: true
    }
};
