const { SlashCommandBuilder } = require("discord.js");
const { addPremiumUser } = require("../../utils/premiumManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addpremium")
        .setDescription("Grant premium access to a user")
        .addUserOption(opt =>
            opt.setName("user")
                .setDescription("User to grant premium")
                .setRequired(true)
        ),

    run: async ({ interaction }) => {
        const user = interaction.options.getUser("user");

        await addPremiumUser(user.id);

        return interaction.reply({
            content: `✅ | **${user.tag}** has been added to premium users.`,
            ephemeral: true
        });
    },

    options: {
        devOnly: true
    }
};
