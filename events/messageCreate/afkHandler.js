// events/messageCreate.js (or wherever you handle messages)
const { afk } = require("../../schemas/afk");

module.exports = async (message) => {
    if (message.author.bot) return;

    try {
        const userData = await afk.findOne({ userId: message.author.id });
        if (userData?.isAfk) {
            // User is no longer AFK
            await afk.updateOne(
                { userId: message.author.id },
                { 
                    $set: { isAfk: false },
                    $unset: { afkReason: "", afkSince: "" }
                }
            );

            const reply = await message.reply(`Welcome back ${message.author.username}! You were AFK: ${userData.afkReason}`);
            
            // Delete the welcome back message after 5 seconds
            setTimeout(() => reply.delete().catch(() => {}), 5000);
        }
    } catch (error) {
        console.error("AFK message handler error:", error);
    }
};