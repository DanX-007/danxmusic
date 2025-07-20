const { SlashCommandBuilder } = require('discord.js');
const { economy } = require('../../schemas/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Buat profil ekonomi baru')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Nama karakter Anda')
                .setRequired(true)
                .setMaxLength(20)),
    
    run: async ({ interaction }) => {
        const userId = interaction.user.id;
        const username = interaction.options.getString('name');
        
        try {
            // Cek apakah user sudah memiliki profil
            const existingUser = await economy.findOne({ userId });
            
            if (existingUser) {
                return interaction.reply({ 
                    content: '❌ Anda sudah memiliki profil ekonomi!', 
                    ephemeral: true 
                });
            }
            
            // Buat profil baru dengan semua field default
            const newUser = new economy({
                userId,
                username,
                // Basic info
                verify: true,
                title: 'Newbie',
                
                // Currency
                balance: 1000,
                bank: 0,
                bankCapacity: 10000,
                
                // Progression
                xp: 0,
                level: 1,
                reputation: 0,
                hp: 100,
                maxHp: 100,
                attack: 10,
                dexterity: 10,
                defense: 5,
                
                // Cooldowns (null semua)
                lastMessage: null,
                lastDaily: null,
                lastWeekly: null,
                lastMonthly: null,
                lastYearly: null,
                lastBonus: null,
                lastWork: null,
                lastRaid: null,
                
                // Skills
                skills: {
                    blacksmithing: 1,
                    blacksmithingXp: 0,
                    mining: 0,
                    miningXp: 0,
                    woodcutting: 0,
                    woodcuttingXp: 0
                },
                
                // Stats
                stats: {
                    monstersDefeated: 0,
                    playersDefeated: 0,
                    totalDamageDealt: 0,
                    totalDamageTaken: 0,
                    deaths: 0,
                    criticalHits: 0,
                    fleeAttempts: 0,
                    fleeSuccess: 0,
                    stepsTaken: 0,
                    craftingAttempts: 0,
                    craftingSuccess: 0,
                    itemsCrafted: new Map(),
                    moneyEarned: 0,
                    moneySpent: 0,
                    itemsBought: 0,
                    itemsSold: 0,
                    raidsCompleted: 0,
                    raidDamage: 0,
                    raidBossesDefeated: new Map()
                },
                
                // Equipment
                equipment: {
                    mainHand: undefined,
                    armor: undefined
                },
                
                // Inventory (default all 0 in schema, but we'll give some starter items)
                inventory: new Map([
                    ['wood_sword', 0],
                    ['health_potion', 1],
                    ['wood', 5],
                    ['stone', 3],
                    ['iron_ore', 1]
                ]),
                
                // Temp Buffs
                tempBuffs: [],
                
                // Points system
                points: {
                    current: 5,
                    lastReset: new Date()
                },
                
                // Quests
                activeQuests: [],
                completedQuests: [],
                questProgress: new Map(),
                
                // Titles
                unlockedTitles: [],
                currentTitle: null,
                
                // Adventure
                lastLocation: 'whispering_hollows',
                discoveredLocations: ['whispering_hollows']
            });
            
            await newUser.save();
            
            interaction.reply({ 
                content: `✅ Profil ekonomi berhasil dibuat untuk **${username}**!\n` +
                         `Anda mendapatkan:\n` +
                         `- 1000 koin awal\n` +
                         `- 1x Health Potion\n` +
                         `- 5x Wood\n` +
                         `- 3x Stone\n` +
                         `- 1x Iron Ore\n` +
                         `- Skill Blacksmithing Level 1\n` +
                         `- 5 Skill Points\n` +
                         `- Akses ke lokasi: Whispering Hollows`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Error creating economy profile:', error);
            interaction.reply({ 
                content: '❌ Gagal membuat profil ekonomi. Silakan coba lagi nanti.', 
                ephemeral: true 
            });
        }
    }
};