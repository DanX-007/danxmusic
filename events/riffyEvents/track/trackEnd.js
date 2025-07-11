const { logger } = require("../../../utils/logger");

module.exports = async (client) => {
    client.riffy.on("trackEnd", async (player, track) => {
        if (!player) return;
        
        try {
            // Simpan track yang baru saja selesai ke previousTracks
            if (track && track.info) {
                // Inisialisasi previousTracks jika belum ada
                if (!player.queue.previousTracks) {
                    player.queue.previousTracks = [];
                }
                
                // Cek duplikat sebelum menambahkan
                const isDuplicate = player.queue.previousTracks.some(
                    t => t.info && t.info.uri === track.info.uri
                );
                
                if (!isDuplicate) {
                    player.queue.previousTracks.push(track);
                    
                    // Batasi ukuran previousTracks maksimal 100 lagu
                    if (player.queue.previousTracks.length > 100) {
                        player.queue.previousTracks.shift(); // Hapus yang paling lama
                    }
                }
            }
            
            // Jangan hapus previousTracks saat queue kosong
            // Biarkan tersimpan untuk autoplay
            // Saat lagu selesai
if (!player.history) player.history = [];
player.history.push(player.current);


            if (player.message) {
                await player.message.delete().catch(() => {});
            }
            
        } catch (error) {
            logger.error(`Error in trackEnd event: ${error.message}`);
        }
    });
};