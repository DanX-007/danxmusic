const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Mainkan game Gunting-Batu-Kertas melawan bot!')
        .addIntegerOption(option =>
            option.setName('rounds')
                .setDescription('Jumlah ronde (default: 1)')
                .setRequired(true)),

    cooldown: 5,

    run: async ({ interaction }) => {
        const rounds = interaction.options.getInteger('rounds') || 1;
        let playerScore = 0;
        let botScore = 0;
        let currentRound = 1;
        let results = [];

        // Emoji mapping
        const choices = {
            rock: { emoji: '✊', name: 'Batu' },
            paper: { emoji: '✋', name: 'Kertas' },
            scissors: { emoji: '✌️', name: 'Gunting' }
        };

        // Create game embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎮 Gunting-Batu-Kertas')
            .setDescription(`**Ronde ${currentRound}/${rounds}**\nPilih salah satu:`);

        // Create buttons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rock')
                    .setLabel('Batu')
                    .setEmoji('✊')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('paper')
                    .setLabel('Kertas')
                    .setEmoji('✋')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('scissors')
                    .setLabel('Gunting')
                    .setEmoji('✌️')
                    .setStyle(ButtonStyle.Primary)
            );

        const message = await interaction.reply({
            embeds: [embed],
            components: [buttons],
            fetchReply: true
        });

        // Button collector
        const collector = message.createMessageComponentCollector({
            time: 60000,
            filter: i => i.user.id === interaction.user.id
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            const playerChoice = i.customId;
            const botChoice = Object.keys(choices)[Math.floor(Math.random() * 3)];

            // Determine winner
            let result;
            if (playerChoice === botChoice) {
                result = "Seri!";
            } else if (
                (playerChoice === 'rock' && botChoice === 'scissors') ||
                (playerChoice === 'paper' && botChoice === 'rock') ||
                (playerChoice === 'scissors' && botChoice === 'paper')
            ) {
                result = "Kamu menang! 🎉";
                playerScore++;
            } else {
                result = "Bot menang! 🤖";
                botScore++;
            }

            // Save round result
            results.push({
                round: currentRound,
                player: choices[playerChoice],
                bot: choices[botChoice],
                result: result
            });

            // Update embed
            const resultEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`🎮 Ronde ${currentRound}/${rounds} Selesai!`)
                .setDescription(
                    `Kamu: ${choices[playerChoice].emoji} ${choices[playerChoice].name}\n` +
                    `Bot: ${choices[botChoice].emoji} ${choices[botChoice].name}\n\n` +
                    `**${result}**\n\n` +
                    `Skor: Kamu ${playerScore} - ${botScore} Bot`
                );

            // Check if game is over
            if (currentRound >= rounds) {
                // Game over, show final results
                let finalResult = '';
                if (playerScore > botScore) {
                    finalResult = '🎉 **Kamu menang!** 🎉';
                } else if (botScore > playerScore) {
                    finalResult = '🤖 **Bot menang!** 🤖';
                } else {
                    finalResult = '🔄 **Permainan seri!** 🔄';
                }

                const finalEmbed = new EmbedBuilder()
                    .setColor(playerScore > botScore ? '#00ff00' : botScore > playerScore ? '#ff0000' : '#ffff00')
                    .setTitle('🏆 Hasil Akhir')
                    .setDescription(
                        `${finalResult}\n\n` +
                        `Skor akhir: Kamu ${playerScore} - ${botScore} Bot\n\n` +
                        `**Detail Ronde:**\n` +
                        results.map(r => 
                            `Ronde ${r.round}: ${r.player.emoji} vs ${r.bot.emoji} → ${r.result}`
                        ).join('\n')
                    );

                await i.editReply({
                    embeds: [finalEmbed],
                    components: []
                });

                collector.stop();
                return;
            }

            // Prepare for next round
            currentRound++;
            const nextRoundEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎮 Gunting-Batu-Kertas')
                .setDescription(
                    `**Ronde ${currentRound}/${rounds}**\n` +
                    `Skor: Kamu ${playerScore} - ${botScore} Bot\n\n` +
                    `Pilih untuk ronde berikutnya:`
                );

            await i.editReply({
                embeds: [resultEmbed, nextRoundEmbed],
                components: [buttons]
            });
        });

        collector.on('end', () => {
            if (currentRound <= rounds) {
                message.edit({
                    content: 'Waktu permainan habis!',
                    components: []
                }).catch(console.error);
            }
        });
    }
};