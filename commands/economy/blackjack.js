const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");

// Kartu dan nilai
const cardValues = {
    'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 
    '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10
};
const suits = ['♥', '♦', '♠', '♣'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blackjack")
        .setDescription("Play a game of Blackjack")
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
        const type = interaction.options.getString("type");
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const bet = interaction.options.getInteger("bet");

        try {
            // Cek saldo
            let userEconomy = await economy.findOne({ userId: interaction.user.id });
            if (!userEconomy) {
                return interaction.editReply({
                    embeds: [embed.setDescription("❌ You don't have an economy account!")],
                    ephemeral: true
                });
            }

            // Gunakan let karena nilai akan diubah
            let balance = type === "wallet" ? userEconomy.balance : userEconomy.bank;
            
            if (balance < bet) {
                return interaction.editReply({
                    embeds: [embed.setDescription("❌ You don't have enough coins for this bet!")],
                    ephemeral: true
                });
            }

            // Inisialisasi permainan
            let gameState = {
                deck: createDeck(),
                playerHand: [],
                dealerHand: [],
                bet: bet,
                insurance: 0,
                doubled: false,
                splitHand: null,
                currentHand: 'main'
            };

            // Deal kartu awal
            dealInitialCards(gameState);

            // Hitung nilai
            const playerValue = calculateHandValue(gameState.playerHand);
            const dealerValue = calculateHandValue(gameState.dealerHand);

            // Cek blackjack langsung
            if (playerValue === 21) {
                return handleBlackjack(interaction, gameState, userEconomy, balance, type);
            }

            // Buat tombol aksi
            const buttons = createActionButtons(gameState);

            // Kirim embed permainan
            const gameEmbed = createGameEmbed(gameState, interaction.user);
            await interaction.editReply({ 
                embeds: [gameEmbed],
                components: buttons
            });

            // Setup collector untuk tombol
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter: i => i.user.id === interaction.user.id,
                time: 300000 // 5 menit timeout
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                
                // Handle aksi pemain
                switch (i.customId) {
                    case 'hit':
                        gameState.playerHand.push(drawCard(gameState.deck));
                        break;
                    case 'stand':
                        return handleStand(i, gameState, userEconomy, balance, type);
                    case 'double':
                        if (balance >= gameState.bet) {
                            gameState.doubled = true;
                            gameState.bet *= 2;
                            gameState.playerHand.push(drawCard(gameState.deck));
                            return handleStand(i, gameState, userEconomy, balance, type);
                        }
                        break;
                    case 'split':
                        if (canSplit(gameState)) {
                            gameState.splitHand = [gameState.playerHand.pop()];
                            gameState.playerHand.push(drawCard(gameState.deck));
                            gameState.splitHand.push(drawCard(gameState.deck));
                        }
                        break;
                    case 'insurance':
                        if (gameState.dealerHand[0].card === 'A' && !gameState.insurance) {
                            const insuranceBet = Math.floor(gameState.bet / 2);
                            if (balance >= insuranceBet) {
                                gameState.insurance = insuranceBet;
                                balance -= insuranceBet;
                            }
                        }
                        break;
                    case 'surrender':
                        balance += Math.floor(gameState.bet / 2);
                        if (type === "wallet") {
                            userEconomy.balance = balance;
                        } else {
                            userEconomy.bank = balance;
                        }
                        await userEconomy.save();
                        collector.stop();
                        await i.editReply({ 
                            embeds: [embed.setDescription(`You surrendered and got back ${Math.floor(gameState.bet / 2)} coins`)],
                            components: [] 
                        });
                }

                // Cek jika player bust
                if (calculateHandValue(gameState.playerHand) > 21) {
                    return handleBust(i, gameState, userEconomy, balance, type);
                }

                // Update embed
                const updatedEmbed = createGameEmbed(gameState, interaction.user);
                await i.editReply({ 
                    embeds: [updatedEmbed],
                    components: createActionButtons(gameState)
                });
            });

            collector.on('end', async () => {
                if (type === "wallet") {
                    userEconomy.balance = balance;
                } else {
                    userEconomy.bank = balance;
                }
                await userEconomy.save();
            });

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

