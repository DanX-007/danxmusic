const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { economy } = require('../../schemas/economy');
const monsters = require('../../data/monsters.json');
const items = require('../../data/items.json');

// Fight state management
const activeFights = new Map();
const COOLDOWNS = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setDescription('Bertarung dengan pemain atau monster')
        .addSubcommand(sub => sub
            .setName('player')
            .setDescription('Tantang pemain lain')
            .addUserOption(opt => 
                opt.setName('target')
                    .setDescription('Pemain yang ingin ditantang')
                    .setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('monster')
            .setDescription('Lawan monster acak')
            .addStringOption(opt =>
                opt.setName('difficulty')
                    .setDescription('Tingkat kesulitan')
                    .addChoices(
                        { name: 'Easy', value: 'easy' },
                        { name: 'Normal', value: 'normal' },
                        { name: 'Hard', value: 'hard' },
                        { name: 'Boss', value: 'boss' }
                    ))
        ),
    
    run: async ({ interaction }) => {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        // Cooldown check
        if (COOLDOWNS.has(userId)) {
            const remaining = COOLDOWNS.get(userId) + 30000 - Date.now();
            if (remaining > 0) {
                return interaction.reply({
                    content: `⏳ Anda harus menunggu ${Math.ceil(remaining/1000)} detik sebelum bertarung lagi!`,
                    ephemeral: true
                });
            }
        }
        
        if (activeFights.has(userId)) {
            return interaction.reply({ 
                content: '⛔ Anda sedang dalam pertarungan!',
                ephemeral: true 
            });
        }
        
        const userData = await economy.findOne({ userId });
        if (!userData) {
            return interaction.reply({ 
                content: '❌ Profil ekonomi Anda belum dibuat!',
                ephemeral: true 
            });
        }

        if (userData.hp <= 0) {
            return interaction.reply({
                content: '💀 Anda tidak bisa bertarung dalam keadaan mati! Gunakan `/heal` terlebih dahulu.',
                ephemeral: true
            });
        }
        
        if (subcommand === 'player') {
            await handlePlayerFight(interaction, userId, userData);
        } 
        else if (subcommand === 'monster') {
            await handleMonsterFight(interaction, userId, userData);
        }
    },
    options: {
    verify: true
    }
};

async function handlePlayerFight(interaction, userId, userData) {
    const target = interaction.options.getUser('target');
    
    if (target.bot || target.id === userId) {
        return interaction.reply({ 
            content: '❌ Tidak bisa menantang bot atau diri sendiri!',
            ephemeral: true 
        });
    }
    
    const targetData = await economy.findOne({ userId: target.id });
    if (!targetData) {
        return interaction.reply({ 
            content: '❌ Pemain target tidak memiliki profil!',
            ephemeral: true 
        });
    }

    if (activeFights.has(target.id)) {
        return interaction.reply({
            content: '❌ Pemain target sedang dalam pertarungan!',
            ephemeral: true
        });
    }

    // Create fight challenge
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚔️ Tantangan Duel')
        .setDescription(`${target}, ${interaction.user} menantangmu untuk bertarung!`)
        .addFields(
            { name: 'Penantang', value: interaction.user.username, inline: true },
            { name: 'Level', value: userData.level.toString(), inline: true },
            { name: 'HP', value: `${userData.hp}/${userData.maxHp}`, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`accept_fight_${userId}`)
            .setLabel('Terima Tantangan')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('decline_fight')
            .setLabel('Tolak')
            .setStyle(ButtonStyle.Danger)
    );
    
    const message = await interaction.reply({
        content: target.toString(),
        embeds: [embed],
        components: [row],
        fetchReply: true
    });
    
    // Store pending fight
    activeFights.set(userId, {
        type: 'player',
        challenger: {
            id: userId,
            hp: userData.hp,
            maxHp: userData.maxHp,
            attack: userData.attack,
            defense: userData.defense,
            dexterity: userData.attributes?.dexterity || 0
        },
        target: {
            id: target.id,
            hp: targetData.hp,
            maxHp: targetData.maxHp,
            attack: targetData.attack,
            defense: targetData.defense,
            dexterity: targetData.attributes?.dexterity || 0
        },
        state: 'pending',
        message,
        turn: userId // Challenger goes first
    });

    // Setup collector for challenge response
    const collector = message.createMessageComponentCollector({
        filter: i => (i.customId === `accept_fight_${userId}` || i.customId === 'decline_fight') && i.user.id === target.id,
        time: 60000
    });

    collector.on('collect', async i => {
        try {
            if (i.customId === `accept_fight_${userId}`) {
                await i.deferUpdate();
                await startPvPFight(i, userId);
            } else {
                await i.update({
                    content: '❌ Tantangan ditolak!',
                    components: [],
                    embeds: []
                });
                activeFights.delete(userId);
            }
        } catch (error) {
            console.error('Error handling fight response:', error);
        }
        collector.stop();
    });

    collector.on('end', () => {
        if (activeFights.has(userId) && activeFights.get(userId).state === 'pending') {
            interaction.editReply({
                content: '⌛ Waktu menerima tantangan habis!',
                components: [],
                embeds: []
            });
            activeFights.delete(userId);
        }
    });
}

