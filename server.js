var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

var players = {};
var games = [];
var gameCount = 0;
var playerLobby = []; //for players not in a game
 
app.use(express.static(__dirname + '/public'));
 
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
 
io.on('connection', function (socket) {
    //new player joins
    playerLobby.push(socket.id);
    console.log('a user connected');

    //create a game if two or more players are waiting
    while(playerLobby.length >= 2){
      games[gameCount] = {
        whiteId: playerLobby.pop(),
        blackId: playerLobby.pop(),
        state: 'white'
      }
      //assign colors and set initial game state
      io.to(games[gameCount].whiteId).emit('gameState', {color: games[gameCount].state})
      io.to(games[gameCount].blackId).emit('gameState', {color: games[gameCount].state})
      io.to(games[gameCount].whiteId).emit('setColor', {color: 'white'});
      io.to(games[gameCount].blackId).emit('setColor', {color: 'black'});
      gameCount++;
      console.log('Starting game ' + gameCount);
    }
    // handle new player joining
    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // handle player disconnecting
    socket.on('disconnect', function () {
        console.log('user disconnected');
        delete players[socket.id];
        // emit a message to all players to remove this player
        io.emit('disconnect', socket.id);
    });

    // handle a player's move and send it to their opponent (if valid)
    socket.on('makeMove', function (moveData) {
      var gameIndex = findGameIndex(moveData.player);
      if(validMove(moveData, gameIndex)){
        sendMove(moveData, gameIndex);
      }
    });

    // set the game over state when one player wins
    socket.on('winGame', function (winningColor) {
      var gameIndex = findGameIndex(winningColor.player);
      games[gameIndex].state = winningColor.color + 'win';
      io.to(games[gameIndex].whiteId).emit('gameOver', winningColor);
      io.to(games[gameIndex].blackId).emit('gameOver', winningColor);
    });
});

server.listen(8081, function () {
  console.log(`Listening on ${server.address().port}`);
});

// sends moveData recieved from one player to their opponent, and updates game state
function sendMove(moveData, gameIndex){
  if(moveData.color === 'white'){
    console.log('White moved');
    games[gameIndex].state = 'black';
    io.to(games[gameIndex].blackId).emit('moveMade', moveData);
  }else if (moveData.color === 'black'){
    console.log('Black moved');
    games[gameIndex].state = 'white';
    io.to(games[gameIndex].whiteId).emit('moveMade', moveData);
  }
  // emit a message to all players about the player that moved
  io.to(games[gameIndex].whiteId).emit('gameState', {color: games[gameIndex].state});
  io.to(games[gameIndex].blackId).emit('gameState', {color: games[gameIndex].state});
}

// checks if move is made on that player's turn
function validMove(moveData, gameIndex){
  return (games[gameIndex].state === moveData.color);
}

// searches current games for one containing the given player
function findGameIndex(playerId){
  for(let i = 0; i< gameCount; i++){
    if(games[i].whiteId == playerId || games[i].blackId == playerId){
      return i;
    }
  }
}