// events/queueEnd.js
const { parseTimeString } = require("../../../utils/parseTimeString");
const { EmbedBuilder, ActivityType } = require("discord.js");
const config = require("../../../config");
const axios = require('axios');

module.exports = async (client) => {
    client.riffy.on("queueEnd", async (player) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const channel = client.channels.cache.get(player.textChannel);

        // Hapus pesan pemutaran terakhir
        if (player.message) {
            await player.message.delete().catch(() => {});
        }

        // Jika autoplay aktif, mulai autoplay dan biarkan trackStart menangani presence
        if (player.isAutoplay === true) {
            player.autoplay(player);
            return;
        }

        // Jika 24/7 tidak aktif, keluar dari voice dan update presence
        const is247 = await check247Status(player.guildId, client);
        const voiceChannelId = player.voiceChannel;

        if (!is247) {
            player.destroy();
        }

        // Tampilkan pesan embed bahwa queue kosong
        const message = await channel.send({ 
            embeds: [embed.setDescription("The queue is empty. You can make the bot stay in VC using the `/247` command.")] 
        }).catch(() => null);

        if (message) {
            setTimeout(() => {
                message.delete().catch(() => {});
            }, parseTimeString("30s"));
        }

        // Update status presence bot ke default
        setDefaultPresence(client);
    });
};

// 🔄 Fallback ke presence default
function setDefaultPresence(client) {
    // Daftar aktivitas yang akan dirotasi
    const activities = [
        {
            name: `${client.guilds.cache.size} guilds connected`,
            type: ActivityType.Watching
        },
        {
            name: "🎵 Use /play to listen",
            type: ActivityType.Listening
        },
        {
            name: "🗡️ Type /setup to begin RPG",
            type: ActivityType.Playing
        },
        {
            name: "✨ Powered by DanX",
            type: ActivityType.Custom
        }
    ];

    let currentIndex = 0;
    
    // Fungsi untuk mengupdate presence
    const updatePresence = () => {
        client.user.setPresence({
            status: "idle",
            activities: [activities[currentIndex]]
        });
        
        // Pindah ke aktivitas berikutnya (atau kembali ke awal jika sudah di akhir)
        currentIndex = (currentIndex + 1) % activities.length;
    };

    // Panggil pertama kali
    updatePresence();
    
    // Set interval untuk rotasi setiap 15 detik (15000 milidetik)
    const rotationInterval = setInterval(updatePresence, 15000);
    
    // Simpan interval jika perlu dihentikan nanti
    client.presenceInterval = rotationInterval;
}

// ✅ Cek apakah mode 24/7 aktif
async function check247Status(guildId, client) {
    try {
        const guild = await client.db.get(`24_7_${guildId}`);
        return !!guild;
    } catch (error) {
        return false;
    }
}
