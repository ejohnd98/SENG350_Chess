var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

var players = {};
var whiteNext = true;
var whitePlayer, blackPlayer;
var gameState = 'white';
var games = [];
var gameCount = 0;
var playerLobby = [];
 
app.use(express.static(__dirname + '/public'));
 
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
 
io.on('connection', function (socket) {
    //console.log('a user connected');
    // create a new player and add it to our players object
    playerLobby.push(socket.id);
    console.log('a user connected');

    while(playerLobby.length >= 2){
      games[gameCount] = {
        whiteId: playerLobby.pop(),
        blackId: playerLobby.pop(),
        state: 'white'
      }
      io.to(games[gameCount].whiteId).emit('gameState', {team: games[gameCount].state})
      io.to(games[gameCount].blackId).emit('gameState', {team: games[gameCount].state})
      io.to(games[gameCount].whiteId).emit('setColor', {team: 'white'});
      io.to(games[gameCount].blackId).emit('setColor', {team: 'black'});
      gameCount++;
      console.log('Starting game ' + gameCount);
    }
    // send the players object to the new player
    socket.emit('currentPlayers', players);
    // update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('disconnect', function () {
        console.log('user disconnected');
        delete players[socket.id];
        // emit a message to all players to remove this player
        io.emit('disconnect', socket.id);
    });

    // when a player moves, update the player data
    socket.on('makeMove', function (moveData) {
        var gameIndex = findGameIndex(moveData.player);
        if(moveData.team === 'white'){
          console.log('White moved');
          games[gameIndex].state = 'black';
          io.to(games[gameIndex].blackId).emit('moveMade', moveData);
        }else if (moveData.team === 'black'){
          console.log('Black moved');
          games[gameIndex].state = 'white';
          io.to(games[gameIndex].whiteId).emit('moveMade', moveData);
        }
        // emit a message to all players about the player that moved
        io.to(games[gameIndex].whiteId).emit('gameState', {team: games[gameIndex].state});
        io.to(games[gameIndex].blackId).emit('gameState', {team: games[gameIndex].state});
    });

    socket.on('winGame', function (winningTeam) {
      var gameIndex = findGameIndex(winningTeam.player);
      games[gameIndex].state = winningTeam.team + 'win';
      io.to(games[gameIndex].whiteId).emit('gameOver', winningTeam);
      io.to(games[gameIndex].blackId).emit('gameOver', winningTeam);
    });
});
server.listen(8081, function () {
  console.log(`Listening on ${server.address().port}`);
});

function findGameIndex(playerId){
  for(let i = 0; i< gameCount; i++){
    if(games[i].whiteId == playerId || games[i].blackId == playerId){
      return i;
    }
  }
}