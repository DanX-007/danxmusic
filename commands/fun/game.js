const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const {
  Snake, TwoZeroFourEight, Connect4, FastType, FindEmoji, Flood,
  Hangman, MatchPairs, Minesweeper, TicTacToe, Wordle, RockPaperScissors, Trivia
} = require('discord-gamecord');

// Keep track of active collectors for each user
const activeCollectors = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('Play a game!'),

  run: async ({ interaction }) => {
    // Clean up existing collector for this user if it exists
    const existingCollector = activeCollectors.get(interaction.user.id);
    if (existingCollector) {
      existingCollector.stop();
      activeCollectors.delete(interaction.user.id);
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('game_select')
        .setPlaceholder('Select a game to play')
        .addOptions([
          { label: 'Snake', value: 'snake' },
          { label: '2048', value: '2048' },
          { label: 'Connect4', value: 'connect4' },
          { label: 'FastType', value: 'fasttype' },
          { label: 'Find Emoji', value: 'findemoji' },
          { label: 'Flood', value: 'flood' },
          { label: 'Hangman', value: 'hangman' },
          { label: 'Match Pairs', value: 'matchpairs' },
          { label: 'Minesweeper', value: 'minesweeper' },
          { label: 'TicTacToe', value: 'tictactoe' },
          { label: 'Wordle', value: 'wordle' },
          { label: 'Rock Paper Scissors', value: 'rps' },
          { label: 'Trivia', value: 'trivia' }
        ])
    );

    const response = await interaction.reply({
      content: 'Select a game to play:',
      components: [row],
      fetchReply: true // This ensures we get the message object back
    });

    const filter = i => i.customId === 'game_select' && i.user.id === interaction.user.id;
    const collector = response.createMessageComponentCollector({ filter, time: 60000 });
    
    // Store the collector reference
    activeCollectors.set(interaction.user.id, collector);

    collector.on('collect', async i => {
      const game = i.values[0];
      const games = {
        snake: Snake,
        '2048': TwoZeroFourEight,
        connect4: Connect4,
        fasttype: FastType,
        findemoji: FindEmoji,
        flood: Flood,
        hangman: Hangman,
        matchpairs: MatchPairs,
        minesweeper: Minesweeper,
        tictactoe: TicTacToe,
        wordle: Wordle,
        rps: RockPaperScissors,
        trivia: Trivia
      };

      const gameConfigs = {
        rps: {
          embed: {
            title: 'Rock Paper Scissors',
            color: '#5865F2',
            description: 'Press a button below to make a choice.'
          },
          buttons: {
            rock: 'Rock',
            paper: 'Paper',
            scissors: 'Scissors'
          },
          emojis: {
            rock: '🌑',
            paper: '📰',
            scissors: '✂️'
          },
          mentionUser: true,
          timeoutTime: 60000,
          buttonStyle: 'PRIMARY',
          pickMessage: 'You choose {emoji}.',
          winMessage: '**{player}** won the Game! Congratulations!',
          tieMessage: 'The Game tied! No one won the Game!',
          timeoutMessage: 'The Game went unfinished! No one won the Game!',
          playerOnlyMessage: 'Only {player} and {opponent} can use these buttons.'
        },
        trivia: {
          embed: {
            title: 'Trivia',
            color: '#5865F2',
            description: 'You have 60 seconds to guess the answer.'
          },
          timeoutTime: 60000,
          buttonStyle: 'PRIMARY',
          trueButtonStyle: 'SUCCESS',
          falseButtonStyle: 'DANGER',
          mode: 'multiple',
          difficulty: 'medium',
          winMessage: 'You won! The correct answer is {answer}.',
          loseMessage: 'You lost! The correct answer is {answer}.',
          errMessage: 'Unable to fetch question data! Please try again.',
          playerOnlyMessage: 'Only {player} can use these buttons.'
        }
      };

      // Stop the collector once a game is selected
      collector.stop();
      activeCollectors.delete(interaction.user.id);

      const GameClass = games[game];
      const config = { message: interaction, isSlashGame: true, ...gameConfigs[game] };

      if (["connect4", "tictactoe", "rps"].includes(game)) {
        config.opponent = i.user;
      }

      const selectedGame = new GameClass(config);
      selectedGame.startGame();
      selectedGame.on('gameOver', result => console.log(result));
      await i.deferUpdate();
    });

    collector.on('end', (collected, reason) => {
      // Remove the collector reference when it ends
      activeCollectors.delete(interaction.user.id);

    
      if (reason === 'time' && collected.size === 0) {
        interaction.editReply({
          content: 'You took too long to select a game!',
          components: [] 
        }).catch(console.error);
      }
    });
  }
};