async function handleMonsterFight(interaction, userId, userData) {
    const difficulty = interaction.options.getString('difficulty') || 'normal';
    
    // Filter monsters based on calculated difficulty
    let availableMonsters = [];
    
    if (difficulty === 'boss') {
        // Untuk boss, ambil monster dengan flag raidBoss
        availableMonsters = monsters.filter(m => m.raidBoss === true);
    } else {
        // Untuk difficulty lainnya, kategorikan berdasarkan stat
        availableMonsters = monsters.filter(m => {
            if (m.raidBoss) return false; // Skip raid boss untuk difficulty biasa
            
            const totalPower = m.stats.hp + (m.stats.attack * 3) + (m.stats.defense * 2) + m.stats.speed;
            
            if (difficulty === 'easy') {
                return totalPower < 150; // Nilai threshold untuk easy
            } else if (difficulty === 'normal') {
                return totalPower >= 150 && totalPower < 300;
            } else if (difficulty === 'hard') {
                return totalPower >= 300;
            }
            return true;
        });
    }
    
    // Fallback jika tidak ada monster di kategori tersebut
    if (availableMonsters.length === 0) {
        availableMonsters = monsters.filter(m => !m.raidBoss);
    }
    
    const monster = JSON.parse(JSON.stringify(
        availableMonsters[Math.floor(Math.random() * availableMonsters.length)]
    ));
    
    // Scale monster stats based on player level
    const levelDifference = userData.level - monster.level;
    if (levelDifference > 0) {
        monster.stats.hp = Math.floor(monster.stats.hp * (1 + (levelDifference * 0.1)));
        monster.stats.attack = Math.floor(monster.stats.attack * (1 + (levelDifference * 0.05)));
    }

    activeFights.set(userId, {
        type: 'monster',
        monster,
        monsterHp: monster.stats.hp,
        playerHp: userData.hp,
        playerMaxHp: userData.maxHp,
        turn: 'player',
        message: null,
        difficulty
    });
    
    await startFight(interaction, userId);
}

async function startFight(interaction, userId) {
    const fight = activeFights.get(userId);
    if (!fight) return;

    const embed = new EmbedBuilder();
    let row;

    if (fight.type === 'monster') {
        // Monster fight setup
        embed
            .setColor('#FF0000')
            .setTitle(`😈 ${fight.monster.name} [${fight.difficulty.toUpperCase()}]`)
            .setDescription(`Level ${fight.monster.level} | XP: ${fight.monster.xp}`)
            .addFields(
                { name: 'HP Anda', value: `${fight.playerHp}/${fight.playerMaxHp}`, inline: true },
                { name: 'HP Monster', value: `${fight.monsterHp}/${fight.monster.stats.hp}`, inline: true },
                { name: 'Attack', value: fight.monster.stats.attack.toString(), inline: true },
                { name: 'Defense', value: fight.monster.stats.defense.toString(), inline: true }
            )
            .setFooter({ text: 'Giliran Anda untuk menyerang' });

        row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fight_attack')
                .setLabel('⚔️ Serang')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('fight_flee')
                .setLabel('🏃 Kabur')
                .setStyle(ButtonStyle.Secondary)
        );
    } 
    else if (fight.type === 'player') {
        // PvP fight setup
        const challenger = interaction.client.users.cache.get(fight.challenger.id);
        const target = interaction.client.users.cache.get(fight.target.id);
        
        embed
            .setColor('#FF0000')
            .setTitle('⚔️ Duel Dimulai!')
            .setDescription(`${challenger} vs ${target}`)
            .addFields(
                { 
                    name: fight.challenger.id === userId ? 'Anda' : challenger.username, 
                    value: `HP: ${fight.challenger.hp}/${fight.challenger.maxHp}\nAttack: ${fight.challenger.attack}\nDefense: ${fight.challenger.defense}`,
                    inline: true 
                },
                { 
                    name: fight.target.id === userId ? 'Anda' : target.username, 
                    value: `HP: ${fight.target.hp}/${fight.target.maxHp}\nAttack: ${fight.target.attack}\nDefense: ${fight.target.defense}`,
                    inline: true 
                }
            )
            .setFooter({ text: `Giliran ${fight.turn === userId ? 'Anda' : target.username}` });

        row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fight_attack')
                .setLabel('⚔️ Serang')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('fight_defend')
                .setLabel('🛡️ Bertahan')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    fight.message = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    setupFightCollector(fight, userId);
}

