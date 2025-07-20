const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add")
        .setDescription("Add resources to user accounts")
        .addSubcommand(subcommand =>
            subcommand
                .setName("balance")
                .setDescription("Add wallet balance to a user")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to add balance to")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("amount")
                        .setDescription("Amount to add")
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("xp")
                .setDescription("Add XP to a user")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to add XP to")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("amount")
                        .setDescription("Amount of XP to add")
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("level")
                .setDescription("Add levels to a user")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to add levels to")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("amount")
                        .setDescription("Number of levels to add")
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("bank")
                .setDescription("Add bank balance to a user")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to add bank balance to")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("amount")
                        .setDescription("Amount to add")
                        .setRequired(true)
                        .setMinValue(1))),
    
    options: {
        devOnly: true
    },

    run: async ({ interaction }) => {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const embed = new EmbedBuilder().setColor("#00FF00");

        try {
            let updateField;
            let resourceType;

            switch(subcommand) {
                case "balance":
                    updateField = { balance: amount };
                    resourceType = "wallet balance";
                    break;
                case "xp":
                    updateField = { xp: amount };
                    resourceType = "XP";
                    break;
                case "level":
                    updateField = { level: amount };
                    resourceType = "levels";
                    break;
                case "bank":
                    updateField = { bank: amount };
                    resourceType = "bank balance";
                    break;
            }

            const userEconomy = await economy.findOneAndUpdate(
                { userId: targetUser.id },
                { 
                    $inc: updateField,
                    $set: { username: targetUser.username }
                },
                { upsert: true, new: true }
            );

            embed.setDescription(
                `✅ Successfully added **${amount.toLocaleString()} ${resourceType}** to ${targetUser.username}\n` +
                `New ${resourceType}: **${userEconomy[subcommand].toLocaleString()}**`
            );

        } catch (error) {
            console.error("Add command error:", error);
            embed.setColor("#FF0000")
                .setDescription("❌ Failed to add resources. Please try again later.");
        }

        await interaction.reply({ 
            embeds: [embed],
            ephemeral: true 
        });
    }
};