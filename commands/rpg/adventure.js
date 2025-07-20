const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { economy } = require('../../schemas/economy');
const monsters = require('../../data/monsters.json');
const items = require('../../data/items.json');
const places = require('../../data/places.json');

// Cooldown management
const adventureCooldowns = new Map();
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes cooldown

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adventure')
        .setDescription('Go on an adventure to explore locations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('explore')
                .setDescription('Explore your current location'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('change_location')
                .setDescription('Change your adventure location')
                .addStringOption(option =>
                    option.setName('location')
                        .setDescription('Select a location')
                        .setRequired(true)
                        .addChoices(
                            ...places.map(p => ({ name: p.name, value: p.id }))
                        ))),
    
    run: async ({ interaction }) => {
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'change_location') {
            const locationId = interaction.options.getString('location');
            const userData = await economy.findOne({ userId });
            
            if (!userData) {
                return interaction.reply({ 
                    content: '❌ Anda belum terdaftar di sistem ekonomi!', 
                    ephemeral: true 
                });
            }

            if (!userData.discoveredLocations.includes(locationId)) {
                return interaction.reply({ 
                    content: '❌ Anda belum menemukan lokasi ini!', 
                    ephemeral: true 
                });
            }

            await economy.updateOne(
                { userId },
                { $set: { lastLocation: locationId } }
            );

            return interaction.reply({
                content: `📍 Lokasi petualangan diubah ke **${places.find(p => p.id === locationId).name}**!`,
                ephemeral: true
            });
        }

        // Handle cooldown
        const now = Date.now();
        if (adventureCooldowns.has(userId)) {
            const expirationTime = adventureCooldowns.get(userId) + COOLDOWN_TIME;
            if (now < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - now) / 1000 / 60);
                return interaction.reply({
                    content: `⏳ Anda harus menunggu ${timeLeft} menit sebelum petualangan berikutnya!`,
                    ephemeral: true
                });
            }
        }

        // Set cooldown
        adventureCooldowns.set(userId, now);

        const userData = await economy.findOne({ userId });
        if (!userData) {
            return interaction.reply({ 
                content: '❌ Anda belum terdaftar di sistem ekonomi!', 
                ephemeral: true 
            });
        }

        if (userData.hp <= 0) {
            return interaction.reply({ 
                content: '💀 Anda tidak bisa petualang dalam keadaan mati! Gunakan `/heal` terlebih dahulu.', 
                ephemeral: true 
            });
        }

        const currentLocation = places.find(p => p.id === (userData.lastLocation || 'town_square'));
        if (!currentLocation) {
            return interaction.reply({
                content: '❌ Lokasi tidak valid!',
                ephemeral: true
            });
        }

        // Random exploration text
        const locationTexts = currentLocation?.exploration?.steps || [
            "Anda menjelajahi daerah yang tidak dikenal...",
            "Langit terlihat aneh di tempat ini...",
            "Anda merasa ada yang mengawasi Anda..."
        ];
        
        const stepText = locationTexts[Math.floor(Math.random() * locationTexts.length)];
        let resultText = stepText + "\n\n";

        // Check for monster encounter (30% chance)
        if (Math.random() < 0.3) {
            const locationMonsters = currentLocation?.exploration?.monsterPool || [];
            const availableMonsters = monsters.filter(m => locationMonsters.includes(m.id));
            
            if (availableMonsters.length > 0) {
                const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
                resultText += `😱 Anda menemukan **${monster.name}**!\n`;

                // Calculate combat outcome (simplified)
                const playerPower = userData.attack + userData.defense;
                const monsterPower = monster.stats.attack + monster.stats.defense;
                const winChance = playerPower / (playerPower + monsterPower);
                
                if (Math.random() < winChance) {
                    // Player wins
                    const xpReward = monster.xp;
                    const goldReward = Math.floor(
                        Math.random() * (monster.gold[1] - monster.gold[0] + 1)
                    ) + monster.gold[0];

                    await economy.updateOne(
                        { userId },
                        { $inc: { xp: xpReward, balance: goldReward } }
                    );

                    resultText += `🎉 Anda berhasil mengalahkan ${monster.name}!\n`;
                    resultText += `Anda mendapatkan ${xpReward} XP dan ${goldReward} koin!`;

                    // Monster drops (simplified)
                    if (monster.drops) {
                        const inventory = userData.inventory || {};
                        for (const drop of monster.drops) {
                            if (Math.random() < drop.chance) {
                                const qty = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                                inventory[drop.id] = (inventory[drop.id] || 0) + qty;
                                const item = items.find(i => i.id === drop.id);
                                if (item) {
                                    resultText += `\n🎁 Mendapatkan ${item.name} x${qty}!`;
                                }
                            }
                        }
                        await economy.updateOne({ userId }, { $set: { inventory } });
                    }
                } else {
                    // Player loses
                    const damage = Math.floor(Math.random() * 20) + 10;
                    const newHp = Math.max(0, userData.hp - damage);

                    await economy.updateOne(
                        { userId },
                        { $set: { hp: newHp } }
                    );

                    resultText += `💀 Anda kalah melawan ${monster.name} dan kehilangan ${damage} HP!`;
                    
                    if (newHp <= 0) {
                        resultText += "\n\nAnda pingsan dan dibawa kembali ke kota!";
                        await economy.updateOne(
                            { userId },
                            { $set: { hp: userData.maxHp, lastLocation: 'town_square' } }
                        );
                    }
                }
            }
        } else {
            // No monster, check for random event (20% chance)
            if (Math.random() < 0.2) {
                const events = [
                    {
                        name: "Harta Karun",
                        execute: async () => {
                            const goldFound = Math.floor(Math.random() * 50) + 25;
                            await economy.updateOne({ userId }, { $inc: { balance: goldFound } });
                            return `🎉 Anda menemukan harta karun berisi **${goldFound} koin**!`;
                        }
                    },
                    {
                        name: "Penyembuhan",
                        execute: async () => {
                            const healAmount = Math.floor(Math.random() * 20) + 10;
                            const newHp = Math.min(userData.maxHp, userData.hp + healAmount);
                            await economy.updateOne({ userId }, { $set: { hp: newHp } });
                            return `❤️ Anda menemukan mata air penyembuh! Pulihkan **${healAmount} HP**!`;
                        }
                    }
                ];

                const event = events[Math.floor(Math.random() * events.length)];
                resultText += await event.execute();
            } else {
                // Just exploration with small rewards
                const smallGold = Math.floor(Math.random() * 10) + 5;
                await economy.updateOne({ userId }, { $inc: { balance: smallGold } });
                resultText += `Anda menemukan ${smallGold} koin di sepanjang jalan.`;
            }
        }

        // Location resources (simplified)
        if (currentLocation?.resources) {
            const inventory = userData.inventory || {};
            for (const resource of currentLocation.resources) {
                if (Math.random() < resource.chance) {
                    const qty = Math.floor(Math.random() * 2) + 1;
                    inventory[resource.id] = (inventory[resource.id] || 0) + qty;
                    const item = items.find(i => i.id === resource.id);
                    if (item) {
                        resultText += `\n🌿 Anda mengumpulkan ${item.name} x${qty}!`;
                    }
                }
            }
            await economy.updateOne({ userId }, { $set: { inventory } });
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Petualangan di ${currentLocation.name}`)
            .setDescription(resultText)
            .setFooter({ text: `Anda bisa petualang lagi dalam 5 menit` });

        await interaction.reply({ embeds: [embed] });
    },
    options: {
    verify: true
    }
};