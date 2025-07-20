console.log(`
██████╗  █████╗ ███╗   ██╗██╗  ██╗   ██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗████╗  ██║╚██╗██╔╝   ██╔══██╗██╔═══██╗╚══██╔══╝
██║  ██║███████║██╔██╗ ██║ ╚███╔╝    ██████╔╝██║   ██║   ██║   
██║  ██║██╔══██║██║╚██╗██║ ██╔██╗    ██╔══██╗██║   ██║   ██║   
██████╔╝██║  ██║██║ ╚████║██╔╝ ██╗   ██████╔╝╚██████╔╝   ██║   
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝   ╚═════╝  ╚═════╝    ╚═╝   
`);

// Install dependencies first
const { execSync } = require('child_process');
try {
    console.log("🔧 [1/6] Installing dependencies...");
    execSync('npm install', { stdio: 'inherit' });
    console.log("✅ [1/6] Dependencies installed successfully");
} catch (err) {
    console.error(`❌ [1/6] Failed to install dependencies: ${err.message}`);
    process.exit(1);
}

// Require dependencies
const { Client, GatewayIntentBits, Partials, REST } = require("discord.js");
const { Routes, GatewayDispatchEvents } = require('discord-api-types/v10');
const { readdirSync } = require("fs");
const { CommandKit } = require("commandkit");
const { connect } = require("mongoose");
const { logger } = require("./utils/logger");
const { Riffy } = require("riffy");
const SpotifyWebApi = require('spotify-web-api-node');
const config = require("./config");
const path = require("path");
const { startPointReset } = require('./utils/pointReset');
const { startBuffCleanup } = require('./utils/tempBuffs');
const { initializeQuests } = require('./schemas/quest');
const { guild, ticket } = require('./schemas/guild');
const { checkEndedGiveaways } = require('./utils/giveawayUtils');

