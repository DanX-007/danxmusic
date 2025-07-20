const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '7️⃣', '💎'];
const PAYOUTS = {
    '7️⃣7️⃣7️⃣': 50,
    '💎💎💎': 30,
    '🍇🍇🍇': 15,
    '🍉🍉🍉': 10,
    '🍊🍊🍊': 7,
    '🍋🍋🍋': 5,
    '🍒🍒🍒': 3,
    'any-🍒': 1
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("slot")
        .setDescription("Play the slot machine")
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Use wallet or bank money")
                .addChoices(
                    { name: "Wallet", value: "wallet" },
                    { name: "Bank", value: "bank" }
                )
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("bet")
                .setDescription("Amount to bet")
                .setRequired(true)
                .setMinValue(10)),

    run: async ({ interaction, client }) => {
        await interaction.deferReply();
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const bet = interaction.options.getInteger("bet");
        const type = interaction.options.getString("type");

        try {
            // Cek saldo
            let userEconomy = await economy.findOne({ userId: interaction.user.id });
            if (!userEconomy) {
                return interaction.reply({
                    embeds: [embed.setDescription("❌ You don't have an economy account!")],
                    ephemeral: true
                });
            }

            // Gunakan let karena nilai akan diubah
            let balance = type === "wallet" ? userEconomy.balance : userEconomy.bank;
            
            if (balance < bet) {
                return interaction.reply({
                    embeds: [embed.setDescription("❌ You don't have enough coins for this bet!")],
                    ephemeral: true
                });
            }

            // Putar slot
            const reels = [
                SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
                SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
                SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
            ];

            // Hitung kemenangan
            let winAmount = 0;
            const combination = reels.join('');
            
            // Cek kombinasi khusus
            if (PAYOUTS[combination]) {
                winAmount = bet * PAYOUTS[combination];
            } 
            // Cek untuk cherry di posisi mana saja
            else if (reels.filter(s => s === '🍒').length >= 2) {
                winAmount = bet * PAYOUTS['any-🍒'];
            }

            // Update saldo
            if (winAmount > 0) {
                balance += winAmount;
                embed.setDescription(`**${combination}**\n\nYou won ${winAmount} coins! 🎉`);
            } else {
                balance -= bet;
                embed.setDescription(`**${combination}**\n\nYou lost ${bet} coins...`);
            }

            // Update balance yang sesuai (wallet atau bank)
            if (type === "wallet") {
                userEconomy.balance = balance;
            } else {
                userEconomy.bank = balance;
            }

            await userEconomy.save();
            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            logger(err, "error");
            return interaction.editReply({ 
                embeds: [embed.setDescription("❌ An error occurred during the game")],
                ephemeral: true 
            });
        }
    },
    options: {
    verify: true
    }
};