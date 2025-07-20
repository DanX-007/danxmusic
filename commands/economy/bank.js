const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bank")
        .setDescription("Manage your bank account")
        .addSubcommand(subcommand =>
            subcommand.setName("balance")
                .setDescription("Check your bank balance"))
        .addSubcommand(subcommand =>
            subcommand.setName("deposit")
                .setDescription("Deposit money to your bank")
                .addIntegerOption(option =>
                    option.setName("amount")
                        .setDescription("Amount to deposit")
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName("withdraw")
                .setDescription("Withdraw money from your bank")
                .addIntegerOption(option =>
                    option.setName("amount")
                        .setDescription("Amount to withdraw")
                        .setRequired(true))),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const subcommand = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger("amount");

        try {
            let userEconomy = await economy.findOne({ userId: interaction.user.id });

            if (!userEconomy) {
                userEconomy = new Economy({
                    userId: interaction.user.id,
                    username: interaction.user.username
                });
                await userEconomy.save();
            }

            switch (subcommand) {
                case "balance":
                    return interaction.reply({
                        embeds: [embed.setDescription(
                            `\`🏦\` | **Bank Account**\n` +
                            `• Balance: **${userEconomy.bank.toLocaleString()} coins**\n` +
                            `• Capacity: **${userEconomy.bankCapacity.toLocaleString()} coins**`
                        )]
                    });

                case "deposit":
                    if (amount <= 0) {
                        return interaction.reply({
                            embeds: [embed.setDescription(`\`❌\` | Amount must be positive!`)],
                            ephemeral: true
                        });
                    }

                    if (amount > userEconomy.balance) {
                        return interaction.reply({
                            embeds: [embed.setDescription(
                                `\`❌\` | You don't have enough coins!\n` +
                                `Your balance: **${userEconomy.balance.toLocaleString()} coins**`
                            )],
                            ephemeral: true
                        });
                    }

                    if ((userEconomy.bank + amount) > userEconomy.bankCapacity) {
                        return interaction.reply({
                            embeds: [embed.setDescription(
                                `\`❌\` | Exceeds bank capacity!\n` +
                                `Bank capacity: **${userEconomy.bankCapacity.toLocaleString()} coins**`
                            )],
                            ephemeral: true
                        });
                    }

                    userEconomy.balance -= amount;
                    userEconomy.bank += amount;
                    await userEconomy.save();

                    return interaction.reply({
                        embeds: [embed.setDescription(
                            `\`✅\` | Deposited **${amount.toLocaleString()} coins** to your bank!\n` +
                            `• Wallet: **${userEconomy.balance.toLocaleString()} coins**\n` +
                            `• Bank: **${userEconomy.bank.toLocaleString()} coins**`
                        )]
                    });

                case "withdraw":
                    if (amount <= 0) {
                        return interaction.reply({
                            embeds: [embed.setDescription(`\`❌\` | Amount must be positive!`)],
                            ephemeral: true
                        });
                    }

                    if (amount > userEconomy.bank) {
                        return interaction.reply({
                            embeds: [embed.setDescription(
                                `\`❌\` | Not enough coins in your bank!\n` +
                                `Bank balance: **${userEconomy.bank.toLocaleString()} coins**`
                            )],
                            ephemeral: true
                        });
                    }

                    userEconomy.bank -= amount;
                    userEconomy.balance += amount;
                    await userEconomy.save();

                    return interaction.reply({
                        embeds: [embed.setDescription(
                            `\`✅\` | Withdrew **${amount.toLocaleString()} coins** from your bank!\n` +
                            `• Wallet: **${userEconomy.balance.toLocaleString()} coins**\n` +
                            `• Bank: **${userEconomy.bank.toLocaleString()} coins**`
                        )]
                    });

                default:
                    return interaction.reply({
                        embeds: [embed.setDescription(`\`❌\` | Invalid subcommand!`)],
                        ephemeral: true
                    });
            }

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