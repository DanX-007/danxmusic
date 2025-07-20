const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

const BET_TYPES = {
    STRAIGHT: { multiplier: 35, check: (num, bet) => num === bet },
    SPLIT: { multiplier: 17, check: (num, bets) => bets.includes(num) },
    STREET: { multiplier: 11, check: (num, bet) => Math.floor((num - 1) / 3) === Math.floor((bet - 1) / 3) },
    CORNER: { multiplier: 8, check: (num, bets) => bets.some(b => Math.abs(num - b) <= 1 && Math.floor((num - 1) / 3) - Math.floor((b - 1) / 3) <= 1) },
    LINE: { multiplier: 5, check: (num, bet) => Math.floor((num - 1) / 6) === Math.floor((bet - 1) / 6) },
    DOZEN: { multiplier: 2, check: (num, bet) => (bet === 1 && num <= 12) || (bet === 2 && num > 12 && num <= 24) || (bet === 3 && num > 24) },
    COLUMN: { multiplier: 2, check: (num, bet) => num % 3 === bet % 3 },
    RED: { multiplier: 1, check: num => [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num) },
    BLACK: { multiplier: 1, check: num => [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35].includes(num) },
    ODD: { multiplier: 1, check: num => num % 2 === 1 },
    EVEN: { multiplier: 1, check: num => num % 2 === 0 && num !== 0 },
    LOW: { multiplier: 1, check: num => num >= 1 && num <= 18 },
    HIGH: { multiplier: 1, check: num => num >= 19 && num <= 36 }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roulette")
        .setDescription("Play roulette")
        .addStringOption(option =>
            option.setName("source")
                .setDescription("Use wallet or bank money")
                .addChoices(
                    { name: "Wallet", value: "wallet" },
                    { name: "Bank", value: "bank" }
                )
                .setRequired(true))
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Bet type")
                .setRequired(true)
                .addChoices(
                    { name: "Single Number (35x)", value: "STRAIGHT" },
                    { name: "Split Bet (17x)", value: "SPLIT" },
                    { name: "Street Bet (11x)", value: "STREET" },
                    { name: "Corner Bet (8x)", value: "CORNER" },
                    { name: "Line Bet (5x)", value: "LINE" },
                    { name: "Dozen Bet (2x)", value: "DOZEN" },
                    { name: "Column Bet (2x)", value: "COLUMN" },
                    { name: "Red (1x)", value: "RED" },
                    { name: "Black (1x)", value: "BLACK" },
                    { name: "Odd (1x)", value: "ODD" },
                    { name: "Even (1x)", value: "EVEN" },
                    { name: "Low 1-18 (1x)", value: "LOW" },
                    { name: "High 19-36 (1x)", value: "HIGH" }
                ))
        .addStringOption(option =>
            option.setName("numbers")
                .setDescription("Numbers to bet on (comma separated for multiple)")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("amount")
                .setDescription("Amount to bet")
                .setRequired(true)
                .setMinValue(10)),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const betType = interaction.options.getString("type");
        const source = interaction.options.getString("source");
        const numbersInput = interaction.options.getString("numbers");
        const betAmount = interaction.options.getInteger("amount");

        try {
            // Validasi taruhan
            const numbers = numbersInput.split(',').map(n => {
                if (betType === 'RED' || betType === 'BLACK' || betType === 'ODD' || 
                    betType === 'EVEN' || betType === 'LOW' || betType === 'HIGH') return 0;
                
                const num = parseInt(n.trim());
                if (isNaN(num)) {
                    interaction.reply({
                        embeds: [embed.setDescription("Must be a valid integer")],
                        ephemeral: true
                    });
                    return null;
                }
                if (num < 0 || num > 36) {
                    interaction.reply({
                        embeds: [embed.setDescription("Number must be between 0 and 36")],
                        ephemeral: true
                    });
                    return null;
                }
                return num;
            }).filter(n => n !== null);

            if (numbers.length === 0) return;

            // Cek saldo
            let userEconomy = await economy.findOne({ userId: interaction.user.id });
            if (!userEconomy) {
                return interaction.reply({
                    embeds: [embed.setDescription("❌ You don't have an economy account!")],
                    ephemeral: true
                });
            }

            const balance = source === "wallet" ? userEconomy.balance : userEconomy.bank;
            if (balance < betAmount) {
                return interaction.reply({
                    embeds: [embed.setDescription("❌ You don't have enough coins for this bet!")],
                    ephemeral: true
                });
            }

            // Putar roulette
            const result = Math.floor(Math.random() * 37); // 0-36
            const isWin = BET_TYPES[betType].check(result, numbers.length === 1 ? numbers[0] : numbers);
            const color = result === 0 ? 'green' : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result) ? 'red' : 'black';

            // Hitung hasil
            if (isWin) {
                const winAmount = betAmount * BET_TYPES[betType].multiplier;
                if (source === "wallet") {
                    userEconomy.balance += winAmount;
                } else {
                    userEconomy.bank += winAmount;
                }
                embed.setDescription(`**Winner!** The ball landed on ${result} ${color}\nYou won ${winAmount} coins!`);
            } else {
                if (source === "wallet") {
                    userEconomy.balance -= betAmount;
                } else {
                    userEconomy.bank -= betAmount;
                }
                embed.setDescription(`**You lost!** The ball landed on ${result} ${color}\nYou lost ${betAmount} coins`);
            }

            await userEconomy.save();
            await interaction.reply({ embeds: [embed] });

        } catch (err) {
            logger(err, "error");
            return interaction.reply({ 
                embeds: [embed.setDescription(`❌ Error: ${err.message}`)],
                ephemeral: true 
            });
        }
    },
    options: {
    verify: true
    }
};