function setupFightCollector(fight, userId) {
    const collector = fight.message.createMessageComponentCollector({
        filter: i => {
            if (fight.type === 'player') {
                return i.user.id === fight.turn;
            }
            return i.user.id === userId;
        },
        time: 120000
    });

    collector.on('collect', async i => {
        try {
            await i.deferUpdate();
            
            if (fight.type === 'monster') {
                if (i.customId === 'fight_attack') {
                    await handleMonsterAttack(i, fight, userId);
                } else if (i.customId === 'fight_flee') {
                    await handleMonsterFlee(i, fight, userId);
                }
            } 
            else if (fight.type === 'player') {
                if (i.customId === 'fight_attack') {
                    await handlePvPAttack(i, fight, userId);
                } else if (i.customId === 'fight_defend') {
                    await handlePvPDefend(i, fight, userId);
                }
            }

            // Check if fight ended
            if (fight.type === 'monster' && (fight.monsterHp <= 0 || fight.playerHp <= 0)) {
                collector.stop();
            } 
            else if (fight.type === 'player' && (fight.challenger.hp <= 0 || fight.target.hp <= 0)) {
                collector.stop();
            }
        } catch (error) {
            console.error('Error handling fight action:', error);
            await i.followUp({ 
                content: '❌ Terjadi kesalahan saat memproses aksi!', 
                ephemeral: true 
            });
        }
    });

    collector.on('end', () => {
        if (activeFights.has(userId)) {
            COOLDOWNS.set(userId, Date.now());
            activeFights.delete(userId);
        }
    });
}

async function handleMonsterAttack(interaction, fight, userId) {
    const userData = await economy.findOne({ userId });
    const { damage, isCrit } = calculateDamage(
        { 
            attack: userData.attack, 
            dexterity: userData.attributes?.dexterity || 0 
        },
        { defense: fight.monster.stats.defense }
    );
    
    fight.monsterHp -= damage;
    let resultMessage = `${isCrit ? '💥 **CRITICAL!** ' : ''}Anda menyerang ${fight.monster.name}! (${damage} damage)\n`;
    
    // Monster counter attack if still alive
    if (fight.monsterHp > 0) {
        const monsterDamage = Math.max(1, 
            fight.monster.stats.attack + Math.floor(Math.random() * 3) - userData.defense
        );
        fight.playerHp -= monsterDamage;
        resultMessage += `😵 ${fight.monster.name} menyerang balik! (${monsterDamage} damage)\n`;
    }
    
    resultMessage += `\n❤️ HP Anda: ${fight.playerHp}/${userData.maxHp}\n`;
    resultMessage += `💀 HP ${fight.monster.name}: ${fight.monsterHp}/${fight.monster.stats.hp}`;
    
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setDescription(resultMessage);
    
    // Check if fight ended
    if (fight.monsterHp <= 0) {
        await endMonsterFight(interaction, fight, userId, true);
    } else if (fight.playerHp <= 0) {
        await endMonsterFight(interaction, fight, userId, false);
    } else {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fight_attack')
                .setLabel('⚔️ Serang')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('fight_flee')
                .setLabel('🏃 Kabur')
                .setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.editReply({ 
            embeds: [embed],
            components: [row] 
        });
    }
}

async function handleMonsterFlee(interaction, fight, userId) {
    const userData = await economy.findOne({ userId });
    const fleeChance = calculateFleeChance(userData);
    const success = Math.random() * 100 < fleeChance;
    
    const embed = new EmbedBuilder()
        .setColor(success ? '#00FF00' : '#FF0000')
        .setDescription(success ? 
            `🏃 Anda berhasil kabur dari ${fight.monster.name}!` : 
            `😵 Gagal kabur! ${fight.monster.name} menyerang!`);
    
    if (success) {
        await interaction.editReply({ 
            embeds: [embed],
            components: [] 
        });
        activeFights.delete(userId);
    } else {
        // Monster gets free hit when flee fails
        const monsterDamage = Math.max(1, 
            fight.monster.stats.attack + Math.floor(Math.random() * 3) - userData.defense
        );
        fight.playerHp -= monsterDamage;
        
        embed.setDescription(
            `${embed.data.description}\n\n` +
            `❤️ HP Anda: ${fight.playerHp}/${userData.maxHp}\n` +
            `💀 HP ${fight.monster.name}: ${fight.monsterHp}/${fight.monster.stats.hp}`
        );
        
        if (fight.playerHp <= 0) {
            await endMonsterFight(interaction, fight, userId, false);
        } else {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fight_attack')
                    .setLabel('⚔️ Serang')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('fight_flee')
                    .setLabel('🏃 Kabur')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.editReply({ 
                embeds: [embed],
                components: [row] 
            });
        }
    }
}

