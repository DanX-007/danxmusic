const { SlashCommandBuilder } = require("discord.js");
const { removePremiumUser } = require("../../utils/premiumManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("removepremium")
        .setDescription("Revoke premium access from a user")
        .addUserOption(opt =>
            opt.setName("user")
                .setDescription("User to remove premium")
                .setRequired(true)
        ),

    run: async ({ interaction }) => {
        const user = interaction.options.getUser("user");

        await removePremiumUser(user.id);

        return interaction.reply({
            content: `🗑️ | **${user.tag}** has been removed from premium users.`,
            ephemeral: true
        });
    },

    options: {
        devOnly: true
    }
};
