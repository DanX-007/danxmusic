const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tebakgambar')
        .setDescription('Game tebak gambar dengan emoji bersama temanmu!')
        .addUserOption(option =>
            option.setName('lawan')
                .setDescription('Pilih lawan mainmu')
                .setRequired(true)),

    run: async ({ interaction }) => {
        const opponent = interaction.options.getUser('lawan');
        const drawer = interaction.user;
        const guesser = opponent;

        if (drawer.id === guesser.id) {
            return interaction.reply({ content: 'Kamu tidak bisa melawan diri sendiri!', ephemeral: true });
        }

        // Kategori dan kata-kata
        const categories = {
            animals: ['🐘 Gajah', '🦒 Jerapah', '🐅 Harimau', '🐊 Buaya', '🦁 Singa'],
            food: ['🍕 Pizza', '🍔 Burger', '🍜 Ramen', '🍣 Sushi', '🍩 Donat'],
            objects: ['🛏️ Kasur', '💻 Laptop', '📱 Handphone', '🚗 Mobil', '✈️ Pesawat']
        };

        // Embed untuk memilih kategori
        const categoryEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎨 Pilih Kategori Gambar')
            .setDescription(`${drawer.username}, pilih kategori untuk gambar yang akan kamu buat:`);

        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('select-category')
            .setPlaceholder('Pilih kategori')
            .addOptions(
                { label: '🐾 Hewan', value: 'animals' },
                { label: '🍔 Makanan', value: 'food' },
                { label: '🛏️ Benda', value: 'objects' }
            );

        const categoryRow = new ActionRowBuilder().addComponents(categorySelect);

        const categoryMessage = await interaction.reply({
            embeds: [categoryEmbed],
            components: [categoryRow],
            fetchReply: true
        });

        // Collector untuk memilih kategori
        const categoryCollector = categoryMessage.createMessageComponentCollector({
            time: 30000,
            filter: i => i.user.id === drawer.id
        });

        let selectedWord = '';

        categoryCollector.on('collect', async i => {
            await i.deferUpdate();
            const category = i.values[0];
            const words = categories[category];
            selectedWord = words[Math.floor(Math.random() * words.length)];
            
            // Kirim pesan ke drawer dengan instruksi
            const drawEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎨 Buat Gambarmu!')
                .setDescription(`Kata yang harus digambar: **${selectedWord.split(' ')[1]}**\n\nGunakan emoji untuk membuat gambar dalam 1 menit!`)
                .setFooter({ text: 'Hanya yang menggambar yang bisa melihat ini' });

            await interaction.followUp({
                content: `${drawer}`,
                embeds: [drawEmbed],
                ephemeral: true
            });

            // Kirim pesan ke guesser
            const guessEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🕵️‍♂️ Tebak Gambar')
                .setDescription(`${drawer.username} sedang membuat gambar...\n\nKategori: **${i.component.options.find(o => o.value === category).label}**`)
                .setFooter({ text: 'Tunggu sampai gambar selesai dibuat' });

            await interaction.followUp({
                content: `${guesser}`,
                embeds: [guessEmbed]
            });

            // Buat drawing board
            const drawingBoard = ['⬜⬜⬜⬜⬜','⬜⬜⬜⬜⬜','⬜⬜⬜⬜⬜','⬜⬜⬜⬜⬜','⬜⬜⬜⬜⬜'];
            
            const drawingEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎨 Drawing Board')
                .setDescription(drawingBoard.join('\n'));

            const drawingControls = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('draw-up').setEmoji('⬆️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('draw-down').setEmoji('⬇️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('draw-left').setEmoji('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('draw-right').setEmoji('➡️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('draw-emoji').setLabel('Emoji').setStyle(ButtonStyle.Success)
                );

            const drawingMessage = await interaction.followUp({
                embeds: [drawingEmbed],
                components: [drawingControls],
                fetchReply: true
            });

            // Game logic
            let cursorPos = { x: 2, y: 2 };
            let selectedEmoji = '🟦';
            let isComplete = false;

            const drawingCollector = drawingMessage.createMessageComponentCollector({
                time: 60000,
                filter: i => i.user.id === drawer.id
            });

            drawingCollector.on('collect', async i => {
                await i.deferUpdate();
                
                if (i.customId.startsWith('draw-')) {
                    const direction = i.customId.split('-')[1];
                    
                    if (direction === 'emoji') {
                        // Pilih emoji
                        const emojiSelect = new StringSelectMenuBuilder()
                            .setCustomId('select-emoji')
                            .setPlaceholder('Pilih emoji')
                            .addOptions(
                                { label: 'Biru', value: '🟦', emoji: '🟦' },
                                { label: 'Merah', value: '🟥', emoji: '🟥' },
                                { label: 'Hijau', value: '🟩', emoji: '🟩' },
                                { label: 'Kuning', value: '🟨', emoji: '🟨' }
                            );

                        const emojiRow = new ActionRowBuilder().addComponents(emojiSelect);
                        
                        await i.followUp({
                            content: 'Pilih emoji:',
                            components: [emojiRow],
                            ephemeral: true
                        });
                        
                        return;
                    }

                    // Gerakkan cursor
                    switch(direction) {
                        case 'up': if (cursorPos.y > 0) cursorPos.y--; break;
                        case 'down': if (cursorPos.y < 4) cursorPos.y++; break;
                        case 'left': if (cursorPos.x > 0) cursorPos.x--; break;
                        case 'right': if (cursorPos.x < 4) cursorPos.x++; break;
                    }
                }

                // Update board
                const row = drawingBoard[cursorPos.y].split('');
                row[cursorPos.x] = selectedEmoji;
                drawingBoard[cursorPos.y] = row.join('');

                // Update embed
                drawingEmbed.setDescription(drawingBoard.join('\n'));
                
                await drawingMessage.edit({
                    embeds: [drawingEmbed],
                    components: [drawingControls]
                });
            });

            // Collector untuk memilih emoji
            drawingMessage.awaitMessageComponent({
                filter: i => i.customId === 'select-emoji' && i.user.id === drawer.id,
                time: 30000
            }).then(async i => {
                selectedEmoji = i.values[0];
                await i.deferUpdate();
            }).catch(() => {});

            drawingCollector.on('end', async () => {
                isComplete = true;
                
                // Tampilkan hasil akhir
                const finalDrawingEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎨 Gambar Selesai!')
                    .setDescription(`${drawer.username} telah selesai menggambar!\n\n${drawingBoard.join('\n')}`)
                    .setFooter({ text: 'Sekarang saatnya menebak!' });

                const guessControls = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('submit-guess')
                            .setLabel('Tebak Sekarang')
                            .setStyle(ButtonStyle.Primary)
                    );

                await drawingMessage.edit({
                    embeds: [finalDrawingEmbed],
                    components: [guessControls]
                });

                // Collector untuk tebakan
                drawingMessage.awaitMessageComponent({
                    filter: i => i.user.id === guesser.id && i.customId === 'submit-guess',
                    time: 30000
                }).then(async i => {
                    await i.showModal({
                        customId: 'guess-modal',
                        title: 'Apa tebakanmu?',
                        components: [{
                            type: 1,
                            components: [{
                                type: 4,
                                customId: 'guess-input',
                                label: 'Tebakan kamu',
                                style: 2,
                                required: true
                            }]
                        }]
                    });
                }).catch(() => {});

                // Handle modal submit
                interaction.client.on('interactionCreate', async modalInteraction => {
                    if (!modalInteraction.isModalSubmit()) return;
                    if (modalInteraction.customId !== 'guess-modal') return;
                    
                    const guess = modalInteraction.fields.getTextInputValue('guess-input');
                    const answer = selectedWord.split(' ')[1].toLowerCase();
                    
                    if (guess.toLowerCase() === answer) {
                        await modalInteraction.reply({
                            content: `🎉 **Tebakan benar!** ${guesser.username} menebak dengan tepat: **${answer}**`,
                            ephemeral: false
                        });
                    } else {
                        await modalInteraction.reply({
                            content: `❌ Tebakan salah! Jawabannya adalah: **${answer}**`,
                            ephemeral: false
                        });
                    }
                });
            });
        });

        categoryCollector.on('end', () => {
            if (!selectedWord) {
                interaction.followUp('Waktu memilih kategori habis! Game dibatalkan.').catch(console.error);
            }
        });
    }
};