const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("transfer")
        .setDescription("Transfer coins to another user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User to transfer to")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Transfer from wallet or bank")
                .addChoices(
                    { name: "Wallet", value: "wallet" },
                    { name: "Bank", value: "bank" }
                )
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("amount")
                .setDescription("Amount to transfer")
                .setRequired(true)),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const recipient = interaction.options.getUser("user");
        const type = interaction.options.getString("type");
        const amount = interaction.options.getInteger("amount");
        const TAX_RATE = 0.05; // 5% tax

        try {
            // Cek transfer ke diri sendiri
            if (recipient.id === interaction.user.id) {
                return interaction.reply({
                    embeds: [embed.setDescription(`\`❌\` | You can't transfer to yourself!`)],
                    ephemeral: true
                });
            }

            // Cek amount valid
            if (amount <= 0) {
                return interaction.reply({
                    embeds: [embed.setDescription(`\`❌\` | Amount must be positive!`)],
                    ephemeral: true
                });
            }

            // Dapatkan data pengirim dan penerima
            let senderEconomy = await economy.findOne({ userId: interaction.user.id });
            let recipientEconomy = await Economy.findOne({ userId: recipient.id });

            if (!senderEconomy) {
                senderEconomy = new Economy({
                    userId: interaction.user.id,
                    username: interaction.user.username
                });
                await senderEconomy.save();
            }

            if (!recipientEconomy) {
                recipientEconomy = new Economy({
                    userId: recipient.id,
                    username: recipient.username
                });
                await recipientEconomy.save();
            }

            // Hitung jumlah setelah pajak
            const taxAmount = Math.floor(amount * TAX_RATE);
            const receivedAmount = amount - taxAmount;

            // Proses transfer berdasarkan tipe
            if (type === "wallet") {
                if (amount > senderEconomy.balance) {
                    return interaction.reply({
                        embeds: [embed.setDescription(
                            `\`❌\` | Not enough coins in your wallet!\n` +
                            `Your balance: **${senderEconomy.balance.toLocaleString()} coins**`
                        )],
                        ephemeral: true
                    });
                }

                // Kurangi dari pengirim
                senderEconomy.balance -= amount;
                // Tambahkan ke penerima
                recipientEconomy.balance += receivedAmount;
            } 
            else if (type === "bank") {
                if (amount > senderEconomy.bank) {
                    return interaction.reply({
                        embeds: [embed.setDescription(
                            `\`❌\` | Not enough coins in your bank!\n` +
                            `Bank balance: **${senderEconomy.bank.toLocaleString()} coins**`
                        )],
                        ephemeral: true
                    });
                }

                // Kurangi dari bank pengirim
                senderEconomy.bank -= amount;
                // Tambahkan ke bank penerima
                recipientEconomy.bank += receivedAmount;
            }

            // Simpan perubahan
            await senderEconomy.save();
            await recipientEconomy.save();

            return interaction.reply({
                embeds: [embed.setDescription(
                    `\`✅\` | Successfully transferred **${amount.toLocaleString()} coins** to ${recipient.username}!\n` +
                    `• Tax (5%): **${taxAmount.toLocaleString()} coins**\n` +
                    `• Received: **${receivedAmount.toLocaleString()} coins**\n\n` +
                    `Your ${type} balance: **${type === "wallet" ? senderEconomy.balance.toLocaleString() : senderEconomy.bank.toLocaleString()} coins**`
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