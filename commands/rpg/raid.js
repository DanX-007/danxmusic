const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { economy } = require('../../schemas/economy');
const monsters = require('../../data/monsters.json');

// Global raid state
let activeRaid = null;
let raidMessage = null;
const attackCooldowns = new Map();
const raidParticipants = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raid')
        .setDescription('Raid system - Fight powerful bosses with other players')
        .addSubcommand(sub => sub
            .setName('start')
            .setDescription('Start a new raid (Admin only)')
            .addStringOption(option => 
                option.setName('difficulty')
                    .setDescription('Raid difficulty')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Normal', value: 'normal' },
                        { name: 'Hard', value: 'hard' },
                        { name: 'Nightmare', value: 'nightmare' }
                    )
            )
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('Check current raid status')
        ),
    
    run: async ({ interaction, client }) => {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'start') {
            await handleStartRaid(interaction);
        } 
        else if (subcommand === 'status') {
            await handleStatus(interaction);
        }
    },
    options: {
        verify: true
    }
};

async function handleStartRaid(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ 
            content: '❌ You need administrator permissions to start raids!',
            ephemeral: true 
        });
    }
    
    if (activeRaid) {
        return interaction.reply({ 
            content: '⛔ There is already an active raid!',
            ephemeral: true 
        });
    }
    
    const difficulty = interaction.options.getString('difficulty');
    const bossPool = monsters.filter(m => m.raidBoss && m.image);
    
    if (bossPool.length === 0) {
        return interaction.reply({ 
            content: '❌ No raid bosses with images available in monsters.json!',
            ephemeral: true 
        });
    }
    
    // Select random boss
    const baseBoss = bossPool[Math.floor(Math.random() * bossPool.length)];
    
    const difficultyMultipliers = {
        normal: 1,
        hard: 1.5,
        nightmare: 2.5
    };
    
    const multiplier = difficultyMultipliers[difficulty];
    const scaledBoss = {
        ...baseBoss,
        stats: {
            ...baseBoss.stats,
            hp: Math.floor(baseBoss.stats.hp * 15 * multiplier),
            attack: Math.floor(baseBoss.stats.attack * multiplier),
            defense: Math.floor(baseBoss.stats.defense * multiplier)
        },
        gold: [Math.floor(baseBoss.gold[0] * 20 * multiplier), Math.floor(baseBoss.gold[1] * 20 * multiplier)],
        xp: Math.floor(baseBoss.xp * 15 * multiplier)
    };
    
    activeRaid = {
        boss: scaledBoss,
        bossHp: scaledBoss.stats.hp,
        maxHp: scaledBoss.stats.hp,
        startTime: Date.now(),
        difficulty,
        phase: 1
    };
    
    raidParticipants.clear();
    attackCooldowns.clear();
    
    const embed = buildRaidEmbed();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('raid_attack')
            .setLabel('Attack Boss')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️')
    );
    
    raidMessage = await interaction.reply({ 
        content: '@here A NEW RAID HAS APPEARED!', 
        embeds: [embed],
        components: [row],
        fetchReply: true
    });
    
    try {
        await raidMessage.pin();
    } catch (error) {
        console.error('Failed to pin raid message:', error);
    }
    
    // Setup button collector
    const collector = raidMessage.createMessageComponentCollector({
        filter: i => i.customId === 'raid_attack',
        time: 2 * 60 * 60 * 1000
    });
    
    collector.on('collect', async i => {
        await i.deferUpdate();
        const userId = i.user.id;
        
        // Check cooldown
        const now = Date.now();
        const cooldown = 5000; // 5 second cooldown
        const lastAttack = attackCooldowns.get(userId) || 0;
        
        if (now - lastAttack < cooldown) {
            return i.followUp({ 
                content: `⏳ Please wait ${((cooldown - (now - lastAttack))/1000).toFixed(1)}s before attacking again!`,
                ephemeral: true 
            });
        }
        
        // Process attack
        const userData = await economy.findOne({ userId });
        if (!userData) {
            return i.followUp({ 
                content: '❌ Your economy profile is not created yet!',
                ephemeral: true 
            });
        }
        
        const { damage, isCrit } = calculateDamage(userData, activeRaid.boss);
        activeRaid.bossHp = Math.max(0, activeRaid.bossHp - damage);
        
        // Update participant data
        const participant = raidParticipants.get(userId) || { 
            totalDamage: 0, 
            attacks: 0
        };
        participant.totalDamage += damage;
        participant.attacks++;
        raidParticipants.set(userId, participant);
        attackCooldowns.set(userId, now);
        
        // Check for phase transitions
        checkPhaseTransition();
        
        // Update raid message
        await updateRaidMessage();
        
        // Send attack feedback
        await i.followUp({
            content: `${isCrit ? '💥 **CRITICAL HIT!** ' : ''}You dealt **${damage.toLocaleString()} damage** to ${activeRaid.boss.name}!`,
            ephemeral: true
        });
        
        // Check if boss is defeated
        if (activeRaid.bossHp <= 0) {
            await endRaid(i);
            collector.stop();
        }
    });
    
    collector.on('end', () => {
        if (raidMessage) {
            raidMessage.edit({ components: [] }).catch(console.error);
            raidMessage.unpin().catch(console.error);
            raidMessage = null;
        }
        activeRaid = null;
    });
    
    // Auto-end after 2 hours
    setTimeout(() => {
        if (activeRaid) {
            interaction.channel.send('⏰ The raid has timed out and the boss escaped!');
            collector.stop();
        }
    }, 2 * 60 * 60 * 1000);
}

