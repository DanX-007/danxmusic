const { Schema, model } = require("mongoose");

const economySchema = new Schema({
    // Basic user info
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    verify: { type: Boolean, default: false },
    title: { type: String, default: 'Newbie' },

    // Currency system
    balance: { type: Number, default: 1000 },
    bank: { type: Number, default: 0 },
    bankCapacity: { type: Number, default: 10000 },

    // Progression system
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    reputation: { type: Number, default: 0 },
    hp: { type: Number, default: 100 },
    maxHp: { type: Number, default: 100 },
    attack: { type: Number, default: 10 },
    dexterity: { type: Number, default: 10 },
    defense: { type: Number, default: 5 },

    // Cooldowns
    lastMessage: { type: Date },
    lastDaily: { type: Date },
    lastWeekly: { type: Date },
    lastMonthly: { type: Date },
    lastYearly: { type: Date },
    lastBonus: { type: Date },
    lastWork: { type: Date },
    lastRaid: { type: Date },

    // Skills system
    skills: {
        blacksmithing: { type: Number, default: 1 },
        blacksmithingXp: { type: Number, default: 0 },
        mining: { type: Number, default: 0 },
        miningXp: { type: Number, default: 0 },
        woodcutting: { type: Number, default: 0 },
        woodcuttingXp: { type: Number, default: 0 }
    },

    // Stats tracking
    stats: {
        // Combat
        monstersDefeated: { type: Number, default: 0 },
        playersDefeated: { type: Number, default: 0 },
        totalDamageDealt: { type: Number, default: 0 },
        totalDamageTaken: { type: Number, default: 0 },
        deaths: { type: Number, default: 0 },
        criticalHits: { type: Number, default: 0 },
        
        // Movement
        fleeAttempts: { type: Number, default: 0 },
        fleeSuccess: { type: Number, default: 0 },
        stepsTaken: { type: Number, default: 0 },
        
        // Crafting
        craftingAttempts: { type: Number, default: 0 },
        craftingSuccess: { type: Number, default: 0 },
        itemsCrafted: { type: Map, of: Number, default: {} },
        
        // Economy
        moneyEarned: { type: Number, default: 0 },
        moneySpent: { type: Number, default: 0 },
        itemsBought: { type: Number, default: 0 },
        itemsSold: { type: Number, default: 0 },
        
        // Raids
        raidsCompleted: { type: Number, default: 0 },
        raidDamage: { type: Number, default: 0 },
        raidBossesDefeated: { type: Map, of: Number, default: {} }
    },


    // Equipment system   
      equipment: {
  mainHand: { type: String, default: undefined },
  armor: { type: String, default: undefined }
},


    // Inventory system
    inventory: { 
        type: Map, 
        of: Number, 
        default: {
            'wood_sword': 0,
            'health_potion': 0,
            'wood': 0,
            'stone': 0,
            'iron_ore': 0
        } 
    },
     tempBuffs: {
    type: [
      new Schema({
        stat: { type: String, required: true },
        value: { type: Number, required: true },
        expiresAt: { type: Date, required: true }
      }, { _id: false })
    ],
    default: []
  },
    
    points: {
        current: { 
            type: Number, 
            default: 5, 
            min: 0, 
            max: 5 
        },
        lastReset: { 
            type: Date, 
            default: Date.now 
        }
    },
    // Quests
    activeQuests: { type: Array, default: [] },
    completedQuests: { type: Array, default: [] },
    questProgress: {
  type: Map,
  of: new Schema({
    completions: { type: Number, default: 0 },
    lastAttempt: { type: Date }
  }),
  default: new Map()
},
    unlockedTitles: {
        type: [{
            name: { type: String, required: true },
            stats: {
                attack: { type: Number, default: 0 },
                defense: { type: Number, default: 0 },
                maxHp: { type: Number, default: 0 },
                dexterity: { type: Number, default: 0 }
                // tambahkan stat lainnya sesuai kebutuhan
            }
        }],
        default: []
    },
    currentTitle: { type: String, default: null },
    // Adventure
    lastLocation: { type: String, default: 'whispering_hollows' },
    discoveredLocations: { type: Array, default: ['whispering_hollows'] }
});

module.exports = {
    economy: model("economy", economySchema)
}