const { model, Schema } = require("mongoose");

// 1. Schema untuk Guild (sudah ada)
const guildSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    buttons: { type: Boolean, default: true },
    reconnect: {
        status: { type: Boolean, default: false },
        textChannel: { type: String, default: null },
        voiceChannel: { type: String, default: null }
    },
    // Tambahan untuk fitur admin
    prefix: { type: String, default: "/" },
    modLogChannel: { type: String, default: null },
    welcomeChannel: { 
        type: String, 
        default: null 
    },
    welcomeMessage: {
        type: String,
        default: "Welcome {user} to {server}!"
    },
    welcomeRole: {
        type: String,
        default: null
    },
    autoRole: { type: String, default: null },
    muteRole: { type: String, default: null }, // Untuk sistem mute
    tempBans: [{ // Untuk ban sementara
        userId: String,
        unbanTime: Date,
        reason: String,
        moderatorId: String,
        createdAt: { type: Date, default: Date.now }
    }],
    pollCooldown: { type: Number, default: 0 }, // Cooldown pembuatan poll
    rolePersist: { // Untuk menyimpan role ketika user keluar
        enabled: { type: Boolean, default: false },
        roles: [{
            userId: String,
            roleIds: [String]
        }]
    }
});

// 2. Schema untuk Warn System
const warnSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: "No reason provided" },
    timestamp: { type: Date, default: Date.now },
    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" }, // Tingkat keparahan warn
    expiresAt: { type: Date, default: null } // Jika warn bisa kadaluarsa
});

// 3. Schema untuk Tickets
const ticketSchema = new Schema({
    guildId: String,
    channelId: String,
    userId: String,
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    createdAt: { type: Date, default: Date.now },
    closedAt: Date,
    closedBy: String
});
// 4. Schema untuk Auto-Moderation
const autoModSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    badWords: { type: [String], default: [] },
    allowedLinks: { type: [String], default: [] },
    antiSpam: { type: Boolean, default: true },
    maxMentions: { type: Number, default: 5 }
});

// 5. Schema untuk Giveaways
const giveawaySchema = new Schema({
    guildId: String,
    channelId: String,
    messageId: String,
    prize: String,
    winnerCount: Number,  // Number of winners to pick
    winners: [String],    // Array of winner user IDs
    endTime: Date,
    hostId: String,
    participants: [String],
    ended: Boolean
});


// 6. Schema untuk Sticky Messages
const stickySchema = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    messageId: { type: String, required: true },
    content: { type: String, required: true },
    lastUpdate: { type: Date, default: Date.now }
});

// 7. Schema untuk Voice Channel Manager
const voiceSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    channelId: { type: String, required: true },
    isTemp: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// 9.Schema untuk pooling
const pollSchema = new Schema({
    guildId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    creatorId: { type: String, required: true },
    question: { type: String, required: true },
    options: [{
        text: String,
        voters: [String] // Array of user IDs
    }],
    endsAt: { type: Date, default: null },
    maxVotes: { type: Number, default: 1 }
});

// Export semua model
module.exports = {
    guild: model("guild", guildSchema),
    warn: model("warn", warnSchema),
    ticket: model("ticket", ticketSchema),
    automod: model("automod", autoModSchema),
    giveaway: model("giveaway", giveawaySchema),
    sticky: model("sticky", stickySchema),
    voice: model("voice", voiceSchema),
    pool: model("pool", pollSchema)
};