const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { economy } = require('../../schemas/economy');
const items = require('../../data/items.json');

// Helper Functions
function getInventoryObject(inventory) {
  if (inventory instanceof Map) {
    const obj = {};
    for (const [key, value] of inventory.entries()) {
      obj[key] = value;
    }
    return obj;
  }
  if (typeof inventory === 'object' && inventory !== null) return inventory;
  return {};
}

async function cleanupExpiredBuffs(userId) {
  const now = new Date();
  const result = await economy.updateOne(
    { userId },
    { $pull: { tempBuffs: { expiresAt: { $lt: now } } } }
  );
  return result.modifiedCount;
}

function getEffectiveStat(userData, stat) {
  const base = userData[stat] || 0;
  const now = new Date();
  const activeBuffs = (userData.tempBuffs || [])
    .filter(buff => buff.stat === stat && new Date(buff.expiresAt) > now);
  const bonus = activeBuffs.reduce((sum, buff) => sum + buff.value, 0);
  return base + bonus;
}

// Main Command
module.exports = {
  data: new SlashCommandBuilder()
    .setName('item')
    .setDescription('Manage your inventory items')
    .addSubcommand(sub =>
      sub.setName('use')
        .setDescription('Use a consumable item')
    )
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Equip a weapon or armor')
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Check item information')
        .addStringOption(option =>
          option.setName('item')
            .setDescription('Item to check')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  run: async ({ interaction }) => {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    // Handle info subcommand
    if (subcommand === 'info') {
      const itemId = interaction.options.getString('item');
      const item = items.find(i => i.id === itemId);
      
      if (!item) {
        return interaction.editReply({ content: '❌ Item not found.' });
      }

      const embed = new EmbedBuilder()
        .setTitle(item.name)
        .setDescription(item.description || 'No description available.')
        .addFields(
          { name: 'Type', value: item.type, inline: true },
          { name: 'Rarity', value: item.rarity || 'Common', inline: true },
          { name: 'Value', value: `${item.price || 0} gold`, inline: true }
        );

      if (item.stats) {
        embed.addFields({
          name: 'Effects',
          value: Object.entries(item.stats)
            .map(([stat, value]) => `+${value} ${stat}`)
            .join('\n')
        });
      }

      if (item.levelRequirement) {
        embed.addFields({
          name: 'Requirement',
          value: `Level ${item.levelRequirement}`,
          inline: true
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // Handle use/equip subcommands
    const userData = await economy.findOne({ userId });
    if (!userData) {
      return interaction.editReply({ content: '❌ Your economic data was not found.' });
    }

    await cleanupExpiredBuffs(userId);

    const inventory = getInventoryObject(userData.inventory);
    const validItems = Object.entries(inventory)
      .filter(([id, qty]) => qty > 0 && items.some(i => i.id === id))
      .map(([id, qty]) => ({ ...items.find(i => i.id === id), quantity: qty }));

    const filteredItems = validItems.filter(item => {
      if (subcommand === 'equip') return ['weapon', 'armor'].includes(item.type);
      if (subcommand === 'use') return item.type === 'consumable' && item.stats;
      return false;
    });

    if (filteredItems.length === 0) {
      return interaction.editReply({
        content: `❌ You don't have any items to ${subcommand === 'equip' ? 'equip' : 'use'}.`
      });
    }

    const rows = [];
    for (const item of filteredItems.slice(0, 5)) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`item_${subcommand}_${item.id}`)
          .setLabel(`${item.name} (${item.quantity}x)`)
          .setStyle(ButtonStyle.Primary)
      );
      rows.push(row);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Select item to ${subcommand === 'equip' ? 'equip' : 'use'}`)
      .setDescription(filteredItems.map(i =>
        `**${i.name}** (${i.quantity}x)\n${i.description || 'No description available.'}`
      ).join('\n\n'))
      .setColor(subcommand === 'equip' ? 0xFF8800 : 0x00CC66);

    const reply = await interaction.editReply({
      embeds: [embed],
      components: rows
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 30000
    });

    collector.on('collect', async i => {
      await i.deferUpdate();
      const [_, action, ...itemIdParts] = i.customId.split('_');
      const itemId = itemIdParts.join('_');

      const item = items.find(it => it.id === itemId);
      if (!item) {
        return i.editReply({ content: '❌ Invalid item.', components: [] });
      }

      const currentData = await economy.findOne({ userId });
      if (!currentData) {
        return i.editReply({ content: '❌ User data not found.', components: [] });
      }

      const currentInventory = getInventoryObject(currentData.inventory);
      if (!currentInventory[itemId] || currentInventory[itemId] <= 0) {
        return i.editReply({ content: '❌ Item not in inventory.', components: [] });
      }

      // Check level requirement
      const userLevel = currentData.level || 1;
      const requiredLevel = item.levelRequirement || 1;
      if (userLevel < requiredLevel) {
        return i.editReply({
          content: `❌ You need level ${requiredLevel} to use this item.`,
          components: []
        });
      }

      try {
        if (action === 'use') {
          // Process consumable item
          const buffs = Object.entries(item.stats || {}).map(([stat, value]) => ({
            stat,
            value,
            expiresAt: new Date(Date.now() + (item.duration || 7200000)) // Default 2 hours
          }));

          currentInventory[itemId] -= 1;
          if (currentInventory[itemId] <= 0) delete currentInventory[itemId];

          await economy.updateOne(
            { userId },
            {
              $set: { inventory: currentInventory },
              $push: { tempBuffs: { $each: buffs } },
              $inc: { 'stats.itemsUsed': 1 }
            }
          );

          const buffText = buffs.map(b => `+${b.value} ${b.stat}`).join(', ');
          await i.editReply({
            content: `✅ Used **${item.name}**.\n🎯 Effects: ${buffText} (${item.duration ? (item.duration/1000) + ' seconds' : '2 hours'})`,
            components: []
          });

        // Di bagian handler equip:
} else if (action === 'equip') {
  const slot = item.type === 'weapon' ? 'mainHand' : 'armor';
  const currentEquipped = currentData.equipment?.[slot];
  
  // Hitung perubahan stat
  const statChanges = {};
  
  // Kurangi stat equipment lama (jika ada)
  if (currentEquipped) {
    const oldItem = items.find(i => i.id === currentEquipped);
    if (oldItem?.stats) {
      for (const [stat, val] of Object.entries(oldItem.stats)) {
        statChanges[stat] = (statChanges[stat] || 0) - val;
      }
    }
  }
  
  // Tambah stat equipment baru
  if (item.stats) {
    for (const [stat, val] of Object.entries(item.stats)) {
      statChanges[stat] = (statChanges[stat] || 0) + val;
    }
  }
  
  // Update inventory dan equipment
  currentInventory[itemId] -= 1;
  if (currentInventory[itemId] <= 0) delete currentInventory[itemId];
  
  if (currentEquipped) {
    currentInventory[currentEquipped] = (currentInventory[currentEquipped] || 0) + 1;
  }
  
  await economy.updateOne(
    { userId },
    {
      $set: {
        equipment: {
          ...currentData.equipment,
          [slot]: itemId
        },
        inventory: currentInventory
      },
      $inc: statChanges  // Langsung update stat player
    }
  );
}
      } catch (error) {
        console.error('Item processing error:', error);
        await i.editReply({
          content: '❌ Failed to process item.',
          components: []
        });
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },

  autocomplete: async (interaction) => {
    const focusedValue = interaction.options.getFocused();
    const filtered = items
      .filter(item => item.name.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25);
    await interaction.respond(
      filtered.map(item => ({ name: item.name, value: item.id }))
    );
  },

  options: {
    verify: true
  }
};