async function updateRaidMessage() {
    if (!raidMessage || !activeRaid) return;
    
    try {
        const embed = buildRaidEmbed();
        await raidMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error('Failed to update raid message:', error);
    }
}

function buildRaidEmbed() {
    const progress = Math.max(0, (activeRaid.bossHp / activeRaid.maxHp) * 100);
    const progressBar = createProgressBar(progress);
    const elapsed = formatTime(Date.now() - activeRaid.startTime);
    
    const topDamage = [...raidParticipants.entries()]
        .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
        .slice(0, 3);
    
    const topDamageText = topDamage.map(([id, data], index) => 
        `**${index + 1}.** <@${id}> - ${data.totalDamage.toLocaleString()} damage`
    ).join('\n') || 'No participants yet';
    
    return new EmbedBuilder()
        .setColor(getPhaseColor())
        .setTitle(`⚔️ ${activeRaid.difficulty.toUpperCase()} RAID - ${activeRaid.boss.name}`)
        .setDescription(`**${activeRaid.boss.description || 'A fearsome foe appears!'}**`)
        .addFields(
            { name: '❤️ HP', value: `${activeRaid.bossHp.toLocaleString()}/${activeRaid.maxHp.toLocaleString()}`, inline: true },
            { name: '⚔️ Attack', value: `${activeRaid.boss.stats.attack}`, inline: true },
            { name: '🛡️ Defense', value: `${activeRaid.boss.stats.defense}`, inline: true },
            { name: 'Phase', value: `${activeRaid.phase}`, inline: true },
            { name: 'Time Elapsed', value: elapsed, inline: true },
            { name: 'Progress', value: `${progressBar} ${Math.floor(progress)}%`, inline: false },
            { name: 'Top Damage', value: topDamageText || 'None yet', inline: false }
        )
        .setImage(activeRaid.boss.image)
        .setFooter({ text: `Click the button to attack! | ${raidParticipants.size} participants` });
}

function getPhaseColor() {
    switch(activeRaid.phase) {
        case 1: return '#FF5555';
        case 2: return '#FFAA00';
        case 3: return '#FF0000';
        default: return '#5555FF';
    }
}