class DanXBot {
    constructor() {
        console.log("⚙️ [2/6] Initializing bot client...");
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.GuildWebhooks,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildMessageTyping
            ],
            partials: [
                Partials.Message,
                Partials.Channel,
                Partials.Reaction,
                Partials.GuildMember,
                Partials.User
            ],
            allowedMentions: {
                parse: ['users', 'roles'],
                repliedUser: true
            }
        });

        this.client.spotify = new SpotifyWebApi({
            clientId: config.spotify.clientId,
            clientSecret: config.spotify.clientSecret
        });
        
        this.initializeRiffy();
        this.initializeCommandKit();
        console.log("✅ [2/6] Client initialized successfully");
    }

    initializeRiffy() {
        console.log("🔧 [3/6] Initializing Riffy music module...");
        this.client.riffy = new Riffy(
            this.client,
            config.riffyNodes,
            {
                ...config.riffyOptions,
                send: (payload) => {
                    const guild = this.client.guilds.cache.get(payload.d.guild_id);
                    if (guild) guild.shard.send(payload);
                },
            }
        );

        this.client.on("raw", (d) => {
            if (!['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE'].includes(d.t)) return;
            this.client.riffy.updateVoiceState(d);
        });
        console.log("✅ [3/6] Riffy initialized successfully");
    }

    initializeCommandKit() {
        new CommandKit({
            client: this.client,
            commandsPath: path.join(__dirname, "commands"),
            eventsPath: path.join(__dirname, "./events/botEvents"),
            validationsPath: path.join(__dirname, "validations"),
            devGuildIds: config.clientOptions.devGuild,
            devUserIds: config.clientOptions.devId,
        });

        const mentionReply = require('./events/messageCreate/mentionReply');
        const xpHandler = require("./events/messageCreate/xpHandler");
        const afkHandler = require("./events/messageCreate/afkHandler");
        this.client.on('messageCreate', afkHandler);
        this.client.on('messageCreate', mentionReply);
        this.client.on('messageCreate', xpHandler);
    }

    async checkTempBans() {
        try {
            const now = new Date();
            const guilds = await guild.find({ 'tempBans.unbanTime': { $lte: now } });

            for (const g of guilds) {
                for (const ban of g.tempBans.filter(b => b.unbanTime <= now)) {
                    try {
                        const targetGuild = this.client.guilds.cache.get(g.guildId);
                        if (targetGuild) {
                            await targetGuild.members.unban(ban.userId);
                            await guild.updateOne(
                                { guildId: g.guildId },
                                { $pull: { tempBans: { userId: ban.userId } } }
                            );
                            logger(`🔓 Unbanned user ${ban.userId} in guild ${g.guildId}`, "success");
                        }
                    } catch (error) {
                        logger(`❌ Failed to unban ${ban.userId}: ${error.message}`, "error");
                    }
                }
            }
        } catch (error) {
            logger(`❌ Temp ban check error: ${error.message}`, "error");
        }
    }

    async cleanupTickets() {
        try {
            const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const oldTickets = await ticket.find({ 
                status: 'closed',
                closedAt: { $lte: cutoffDate }
            });

            for (const t of oldTickets) {
                try {
                    const channel = this.client.channels.cache.get(t.channelId);
                    if (channel) {
                        await channel.delete('Auto-cleanup old ticket');
                        logger(`🗑️ Deleted ticket channel ${t.channelId}`, "debug");
                    }
                    await ticket.deleteOne({ channelId: t.channelId });
                } catch (error) {
                    logger(`❌ Failed to cleanup ticket ${t.channelId}: ${error.message}`, "error");
                }
            }
        } catch (error) {
            logger(`❌ Ticket cleanup error: ${error.message}`, "error");
        }
    }

    async checkConfig() {
        const requiredFields = [
            'clientToken',
            'clientId',
            'embedColor',
            'mongoUri',
            'devId',
            'devGuild',
            'defaultSearchPlatform',
            'spotify.clientId',
            'spotify.clientSecret',
            'riffyNodes'
        ];
    
        const missingFields = [];
    
        requiredFields.forEach(field => {
            const keys = field.split('.');
            let value = config;
    
            for (const key of keys) {
                value = value[key];
                if (value === undefined) break;
            }
    
            if (value === "" || value === null || (Array.isArray(value) && value.length === 0)) {
                missingFields.push(field);
            }
        });
    
        if (missingFields.length > 0) {
            logger(`❌ Missing required configuration fields: ${missingFields.join(', ')}`, "error");
            process.exit(1);
        }
        logger("✅ All required configuration fields are filled", "success");
    }

    async loadDb() {
        try {
            await connect(config.clientOptions.mongoUri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000
            });
            logger("✅ Successfully connected to MongoDB", "success");
        } catch (err) {
            logger(`❌ Failed to connect to MongoDB: ${err}`, "error");
            process.exit(1);
        }
    }

    async loadRiffy() {
        try {
            const eventDirs = readdirSync('./events/riffyEvents');
    
            for (const dir of eventDirs) {
                const eventFiles = readdirSync(`./events/riffyEvents/${dir}`).filter(file => file.endsWith('.js'));
    
                for (const file of eventFiles) {
                    try {
                        const event = require(`./events/riffyEvents/${dir}/${file}`);
                        if (typeof event === 'function') {
                            await event(this.client);
                        }
                    } catch (err) {
                        logger(`❌ Couldn't load Riffy event ${file}: ${err}`, "error");
                    }
                }
            }
            
            this.client.riffy.init(config.clientOptions.clientId);
            logger("✅ Riffy events initialized successfully", "success");
        } catch (error) {
            logger(`❌ Riffy initialization error: ${error.message}`, "error");
            process.exit(1);
        }
    }

    async getSpotifyAccessToken() {
        try {
            const data = await this.client.spotify.clientCredentialsGrant();
            this.client.spotify.setAccessToken(data.body['access_token']);
            logger("🔑 Spotify access token refreshed", "debug");
        } catch (err) {
            logger(`❌ Error retrieving Spotify token: ${err.message}`, "error");
        }
    }

    async start() {
        try {
            console.log("🔍 [5/6] Verifying configuration...");
            await this.checkConfig();
            
            console.log("🔗 [6/6] Connecting to databases...");
            await this.loadRiffy();
            await this.loadDb();
            await initializeQuests(); 
            startPointReset();
            startBuffCleanup();
            console.log("⏱️ Starting periodic tasks...");
            setInterval(() => this.checkTempBans(), 5 * 60 * 1000);
            setInterval(() => checkEndedGiveaways(this.client), 60 * 1000);
            setInterval(() => this.cleanupTickets(), 12 * 60 * 60 * 1000);

            console.log("🔑 Getting Spotify access token...");
            await this.getSpotifyAccessToken();

            try {
                console.log("🔐 Logging in to Discord...");
                await this.client.login(config.clientOptions.clientToken);
                logger("🤖 Bot logged in successfully", "success");
            } catch (err) {
                logger(`❌ Failed to log in: ${err.message}`, "error");
                process.exit(1);
            }

            setInterval(() => this.getSpotifyAccessToken(), 50 * 60 * 1000);
            console.log("\n🎉 Bot is now fully operational!\n");
        } catch (err) {
            logger(`💀 Fatal error during startup: ${err.message}`, "error");
            process.exit(1);
        }
    }
}

const DanX = new DanXBot();
DanX.start().catch(err => {
    logger(`💀 Fatal error during startup: ${err.message}`, "error");
    process.exit(1);
});