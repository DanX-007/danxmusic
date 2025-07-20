const { economy } = require("../../schemas/economy");
const { xpForLevel } = require("../../utils/levelUtils");
const { updateBankCapacity } = require("../../utils/bankUtils");

module.exports = async (message) => {
    if (message.author.bot) return;
    
    try {
        let userEconomy = await economy.findOne({ userId: message.author.id });

        if (!userEconomy) {
            userEconomy = new economy({
                userId: message.author.id,
                username: message.author.username
            });
            await userEconomy.save();
        }

        // Cooldown 1 menit
        const now = new Date();
        if (userEconomy.lastMessage && (now - userEconomy.lastMessage) < 60000) return;

        // Beri XP
        const xpGain = Math.floor(Math.random() * 10) + 5;
        userEconomy.xp += xpGain;
        userEconomy.lastMessage = now;

        // Cek level up
        const xpNeeded = xpForLevel(userEconomy.level);
        if (userEconomy.xp >= xpNeeded) {
            userEconomy.level += 1;
            userEconomy.xp -= xpNeeded;
            
            // Update bank capacity
            await updateBankCapacity(message.author.id);
            
            // Beri reward
            const reward = 500 * userEconomy.level;
            userEconomy.balance += reward;
            
            // Kirim notifikasi
            await message.channel.send({
                content: `🎉 **${message.author.username}** has leveled up to **level ${userEconomy.level}** and received **${reward.toLocaleString()} coins**!`
            });
        }

        await userEconomy.save();

    } catch (err) {
        console.error("XP Handler Error:", err);
    }
};