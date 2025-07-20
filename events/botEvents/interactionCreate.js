// After client initialization
const { handleItemUse, handleItemEquip } = require('../../events/rpgEvents');

client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    try {
        switch (interaction.customId) {
            case 'use_item_select':
                await handleItemUse(interaction);
                break;
            case 'equip_item_select':
                await handleItemEquip(interaction);
                break;
        }
    } catch (error) {
        console.error('Error handling select menu interaction:', error);
    }
});