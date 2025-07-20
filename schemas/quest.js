const { Schema, model } = require("mongoose");

const questSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    requiredLevel: { type: Number, default: 1 },
    maxCompletions: { type: Number, default: 10 },
    baseSuccessChance: { type: Number, default: 70 },
    rewards: {
        xp: { type: Number, default: 0 },
        balance: { type: Number, default: 0 },
        items: { type: Map, of: Number, default: {} }
    },
    titleReward: {
        name: { type: String },
        stats: {
            attack: { type: Number, default: 0 },
            defense: { type: Number, default: 0 },
            maxHp: { type: Number, default: 0 }
        }
    },
    category: { 
        type: String, 
        enum: ['combat', 'gathering', 'crafting', 'exploration'], 
        required: true 
    }
}, { timestamps: true });

// Buat model Quest
const Quest = model("Quest", questSchema);

// Fungsi untuk inisialisasi quest dari JSON
async function initializeQuests() {
    const quests = require('../data/quests.json');
    const operations = quests.map(quest => ({
        updateOne: {
            filter: { id: quest.id },
            update: { $set: quest },
            upsert: true
        }
    }));

    await Quest.bulkWrite(operations);
    console.log(`[Quest] Initialized ${quests.length} quests`);
}

module.exports = {
    Quest,
    initializeQuests
};