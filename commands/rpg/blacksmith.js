const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, EmbedBuilder } = require('discord.js');
const { economy } = require('../../schemas/economy');
const recipes = require('../../data/recipe.json');
const items = require('../../data/items.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacksmith')
        .setDescription('Craft equipment or items using materials'),

    run: async ({ interaction }) => {
        try {
            await interaction.deferReply();
            
            const userId = interaction.user.id;
            const userData = await economy.findOne({ userId });

            if (!userData) {
                return interaction.editReply({ content: '❌ User data not found.', ephemeral: true });
            }

            const categories = Object.keys(recipes);
            const categoryMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_category')
                    .setPlaceholder('Select a category')
                    .addOptions(categories.map(cat => ({ 
                        label: cat.charAt(0).toUpperCase() + cat.slice(1), 
                        value: cat 
                    }))
            ));

            const reply = await interaction.editReply({ 
                content: 'Choose a category:', 
                components: [categoryMenu]
            });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000,
            });

            collector.on('collect', async i => {
                try {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({ content: '❌ This menu is not for you!', ephemeral: true });
                    }

                    if (i.customId === 'select_category') {
                        const selectedCategory = i.values[0];
                        const rarities = Object.keys(recipes[selectedCategory]);

                        const rarityMenu = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('select_rarity')
                                .setPlaceholder('Select a rarity')
                                .addOptions(rarities.map(rarity => ({ 
                                    label: rarity, 
                                    value: `${selectedCategory}:${rarity}` 
                                })))
                        );

                        await i.update({ 
                            content: `Category: **${selectedCategory}**\nNow choose a rarity:`, 
                            components: [rarityMenu] 
                        });
                    } 
                    else if (i.customId === 'select_rarity') {
                        const [category, rarity] = i.values[0].split(':');
                        const recipeItems = recipes[category][rarity];

                        const itemMenu = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('select_item')
                                .setPlaceholder('Select item to craft')
                                .addOptions(Object.keys(recipeItems).map(name => {
                                    const recipe = recipeItems[name];
                                    const canCraft = userData.skills.blacksmithing >= (recipe.requiredSkill || 1);
                                    return {
                                        label: `${name}${canCraft ? '' : ` (Skill ${recipe.requiredSkill})`}`,
                                        value: `${category}:${rarity}:${name}`,
                                        default: false,
                                        description: canCraft ? undefined : 'Skill level too low to craft this item'
                                    };
                                }))
                        );

                        await i.update({ 
                            content: `Category: **${category}**, Rarity: **${rarity}**\nNow select an item:`, 
                            components: [itemMenu] 
                        });
                    } 
                    else if (i.customId === 'select_item') {
                        const [category, rarity, itemName] = i.values[0].split(':');
                        const recipe = recipes[category][rarity][itemName];

                        // Check skill requirement
                        if (userData.skills.blacksmithing < (recipe.requiredSkill || 1)) {
                            return i.reply({
                                content: `❌ You need blacksmithing skill level **${recipe.requiredSkill}** to craft **${itemName}**. (Your skill: ${userData.skills.blacksmithing})`,
                                ephemeral: true
                            });
                        }

                        // Check materials
                        const missing = [];
                        let hasAllMaterials = true;

                        for (const [materialId, amount] of Object.entries(recipe.materials)) {
                            const owned = userData.inventory.get(materialId) || 0;
                            if (owned < amount) {
                                hasAllMaterials = false;
                                const materialName = items.find(i => i.id === materialId)?.name || materialId;
                                missing.push(`${materialName}: ${owned}/${amount}`);
                            }
                        }

                        if (!hasAllMaterials) {
                            return i.reply({
                                content: `❌ You are missing materials:\n${missing.join('\n')}`,
                                ephemeral: true,
                            });
                        }

                        // Deduct materials
                        for (const [materialId, amount] of Object.entries(recipe.materials)) {
                            const currentAmount = userData.inventory.get(materialId) || 0;
                            const newAmount = currentAmount - amount;
                            
                            if (newAmount <= 0) {
                                userData.inventory.delete(materialId);
                            } else {
                                userData.inventory.set(materialId, newAmount);
                            }
                        }

                        // Add crafted item
                        const craftedItemId = recipe.id;
                        const craftedItem = items.find(item => item.id === craftedItemId);
                        
                        if (!craftedItem) {
                            return i.reply({
                                content: '❌ Error: Crafted item not found in database.',
                                ephemeral: true
                            });
                        }

                        // Add to inventory
                        userData.inventory.set(
                            craftedItemId,
                            (userData.inventory.get(craftedItemId) || 0) + 1
                        );

                        // Update stats
                        userData.stats.craftingAttempts += 1;
                        userData.stats.craftingSuccess += 1;
                        
                        const currentCrafted = userData.stats.itemsCrafted.get(craftedItemId) || 0;
                        userData.stats.itemsCrafted.set(craftedItemId, currentCrafted + 1);

                        // Update blacksmithing skill
                        const xpGain = 10 * (['rare', 'epic', 'legendary'].includes(rarity) ? 2 : 1);
                        userData.skills.blacksmithingXp += xpGain;
                        
                        // Check for level up
                        const xpNeeded = 100 * userData.skills.blacksmithing;
                        if (userData.skills.blacksmithingXp >= xpNeeded) {
                            userData.skills.blacksmithing += 1;
                            userData.skills.blacksmithingXp = 0;
                        }

                        await userData.save();

                        const embed = new EmbedBuilder()
                            .setTitle('🛠️ Craft Successful!')
                            .setDescription(`You crafted **${craftedItem.name}**`)
                            .addFields(
                                { name: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true },
                                { name: 'Skill', value: `Blacksmithing: ${userData.skills.blacksmithing} (${userData.skills.blacksmithingXp}/${xpNeeded})`, inline: true },
                                { 
                                    name: 'Materials Used', 
                                    value: Object.entries(recipe.materials).map(([matId, qty]) => {
                                        const mat = items.find(i => i.id === matId);
                                        return `${mat?.name || matId}: ${qty}`;
                                    }).join('\n') 
                                }
                            )
                            .setColor('Green');

                        await i.update({ embeds: [embed], components: [] });
                        collector.stop();
                    }
                } catch (error) {
                    console.error('Blacksmith collector error:', error);
                    await i.reply({ content: '❌ An error occurred during crafting.', ephemeral: true });
                }
            });

            collector.on('end', () => {
                if (!interaction.replied) {
                    interaction.editReply({ content: 'Menu timed out.', components: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Blacksmith command error:', error);
            await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
        }
    },
    options: {
        verify: true
    }
};