async function handlePvPAttack(interaction, fight, userId) {
    const isChallenger = userId === fight.challenger.id;
    const attacker = isChallenger ? fight.challenger : fight.target;
    const defender = isChallenger ? fight.target : fight.challenger;
    
    const { damage, isCrit } = calculateDamage(attacker, defender);
    defender.hp -= damage;
    
    const challengerUser = interaction.client.users.cache.get(fight.challenger.id);
    const targetUser = interaction.client.users.cache.get(fight.target.id);
    
    let resultMessage = `${isCrit ? '💥 **CRITICAL!** ' : ''}${interaction.user} menyerang! (${damage} damage)\n`;
    
    // Check if defender is still alive to counter
    if (defender.hp > 0) {
        const { damage: counterDamage } = calculateDamage(defender, attacker);
        attacker.hp -= counterDamage;
        
        resultMessage += `⚔️ ${defender.id === fight.challenger.id ? challengerUser : targetUser} membalas serangan! (${counterDamage} damage)\n`;
    }
    
    // Update HP display
    resultMessage += `\n${challengerUser.username}: ❤️ ${fight.challenger.hp}/${fight.challenger.maxHp}\n`;
    resultMessage += `${targetUser.username}: ❤️ ${fight.target.hp}/${fight.target.maxHp}`;
    
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚔️ Duel Sedang Berlangsung')
        .setDescription(resultMessage);
    
    // Check if fight ended
    if (fight.challenger.hp <= 0 || fight.target.hp <= 0) {
        await endPvPFight(interaction, fight);
    } else {
        // Switch turns
        fight.turn = defender.id;
        
        embed.setFooter({ text: `Giliran ${fight.turn === userId ? 'Anda' : 
            (fight.turn === fight.challenger.id ? challengerUser.username : targetUser.username)}` });
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fight_attack')
                .setLabel('⚔️ Serang')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('fight_defend')
                .setLabel('🛡️ Bertahan')
                .setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.editReply({ 
            embeds: [embed],
            components: [row] 
        });
    }
}

async function handlePvPDefend(interaction, fight, userId) {
    const isChallenger = userId === fight.challenger.id;
    const defender = isChallenger ? fight.challenger : fight.target;
    
    // Defense gives 50% damage reduction next turn
    defender.defense = Math.floor(defender.defense * 1.5);
    
    const challengerUser = interaction.client.users.cache.get(fight.challenger.id);
    const targetUser = interaction.client.users.cache.get(fight.target.id);
    
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('⚔️ Duel Sedang Berlangsung')
        .setDescription(`${interaction.user} memilih untuk bertahan!\nPertahanan meningkat 50% untuk serangan berikutnya.`)
        .addFields(
            { 
                name: challengerUser.username, 
                value: `HP: ${fight.challenger.hp}/${fight.challenger.maxHp}\nAttack: ${fight.challenger.attack}\nDefense: ${fight.challenger.defense}`,
                inline: true 
            },
            { 
                name: targetUser.username, 
                value: `HP: ${fight.target.hp}/${fight.target.maxHp}\nAttack: ${fight.target.attack}\nDefense: ${fight.target.defense}`,
                inline: true 
            }
        );
    
    // Switch turns
    fight.turn = isChallenger ? fight.target.id : fight.challenger.id;
    
    embed.setFooter({ text: `Giliran ${fight.turn === userId ? 'Anda' : 
        (fight.turn === fight.challenger.id ? challengerUser.username : targetUser.username)}` });
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('fight_attack')
            .setLabel('⚔️ Serang')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('fight_defend')
            .setLabel('🛡️ Bertahan')
            .setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.editReply({ 
        embeds: [embed],
        components: [row] 
    });
}

