const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { economy } = require("../../schemas/economy");
const { logger } = require("../../utils/logger");
const config = require("../../config");
const items = require("../../data/items.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("View your or another user's profile")
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user whose profile you want to view")
                .setRequired(false))
        .addStringOption(option =>
            option.setName("view")
                .setDescription("What to view directly")
                .addChoices(
                    { name: "Inventory", value: "inventory" },
                    { name: "Titles", value: "titles" }
                )
                .setRequired(false)),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const viewOption = interaction.options.getString("view");

        try {
            let userEconomy = await economy.findOne({ userId: targetUser.id });

            if (!userEconomy) {
                userEconomy = new economy({
                    userId: targetUser.id,
                    username: targetUser.username,
                    balance: targetUser.id === interaction.user.id ? 1000 : 0,
                    bank: 0,
                    bankCapacity: 10000,
                    level: 1,
                    xp: 0,
                    hp: 100,
                    maxHp: 100,
                    attack: 10,
                    dexterity: 10,
                    defense: 5,
                    inventory: {},
                    equipment: {
                        mainHand: null,
                        armor: null
                    },
                    points: {
                        current: 5,
                        lastReset: new Date()
                    },
                    createdAt: new Date()
                });
                await userEconomy.save();
            }

            // Handle direct view options
            if (viewOption === "inventory") {
                return await showInventory(interaction, userEconomy, targetUser);
            }
            if (viewOption === "titles") {
                return await showTitles(interaction, userEconomy, targetUser);
            }

            const netWorth = userEconomy.balance + userEconomy.bank;
            const xpToNextLevel = Math.pow(userEconomy.level, 2) * 100;
            const progress = Math.min(Math.round((userEconomy.xp / xpToNextLevel) * 100), 100);

            // Stat bonus dari equipment
            const baseStats = { attack: 10, defense: 5, maxHp: 100 };
            let bonusStats = { attack: 0, defense: 0, maxHp: 0 };

            const getItem = (id) => items.find(i => i.id === id);
            const mainItem = getItem(userEconomy.equipment.mainHand);
            const armorItem = getItem(userEconomy.equipment.armor);

            for (const item of [mainItem, armorItem]) {
                if (item?.stats) {
                    if (item.stats.attack) bonusStats.attack += item.stats.attack;
                    if (item.stats.defense) bonusStats.defense += item.stats.defense;
                    if (item.stats.maxHp) bonusStats.maxHp += item.stats.maxHp;
                }
            }

            // Embed utama
            embed
                .setAuthor({ 
                    name: `${targetUser.username}'s Profile`, 
                    iconURL: targetUser.displayAvatarURL() 
                })
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    {
                        name: "📈 Progress",
                        value: `🏆 Level: \`${userEconomy.level}\`\n✨ XP: \`${userEconomy.xp}/${xpToNextLevel}\` (${progress}%)\n🎯 Points: \`${userEconomy.points?.current || 0}\``,
                        inline: true
                    },
                    {
                        name: "🧬 Stats",
                        value: `⚔️ Attack: \`${baseStats.attack + bonusStats.attack}\` (Base: ${baseStats.attack} + ${bonusStats.attack})\n🛡️ Defense: \`${baseStats.defense + bonusStats.defense}\` (Base: ${baseStats.defense} + ${bonusStats.defense})\n❤️ Max HP: \`${baseStats.maxHp + bonusStats.maxHp}\` (Base: ${baseStats.maxHp} + ${bonusStats.maxHp})\n💖 Current HP: \`${userEconomy.hp}/${userEconomy.maxHp}\``,
                        inline: true
                    },
                    {
                        name: "💰 Money",
                        value: `💸 Balance: \`${userEconomy.balance.toLocaleString()}\`\n🏦 Bank: \`${userEconomy.bank.toLocaleString()}/${userEconomy.bankCapacity.toLocaleString()}\`\n💎 Net Worth: \`${netWorth.toLocaleString()}\``,
                        inline: false
                    },
                    {
                        name: "📅 Member Since",
                        value: userEconomy.createdAt.toLocaleDateString(),
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL() 
                });

            // Equipment detail
            const equippedItems = [];

            if (mainItem) {
                equippedItems.push(`⚔️ **Weapon:** ${mainItem.name}\n> ${mainItem.description || 'No description.'}\n> 📈 Stat: ${Object.entries(mainItem.stats).map(([k, v]) => `\`${k}: +${v}\``).join(', ')}`);
            }

            if (armorItem) {
                equippedItems.push(`🛡️ **Armor:** ${armorItem.name}\n> ${armorItem.description || 'No description.'}\n> 📈 Stat: ${Object.entries(armorItem.stats).map(([k, v]) => `\`${k}: +${v}\``).join(', ')}`);
            }

            if (equippedItems.length > 0) {
                embed.addFields({
                    name: "🎽 Equipment",
                    value: equippedItems.join('\n\n'),
                    inline: false
                });
            }

            // Action buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`inventory_${targetUser.id}`)
                        .setLabel('📦 Inventory')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`titles_${targetUser.id}`)
                        .setLabel('🏆 Titles')
                        .setStyle(ButtonStyle.Secondary)
                );

            const reply = await interaction.reply({ 
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && (i.customId.startsWith('inventory_') || i.customId.startsWith('titles_')),
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId.startsWith('inventory_')) {
                    await showInventory(i, userEconomy, targetUser);
                } else if (i.customId.startsWith('titles_')) {
                    await showTitles(i, userEconomy, targetUser);
                }
            });

            collector.on('end', () => {
                reply.edit({ components: [] }).catch(() => {});
            });

        } catch (err) {
            logger(err, "error");
            return interaction.reply({ 
                embeds: [embed.setDescription(`\`❌\` | Error: ${err.message}`)], 
                ephemeral: true 
            });
        }
    },
    options: {
        verify: true
    }
};

