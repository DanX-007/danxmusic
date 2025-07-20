const { SlashCommandBuilder } = require("discord.js");
const { addPremiumUser, removePremiumUser } = require("../../utils/premiumManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("premium")
        .setDescription("Manage premium user access")
        .setDefaultMemberPermissions(0) // Admin only
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Grant premium access to a user")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("User to grant premium")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Revoke premium access from a user")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("User to remove premium")
                        .setRequired(true)
                )
        ),

    run: async ({ interaction }) => {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");
        let content;

        try {
            if (subcommand === "add") {
                await addPremiumUser(user.id);
                content = `✅ | **${user.tag}** has been added to premium users.`;
            } else {
                await removePremiumUser(user.id);
                content = `🗑️ | **${user.tag}** has been removed from premium users.`;
            }

            return interaction.reply({
                content,
                ephemeral: true
            });
        } catch (error) {
            console.error("Premium command error:", error);
            return interaction.reply({
                content: `❌ | Failed to ${subcommand} premium status for ${user.tag}`,
                ephemeral: true
            });
        }
    },

    options: {
        devOnly: true
    }
};