async function endRaid(interaction) {
    const totalDamage = [...raidParticipants.values()].reduce((sum, p) => sum + p.totalDamage, 0);
    const goldPool = activeRaid.boss.gold[1];
    const xpPool = activeRaid.boss.xp;
    const elapsed = formatTime(Date.now() - activeRaid.startTime);
    
    // Distribute rewards
    const rewards = [];
    for (const [userId, participant] of raidParticipants) {
        const damageShare = participant.totalDamage / totalDamage;
        const goldReward = Math.floor(goldPool * damageShare);
        const xpReward = Math.floor(xpPool * damageShare);
        
        await economy.updateOne(
            { userId },
            { 
                $inc: { 
                    balance: goldReward, 
                    xp: xpReward,
                    'stats.raidsCompleted': 1,
                    'stats.totalRaidDamage': participant.totalDamage
                } 
            }
        );
        
        rewards.push({ userId, gold: goldReward, xp: xpReward, damage: participant.totalDamage });
    }
    
    rewards.sort((a, b) => b.damage - a.damage);
    
    // Create victory embed
    const victoryEmbed = new EmbedBuilder()
        .setColor('#4BB543')
        .setTitle(`🎉 ${activeRaid.boss.name} DEFEATED!`)
        .setDescription(`The raid boss has been vanquished in ${elapsed}!`)
        .addFields(
            { name: 'Total Damage', value: totalDamage.toLocaleString(), inline: true },
            { name: 'Participants', value: raidParticipants.size.toString(), inline: true },
            { name: 'Difficulty', value: activeRaid.difficulty.toUpperCase(), inline: true }
        )
        .setImage(activeRaid.boss.image);
    
    if (rewards.length > 0) {
        victoryEmbed.addFields({
            name: '🏆 Top Raiders',
            value: rewards.slice(0, 3).map((r, i) => 
                `**${i + 1}.** <@${r.userId}> - ${r.damage.toLocaleString()} damage\n` +
                `💰 ${r.gold.toLocaleString()} gold | ✨ ${r.xp.toLocaleString()} XP`
            ).join('\n\n')
        });
    }
    
    await interaction.channel.send({ 
        content: '@here RAID VICTORY!', 
        embeds: [victoryEmbed] 
    });
}

async function handleStatus(interaction) {
    if (!activeRaid) {
        return interaction.reply({ 
            content: '❌ There is no active raid!',
            ephemeral: true 
        });
    }
    
    const embed = buildRaidEmbed();
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Helper functions
function calculateDamage(userData, boss) {
  // Dapatkan base attack (termasuk bonus dari equipment)
  const baseAttack = userData.attack || 1; // Sudah termasuk bonus equip
  
  // Variasi damage
  const baseDamage = baseAttack * (0.8 + Math.random() * 0.4);
  
  // Reduksi defense
  const defenseReduction = Math.min(
    boss.stats.defense * 0.3,  // Maksimal 30% reduction
    baseDamage * 0.7            // Tidak bisa kurangi lebih dari 70% damage
  );
  
  // Hitung final damage
  let damage = Math.max(1, Math.floor(baseDamage - defenseReduction));
  
  // Critical hit chance
  const critChance = (userData.dexterity || 0) / 100;
  const isCrit = Math.random() < critChance;
  
  if (isCrit) {
    damage = Math.floor(damage * 1.5);
  }
  
  return { damage, isCrit };
}

function checkPhaseTransition() {
    const hpPercentage = (activeRaid.bossHp / activeRaid.maxHp) * 100;
    
    if (activeRaid.phase === 1 && hpPercentage < 50) {
        activeRaid.phase = 2;
        activeRaid.boss.stats.attack = Math.floor(activeRaid.boss.stats.attack * 1.3);
    } 
    else if (activeRaid.phase === 2 && hpPercentage < 20) {
        activeRaid.phase = 3;
        activeRaid.boss.stats.attack = Math.floor(activeRaid.boss.stats.attack * 1.2);
        activeRaid.boss.stats.defense = Math.floor(activeRaid.boss.stats.defense * 0.8);
    }
}

function createProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;
}