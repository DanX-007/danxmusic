const mongoose = require('mongoose');
const { guild } = require('../schemas/guild'); // Make sure this path is correct

// Log actions to mod channel
async function logAction(client, guildId, action) {
  try {
    const guildData = await guild.findOne({ guildId });
    if (guildData?.modLogChannel) {
      const logChannel = client.channels.cache.get(guildData.modLogChannel);
      if (logChannel) {
        await logChannel.send(`[ADMIN] ${action}`);
      }
    }
  } catch (error) {
    console.error('Error logging action:', error);
  }
}

// Parse duration string (1d, 2h, 30m) to milliseconds
function parseDuration(duration) {
  const units = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
    w: 1000 * 60 * 60 * 24 * 7
  };

  const match = duration?.match(/^(\d+)([smhdw])$/);
  if (!match) return null;

  const [, amount, unit] = match;
  return amount * units[unit];
}

// Format duration for display
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

module.exports = { logAction, parseDuration, formatDuration };