// Fungsi pembantu Blackjack
function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let [card, value] of Object.entries(cardValues)) {
            deck.push({ card, suit, value });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealInitialCards(gameState) {
    gameState.playerHand = [drawCard(gameState.deck), drawCard(gameState.deck)];
    gameState.dealerHand = [drawCard(gameState.deck), drawCard(gameState.deck)];
}

function drawCard(deck) {
    return deck.pop();
}

function calculateHandValue(hand) {
    let value = hand.reduce((sum, card) => sum + card.value, 0);
    let aces = hand.filter(card => card.card === 'A').length;
    
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    
    return value;
}

function createGameEmbed(gameState, user) {
    const embed = new EmbedBuilder()
        .setColor(config.clientOptions.embedColor)
        .setTitle(`${user.username}'s Blackjack Game`)
        .addFields(
            { name: 'Your Hand', value: formatHand(gameState.playerHand), inline: true },
            { name: 'Dealer Hand', value: formatDealerHand(gameState.dealerHand), inline: true },
            { name: 'Value', value: `Your hand: ${calculateHandValue(gameState.playerHand)}\nDealer shows: ${gameState.dealerHand[0].value}`, inline: false },
            { name: 'Bet', value: `${gameState.bet} coins`, inline: true },
            { name: 'Insurance', value: gameState.insurance > 0 ? `${gameState.insurance} coins` : 'None', inline: true }
        );
    
    return embed;
}

function formatHand(hand) {
    return hand.map(card => `${card.card}${card.suit}`).join(' ');
}

function formatDealerHand(hand) {
    return `${hand[0].card}${hand[0].suit} 🂠`; // Hanya tunjukkan satu kartu dealer
}

function createActionButtons(gameState) {
    const rows = [];
    const mainRow = new ActionRowBuilder();
    
    // Tombol dasar
    mainRow.addComponents(
        new ButtonBuilder()
            .setCustomId('hit')
            .setLabel('Hit')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('stand')
            .setLabel('Stand')
            .setStyle(ButtonStyle.Success)
    );
    rows.push(mainRow);

    // Tombol opsional
    const specialRow = new ActionRowBuilder();
    let hasSpecialButtons = false;
    
    // Double down hanya jika 2 kartu
    if (gameState.playerHand.length === 2) {
        specialRow.addComponents(
            new ButtonBuilder()
                .setCustomId('double')
                .setLabel('Double Down')
                .setStyle(ButtonStyle.Secondary)
        );
        hasSpecialButtons = true;
    }
    
    // Split hanya jika 2 kartu sama
    if (canSplit(gameState)) {
        specialRow.addComponents(
            new ButtonBuilder()
                .setCustomId('split')
                .setLabel('Split')
                .setStyle(ButtonStyle.Secondary)
        );
        hasSpecialButtons = true;
    }
    
    // Insurance hanya jika dealer punya Ace
    if (gameState.dealerHand[0].card === 'A' && !gameState.insurance) {
        specialRow.addComponents(
            new ButtonBuilder()
                .setCustomId('insurance')
                .setLabel(`Insurance (${Math.floor(gameState.bet / 2)})`)
                .setStyle(ButtonStyle.Secondary)
        );
        hasSpecialButtons = true;
    }
    
    // Surrender hanya di awal
    if (gameState.playerHand.length === 2) {
        specialRow.addComponents(
            new ButtonBuilder()
                .setCustomId('surrender')
                .setLabel('Surrender')
                .setStyle(ButtonStyle.Danger)
        );
        hasSpecialButtons = true;
    }

    if (hasSpecialButtons) {
        rows.push(specialRow);
    }

    return rows;
}

function canSplit(gameState) {
    return gameState.playerHand.length === 2 && 
           gameState.playerHand[0].card === gameState.playerHand[1].card &&
           !gameState.splitHand;
}

async function handleStand(interaction, gameState, userEconomy, balance, type) {
    // Dealer draws until 17 or higher
    while (calculateHandValue(gameState.dealerHand) < 17) {
        gameState.dealerHand.push(drawCard(gameState.deck));
    }

    const playerValue = calculateHandValue(gameState.playerHand);
    const dealerValue = calculateHandValue(gameState.dealerHand);
    const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);

    // Hitung hasil
    if (dealerValue > 21 || playerValue > dealerValue) {
        const winAmount = gameState.bet * (playerValue === 21 && gameState.playerHand.length === 2 ? 1.5 : 1);
        balance += winAmount;
        embed.setDescription(`**You won!** +${winAmount} coins\n${dealerValue > 21 ? 'Dealer busted' : `You: ${playerValue} vs Dealer: ${dealerValue}`}`);
    } else if (playerValue === dealerValue) {
        balance += gameState.bet;
        embed.setDescription(`**Push!** Bet returned\nBoth have ${playerValue}`);
    } else {
        balance -= gameState.bet;
        embed.setDescription(`**You lost!** -${gameState.bet} coins\nYou: ${playerValue} vs Dealer: ${dealerValue}`);
    }

    // Handle insurance
    if (gameState.insurance > 0 && gameState.dealerHand[0].card === 'A' && dealerValue === 21) {
        const insuranceWin = gameState.insurance * 2;
        balance += insuranceWin;
        embed.addFields({ name: 'Insurance', value: `+${insuranceWin} coins` });
    }

    // Update balance yang sesuai
    if (type === "wallet") {
        userEconomy.balance = balance;
    } else {
        userEconomy.bank = balance;
    }

    await userEconomy.save();
    await interaction.editReply({ 
        embeds: [embed],
        components: [] 
    });
}

async function handleBust(interaction, gameState, userEconomy, balance, type) {
    balance -= gameState.bet;
    
    const embed = new EmbedBuilder()
        .setColor(config.clientOptions.embedColor)
        .setDescription(`**Bust!** You lost ${gameState.bet} coins\nYour hand: ${calculateHandValue(gameState.playerHand)}`);
    
    // Update balance yang sesuai
    if (type === "wallet") {
        userEconomy.balance = balance;
    } else {
        userEconomy.bank = balance;
    }

    await userEconomy.save();
    await interaction.editReply({ 
        embeds: [embed],
        components: [] 
    });
}

async function handleBlackjack(interaction, gameState, userEconomy, balance, type) {
    const winAmount = Math.floor(gameState.bet * 1.5);
    balance += winAmount;
    
    const embed = new EmbedBuilder()
        .setColor(config.clientOptions.embedColor)
        .setDescription(`**Blackjack!** You won ${winAmount} coins!`);
    
    // Update balance yang sesuai
    if (type === "wallet") {
        userEconomy.balance = balance;
    } else {
        userEconomy.bank = balance;
    }

    await userEconomy.save();
    await interaction.editReply({ embeds: [embed] });
}