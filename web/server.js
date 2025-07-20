require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced MongoDB Atlas connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || '', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
};

// Connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to DB');
  app.emit('dbConnected'); // Emit event when DB is ready
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// API Routes with improved error handling

// Health check endpoint
app.get('/api/health', (req, res) => {
  const status = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  res.json({
    status,
    dbState: mongoose.STATES[mongoose.connection.readyState],
    uptime: process.uptime()
  });
});

app.get('/api/commands', async (req, res) => {
  try {
    const commandsPath = path.join(__dirname, '../commands');
    const commands = parseCommands(commandsPath);
    
    res.json({
      success: true,
      totalCommands: commands.length,
      commands: commands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        category: cmd.category,
        permissions: cmd.permissions,
        usageCount: Math.floor(Math.random() * 1000)
      }))
    });
  } catch (err) {
    console.error('Error fetching commands:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Database not connected'
    });
  }

  try {
    const type = req.query.type || 'balance';
    const limit = parseInt(req.query.limit) || 10;
    const { economy } = require('../schemas/economy');

    let users = await economy.find().lean().maxTimeMS(10000);

    // Process data for leaderboard
    if (type === 'networth') {
      users = users.map(user => ({
        ...user,
        value: user.balance + user.bank
      })).sort((a, b) => b.value - a.value);
    } else {
      users.forEach(user => {
        user.value = user[type];
      });
      users.sort((a, b) => b.value - a.value);
    }

    res.json({
      success: true,
      data: users.slice(0, limit).map((user, index) => ({
        username: user.username,
        value: user.value,
        rank: index + 1
      }))
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch leaderboard'
    });
  }
});

app.get('/api/game-data', async (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../data');
    
    const items = JSON.parse(fs.readFileSync(path.join(dataPath, 'items.json')));
    const monsters = JSON.parse(fs.readFileSync(path.join(dataPath, 'monsters.json')));
    const places = JSON.parse(fs.readFileSync(path.join(dataPath, 'places.json')));

    const raidBosses = monsters.filter(m => m.raidBoss);
    const regularMonsters = monsters.filter(m => !m.raidBoss);
    
    res.json({
      success: true,
      data: {
        totalItems: items.length,
        totalMonsters: monsters.length,
        raidBosses: raidBosses.map(boss => ({
          id: boss.id,
          name: boss.name,
          level: boss.level,
          hp: boss.stats.hp,
          attack: boss.stats.attack,
          image: boss.image || null
        })),
        regularMonsters: regularMonsters.slice(0, 20),
        places: places.map(place => ({
          id: place.id,
          name: place.name,
          type: place.type,
          levelRange: place.levelRange
        })),
        items: items.slice(0, 20)
      }
    });
  } catch (err) {
    console.error('Error loading game data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load game data'
    });
  }
});

// Helper function to parse commands
function parseCommands(commandsPath) {
  try {
    const categories = fs.readdirSync(commandsPath);
    const commands = [];

    categories.forEach(category => {
      const categoryPath = path.join(commandsPath, category);
      if(fs.statSync(categoryPath).isDirectory()) {
        const commandFiles = fs.readdirSync(categoryPath)
          .filter(file => file.endsWith('.js'));
        
        commandFiles.forEach(file => {
          try {
            const command = require(path.join(categoryPath, file));
            commands.push({
              name: command.data?.name || file.replace('.js'),
              description: command.data?.description || 'No description',
              category: category,
              permissions: command.data?.defaultMemberPermissions || 0
            });
          } catch (err) {
            console.error(`Error loading command ${file}:`, err);
          }
        });
      }
    });

    return commands;
  } catch (err) {
    console.error('Error parsing commands:', err);
    return [];
  }
}

// Start server only after DB connection
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 MongoDB connected: ${mongoose.connection.host}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});