async function showInventory(interaction, userData, targetUser) {
    const embed = new EmbedBuilder()
        .setColor(config.clientOptions.embedColor)
        .setAuthor({
            name: `${targetUser.username}'s Inventory`,
            iconURL: targetUser.displayAvatarURL()
        });

    // Convert inventory to object format
    let inventory = {};
    if (userData.inventory instanceof Map) {
        inventory = Object.fromEntries(userData.inventory.entries());
    } else if (typeof userData.inventory === 'object') {
        inventory = userData.inventory;
    }

    // Filter out invalid items and map to include item names
    const inventoryItems = Object.entries(inventory)
        .filter(([id, qty]) => qty > 0 && items.some(item => item.id === id))
        .map(([id, qty]) => {
            const item = items.find(i => i.id === id);
            return {
                name: item ? item.name : id,
                qty,
                rarity: item?.rarity || 'common'
            };
        });

    if (inventoryItems.length === 0) {
        embed.setDescription('Inventory is empty!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Sort by rarity then by name
    const rarityOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
    inventoryItems.sort((a, b) => {
        if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
            return rarityOrder[a.rarity] - rarityOrder[b.rarity];
        }
        return a.name.localeCompare(b.name);
    });

    // Format the inventory display with rarity emojis
    embed.setDescription(
        inventoryItems.map(item => {
            const emoji = getRarityEmoji(item.rarity);
            return `${emoji} **${item.name}**: ${item.qty}x`;
        }).join('\n')
    );

    embed.setFooter({ 
        text: `Total items: ${inventoryItems.reduce((sum, item) => sum + item.qty, 0)}` 
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showTitles(interaction, userData, targetUser) {
    const embed = new EmbedBuilder()
        .setColor(config.clientOptions.embedColor)
        .setAuthor({
            name: `${targetUser.username}'s Titles`,
            iconURL: targetUser.displayAvatarURL()
        });

    if (!userData.unlockedTitles || userData.unlockedTitles.length === 0) {
        embed.setDescription('No titles unlocked yet!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const currentTitle = userData.currentTitle || 'None';
    
    embed.setDescription(`**Currently Equipped:** ${currentTitle}\n\n**Available Titles:**`)
         .addFields(
             userData.unlockedTitles.map(title => ({
                 name: `${title.name} ${title.name === currentTitle ? '⭐' : ''}`,
                 value: formatStats(title.stats),
                 inline: true
             }))
         );

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`equip_title_${targetUser.id}`)
                .setLabel('Equip Title')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(userData.unlockedTitles.length === 0)
        );

    const reply = await interaction.reply({ 
        embeds: [embed], 
        components: [row],
        ephemeral: true,
        fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId === `equip_title_${targetUser.id}`,
        time: 60000
    });

    collector.on('collect', async i => {
        await handleTitleEquip(i, userData, targetUser);
    });
}

async function handleTitleEquip(interaction, userData, targetUser) {
    const embed = new EmbedBuilder()
        .setColor(config.clientOptions.embedColor)
        .setAuthor({
            name: `Equip Title - ${targetUser.username}`,
            iconURL: targetUser.displayAvatarURL()
        });

    if (!userData.unlockedTitles || userData.unlockedTitles.length === 0) {
        embed.setDescription('No titles available to equip!');
        return interaction.update({ embeds: [embed], components: [] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_title')
        .setPlaceholder('Select a title to equip')
        .addOptions(
            userData.unlockedTitles.map(title => ({
                label: title.name,
                description: formatStats(title.stats),
                value: title.name
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({ 
        embeds: [embed.setDescription('Select a title to equip:')],
        components: [row] 
    });

    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId === 'select_title',
        time: 30000
    });

    collector.on('collect', async i => {
        const selectedTitle = userData.unlockedTitles.find(t => t.name === i.values[0]);
        await economy.updateOne(
            { userId: targetUser.id },
            { $set: { currentTitle: selectedTitle.name } }
        );
        
        embed.setDescription(`✅ Successfully equipped title: **${selectedTitle.name}**\n${formatStats(selectedTitle.stats)}`);
        await i.update({ embeds: [embed], components: [] });
    });

    collector.on('end', () => {
        if (!interaction.replied) {
            interaction.editReply({ components: [] }).catch(() => {});
        }
    });
}

function formatStats(stats) {
    const parts = [];
    if (stats?.attack) parts.push(`⚔️ Attack: +${stats.attack}`);
    if (stats?.defense) parts.push(`🛡️ Defense: +${stats.defense}`);
    if (stats?.maxHp) parts.push(`❤️ Max HP: +${stats.maxHp}`);
    return parts.join('\n') || 'No stat bonuses';
}

function getRarityEmoji(rarity) {
    const emojis = {
        mythic: '🟠',
        legendary: '🟡',
        epic: '🟣',
        rare: '🔵',
        uncommon: '🟢',
        common: '⚪'
    };
    return emojis[rarity?.toLowerCase()] || '⚪';
}