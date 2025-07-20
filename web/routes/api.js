const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Fungsi untuk parse command
const parseCommands = require('../utils/commandParser');

// Endpoint: Statistik Command
router.get('/commands', (req, res) => {
    const commandsPath = path.join(__dirname, '../../commands');
    const commands = parseCommands(commandsPath);
    
    res.json({
        totalCommands: commands.length,
        commands: commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            category: cmd.category,
            permissions: cmd.permissions
        }))
    });
});

// Endpoint: Data Ekonomi
router.get('/economy', async (req, res) => {
    const Economy = require('../../schemas/economy').economy;
    const topUsers = await Economy.find().sort({ balance: -1 }).limit(10);
    
    res.json(topUsers.map(user => ({
        username: user.username,
        balance: user.balance,
        level: user.level
    })));
});

// Endpoint: Game Data
router.get('/game-data', (req, res) => {
    const dataPath = path.join(__dirname, '../../data');
    
    const items = JSON.parse(fs.readFileSync(path.join(dataPath, 'items.json')));
    const monsters = JSON.parse(fs.readFileSync(path.join(dataPath, 'monsters.json')));
    const places = JSON.parse(fs.readFileSync(path.join(dataPath, 'places.json')));
    
    // Filter raid bosses
    const raidBosses = monsters.filter(m => m.raidBoss);
    
    res.json({
        totalItems: items.length,
        totalMonsters: monsters.length,
        raidBosses: raidBosses.map(boss => ({
            name: boss.name,
            level: boss.level,
            hp: boss.stats.hp
        })),
        places: places.map(place => ({
            name: place.name,
            levelRange: place.levelRange,
            type: place.type
        }))
    });
});

// Endpoint: Bot Info
router.get('/botinfo', (req, res) => {
    // Contoh data statis - bisa diganti dengan data real
    res.json({
        uptime: process.uptime(),
        ramUsage: process.memoryUsage().rss / (1024 * 1024),
        guildCount: 42,
        userCount: 1500
    });
});

module.exports = router;