async function endMonsterFight(interaction, fight, userId, playerWon) {
    const embed = new EmbedBuilder();
    const userData = await economy.findOne({ userId });
    
    if (playerWon) {
        // Calculate rewards
        const xpReward = fight.monster.xp;
        const goldReward = Math.floor(
            Math.random() * (fight.monster.gold[1] - fight.monster.gold[0] + 1)
        ) + fight.monster.gold[0];
        
        // Check for item drops
        let dropMessage = '';
        if (fight.monster.drops && fight.monster.drops.length > 0) {
            const inventory = userData.inventory || {};
            for (const drop of fight.monster.drops) {
                if (Math.random() < drop.chance) {
                    const qty = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    inventory[drop.id] = (inventory[drop.id] || 0) + qty;
                    const item = items.find(i => i.id === drop.id);
                    if (item) {
                        dropMessage += `\n🎁 Mendapatkan ${item.name} x${qty}!`;
                    }
                }
            }
            await economy.updateOne({ userId }, { $set: { inventory } });
        }
        
        // Update user stats
        await economy.updateOne(
            { userId },
            { 
                $inc: { 
                    xp: xpReward,
                    balance: goldReward,
                    'stats.monstersDefeated': 1,
                    'stats.totalDamageDealt': fight.monster.stats.hp - fight.monsterHp
                } 
            }
        );
        
        embed
            .setColor('#00FF00')
            .setDescription(
                `🎉 Anda mengalahkan ${fight.monster.name}!\n` +
                `💰 Mendapatkan ${goldReward} koin dan ${xpReward} XP!` +
                dropMessage
            );
    } else {
        // Death penalty
        const xpLoss = Math.floor(userData.xp * 0.05); // Lose 5% XP
        await economy.updateOne(
            { userId },
            { 
                $set: { hp: userData.maxHp },
                $inc: { 
                    xp: -xpLoss,
                    'stats.deaths': 1,
                    'stats.totalDamageTaken': userData.maxHp - fight.playerHp
                } 
            }
        );
        
        embed
            .setColor('#FF0000')
            .setDescription(
                `💀 Anda dikalahkan oleh ${fight.monster.name}!\n` +
                `📉 Kehilangan ${xpLoss} XP dan dihidupkan kembali dengan HP penuh.`
            );
    }
    
    await interaction.editReply({ 
        embeds: [embed],
        components: [] 
    });
    activeFights.delete(userId);
}

async function endPvPFight(interaction, fight) {
    const winner = fight.challenger.hp > 0 ? fight.challenger : fight.target;
    const loser = fight.challenger.hp > 0 ? fight.target : fight.challenger;
    
    const winnerUser = interaction.client.users.cache.get(winner.id);
    const loserUser = interaction.client.users.cache.get(loser.id);
    
    // Calculate rewards and penalties
    const xpReward = Math.floor(loser.level * 10);
    const xpPenalty = Math.floor(loser.level * 5);
    
    // Update database
    await Promise.all([
        economy.updateOne(
            { userId: winner.id },
            { 
                $inc: { 
                    xp: xpReward,
                    'stats.playersDefeated': 1,
                    'stats.totalDamageDealt': winner.maxHp - winner.hp
                } 
            }
        ),
        economy.updateOne(
            { userId: loser.id },
            { 
                $set: { hp: loser.maxHp },
                $inc: { 
                    xp: -xpPenalty,
                    'stats.deaths': 1,
                    'stats.totalDamageTaken': loser.maxHp - loser.hp
                } 
            }
        )
    ]);
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('⚔️ Duel Selesai!')
        .setDescription(
            `🏆 ${winnerUser} memenangkan duel melawan ${loserUser}!\n\n` +
            `🎉 ${winnerUser.username} mendapatkan ${xpReward} XP\n` +
            `📉 ${loserUser.username} kehilangan ${xpPenalty} XP`
        );
    
    await interaction.editReply({ 
        embeds: [embed],
        components: [] 
    });
    
    activeFights.delete(fight.challenger.id);
    activeFights.delete(fight.target.id);
}

// Helper functions
function calculateDamage(attacker, defender) {
    const baseDamage = attacker.attack;
    const defenseReduction = Math.min(defender.defense * 0.5, baseDamage * 0.8);
    const finalDamage = Math.max(1, baseDamage - defenseReduction);
    
    // Critical chance based on dexterity (1% per 2 dex)
    const critChance = (attacker.dexterity || 0) / 2;
    const isCrit = Math.random() * 100 < critChance;
    
    return {
        damage: isCrit ? Math.floor(finalDamage * 1.5) : finalDamage,
        isCrit
    };
}

function calculateFleeChance(userData) {
    const baseChance = 40; // Base 40% chance
    const dexBonus = (userData.attributes?.dexterity || 0) * 2; // Each dex point adds 2%
    return Math.min(90, baseChance + dexBonus); // Max 90% flee chance
}