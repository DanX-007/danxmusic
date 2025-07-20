const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snake')
        .setDescription('Play Snake game directly in Discord'),

    cooldown: 300,   

    run: async ({ interaction, client }) => {
        await interaction.reply("**Starting Snake Game**");
        
        // Game setup
        const boardSize = 10;
        let snake = [{x: 5, y: 5}];
        let food = generateFood(snake, boardSize);
        let direction = 'right';
        let nextDirection = 'right';
        let directionBuffer = [];
        let score = 0;
        let gameOver = false;
        let gameInterval;
        let moveSpeed = 900; // Kecepatan awal (ms)
        let speedIncrease = 2; // Peningkatan kecepatan per makanan
        let lastMoveTime = Date.now();

        // Create control buttons
        const controls = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('up').setEmoji('⬆️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('down').setEmoji('⬇️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('left').setEmoji('⬅️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('right').setEmoji('➡️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('end').setLabel('END').setStyle(ButtonStyle.Danger)
            );

        // Initial game embed
        const gameEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🐍 Snake Game')
            .setDescription(renderBoard(snake, food, boardSize))
            .addFields(
                { name: 'Score', value: `${score}`, inline: true },
                { name: 'Speed', value: `${Math.round(1000/moveSpeed)} moves/sec`, inline: true }
            );

        const gameMessage = await interaction.editReply({
            embeds: [gameEmbed],
            components: [controls]
        });

        // Game loop
        const moveSnakeInterval = async () => {
            if (gameOver) return;
            
            const now = Date.now();
            if (now - lastMoveTime < moveSpeed) return;
            lastMoveTime = now;
            
            // Process buffered inputs
            if (directionBuffer.length > 0) {
                const newDirection = directionBuffer.shift();
                const oppositeDirections = {
                    up: 'down',
                    down: 'up',
                    left: 'right',
                    right: 'left'
                };
                
                if (newDirection !== oppositeDirections[direction]) {
                    direction = newDirection;
                }
            }
            
            // Move snake
            const head = moveSnake(snake, direction);
            
            // Check collisions
            if (checkCollision(head, snake, boardSize)) {
                gameOver = true;
                clearInterval(gameInterval);
                await endGame();
                return;
            }

            // Update game state
            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score++;
                // Increase speed slightly with each food
                moveSpeed = Math.max(200, moveSpeed - speedIncrease);
                food = generateFood(snake, boardSize);
            } else {
                snake.pop();
            }

            // Update display (only if something changed)
            try {
                gameEmbed
                    .setDescription(renderBoard(snake, food, boardSize))
                    .setFields(
                        { name: 'Score', value: `${score}`, inline: true },
                        { name: 'Speed', value: `${Math.round(1000/moveSpeed)} moves/sec`, inline: true }
                    );

                await gameMessage.edit({
                    embeds: [gameEmbed],
                    components: [controls]
                });
            } catch (error) {
                console.error('Error updating game:', error);
            }
        };

        // Start the game loop (runs frequently but movement is controlled by moveSpeed)
        gameInterval = setInterval(moveSnakeInterval, 100);

        // Game collector for button interactions
        const collector = gameMessage.createMessageComponentCollector({ time: 600000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'This is not your game!', ephemeral: true });
                return;
            }

            await i.deferUpdate();

            if (i.customId === 'end') {
                gameOver = true;
                clearInterval(gameInterval);
                await endGame();
                return;
            }

            // Add direction to buffer (max 2 buffered inputs)
            if (directionBuffer.length < 2) {
                directionBuffer.push(i.customId);
            }
        });

        collector.on('end', async () => {
            if (!gameOver) {
                gameOver = true;
                clearInterval(gameInterval);
                await endGame();
            }
        });

        // Function to handle game over/end
        const endGame = async () => {
            try {
                gameEmbed
                    .setTitle(gameOver ? '🏁 Game Over' : '⏹️ Game Ended')
                    .setDescription(`Final Score: ${score}\n\n${renderBoard(snake, food, boardSize)}`)
                    .setColor(gameOver ? '#ff0000' : '#ffff00')
                    .setFields();

                await gameMessage.edit({
                    embeds: [gameEmbed],
                    components: []
                });
            } catch (error) {
                console.error('Error ending game:', error);
            }
        };
    }
};

// Helper functions (unchanged)
function generateFood(snake, boardSize) {
    let food;
    do {
        food = {
            x: Math.floor(Math.random() * boardSize),
            y: Math.floor(Math.random() * boardSize)
        };
    } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
    return food;
}

function moveSnake(snake, direction) {
    const head = {...snake[0]};
    switch (direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }
    return head;
}

function checkCollision(head, snake, boardSize) {
    return head.x < 0 || head.x >= boardSize || 
           head.y < 0 || head.y >= boardSize || 
           snake.some(segment => segment.x === head.x && segment.y === head.y);
}

function renderBoard(snake, food, size) {
    let board = '';
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (snake.some(segment => segment.x === x && segment.y === y)) {
                board += snake[0].x === x && snake[0].y === y ? '🟢' : '🟩';
            } else if (food.x === x && food.y === y) {
                board += '🍎';
            } else {
                board += '⬛';
            }
        }
        board += '\n';
    }
    return board;
}