var config = {
  type: Phaser.AUTO,
  parent: 'phaser-example',
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  } 
};
 
var game = new Phaser.Game(config);
var startBoard = [
  ['rookB','knightB','bishopB','queenB','kingB','bishopB','knightB','rookB'],
  ['pawnB','pawnB','pawnB','pawnB','pawnB','pawnB','pawnB','pawnB'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['pawnW','pawnW','pawnW','pawnW','pawnW','pawnW','pawnW','pawnW'],
  ['rookW','knightW','bishopW','queenW','kingW','bishopW','knightW','rookW']
];
var pieceTypes = {
  'pawn' : {hp : 50, strength: 50},
  'rook' : {hp : 100, strength: 50},
  'bishop' : {hp : 50, strength: 100},
  'knight' : {hp : 50, strength: 100},
  'queen' : {hp : 150, strength: 150},
  'king' : {hp : 150, strength: 150},
}
var board;
var emptyPiece = {
  hp: 0,
  maxHp : 0,
  strength: 0,
  pieceType: '',
  pieceImg: '',
  team: '',
  
  hasMoved: false,
  selected: false
}
var pieces = [];
var moveMarkers = [];
var currentSelection = { x:-1, y:-1 };
var gameState = '';
var possibleMoves = [];
var hasMoved = false;
var pieceSelected = false;

var uiText;
var teamStr = '';
 
function preload() {
    this.load.image('pawnB', 'assets/pawnB.png');
    this.load.image('rookB', 'assets/rookB.png');
    this.load.image('knightB', 'assets/knightB.png');
    this.load.image('bishopB', 'assets/bishopB.png');
    this.load.image('queenB', 'assets/queenB.png');
    this.load.image('kingB', 'assets/kingB.png');
    this.load.image('pawnW', 'assets/pawnW.png');
    this.load.image('rookW', 'assets/rookW.png');
    this.load.image('knightW', 'assets/knightW.png');
    this.load.image('bishopW', 'assets/bishopW.png');
    this.load.image('queenW', 'assets/queenW.png');
    this.load.image('kingW', 'assets/kingW.png');
    
    this.load.image('select', 'assets/select.png');
    this.load.image('move', 'assets/move.png');
    this.load.image('winB', 'assets/winB.png');
    this.load.image('winW', 'assets/winW.png');
    this.load.image('board', 'assets/board.png');
    this.load.image('stats', 'assets/stats.png');
    this.load.image('health', 'assets/health.png');
}
 
function create() {
    var self = this;
    self.team = '';

    //board setup
    this.cameras.main.backgroundColor.setTo(255,255,255); 
    this.add.image(300, 300, 'board').setDisplaySize(600,600);
    this.add.image(700, 530, 'stats').setDisplaySize(200,130);
    createBoard(self);

    //debug text
    uiText = this.add.text(615, 10, '', { fill: '#000000' });

    //mouse setup
    this.input.on('pointerdown', function (pointer) {
      let Xindex = Math.trunc(pointer.x/75);
      let Yindex = Math.trunc(pointer.y/75);
      clearMarkers();
      if(Xindex < 8 && Yindex < 8 && gameState === self.team && !hasMoved){
        let chosenSpace = board[Yindex][Xindex];
        if(chosenSpace.pieceType != '' && chosenSpace.team === self.team){ //selected own piece
          if(pieceSelected){
            board[currentSelection.y][currentSelection.x].selected = false;
          }
          board[Yindex][Xindex].selected = true;
          currentSelection.x = Xindex;
          currentSelection.y = Yindex;
          pieceSelected = true;
          GetPossibleMoves(self, currentSelection);
          return;
        }else if (pieceSelected){ //select move
          while(possibleMoves.length != 0){
            var mv = possibleMoves.pop();
            if(mv.x === Xindex && mv.y === Yindex){
              movePiece(self, currentSelection, mv, true);
              return;
            }
          }
        }
      }
      if(pieceSelected){
        board[currentSelection.y][currentSelection.x].selected = false;
      }
      

    }, this);

    //network setup
    this.socket = io();
    this.socket.on('currentPlayers', function (players) {
        Object.keys(players).forEach(function (id) {
          if (players[id].playerId === self.socket.id) {
            addPlayer(self, players[id]);
          }
        });
      });
    this.socket.on('moveMade', function (moveData) {
      if(moveData.player != self.socket.id){
        movePiece(self, moveData.from, moveData.to, false);
      }
    });
    this.socket.on('gameState', function (turnData) {
      gameState = turnData.team;
      if(turnData.team === self.team){
        hasMoved = false;
      }
    });
    this.socket.on('setColor', function (colorData) {
      self.team = colorData.team;
    });
    this.socket.on('gameOver', function (winningTeam) {
      gameState = winningTeam.team + 'win';
    });

  }
 
function update() {
  var self = this;

  //draw board
  clearBoard(self);
  drawBoard(self);

  var pointer = this.input.activePointer;
  var selected = {
    x : Math.trunc(pointer.x/75),
    y : Math.trunc(pointer.y/75)
  }
  if(self.team != ''){
    uiText.setText([
        'Your Color: ' + self.team,
        (!gameState.endsWith('win')) ? 'It is ' + gameState + '\'s turn' : 'Game Over'
    ]);
  }else{
    uiText.setText([
      'Waiting for Game...'
  ]);
  }
}

function addPlayer(self, playerInfo) {
  self.team = playerInfo.team;
  self.playerId = playerInfo.playerId;
}

function createBoard (self){
  board = [
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,],
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,],
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,],
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,],
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,],
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,],
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,],
    [emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,emptyPiece,]
  ];
  for(var y = 0; y < 8; y++){
    for(var x = 0; x < 8; x++){
      var pieceType = startBoard[y][x];
      if(pieceType != ''){
        var pieceTypeTrim = pieceType.substring(0, pieceType.length-1);
        board[y][x] = {
            hp: pieceTypes[pieceTypeTrim].hp,
            maxHp : pieceTypes[pieceTypeTrim].hp,
            strength: pieceTypes[pieceTypeTrim].strength,
            pieceType: pieceTypeTrim,
            pieceImg: pieceType,
            team: pieceType.endsWith('W') ? 'white' : 'black',
            
            hasMoved: false,
            selected: false
        };
      }
    }
  }
}

function clearBoard (self){
  while(pieces.length != 0){
    var clr = pieces.pop();
    clr.destroy();
  }
}

function clearMarkers (self){
  while(moveMarkers.length != 0){
    var clr = moveMarkers.pop();
    clr.destroy();
  }
}

function drawBoard (self){
  for(var y = 0; y < 8; y++){
    for(var x = 0; x < 8; x++){
      if(board[y][x].pieceType != ''){
        let actualPos = (self.team == 'white')? {x: x, y:y} : {x: 7-x, y:7-y};
        if(board[y][x].selected){
          pieces.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, 'select').setDisplaySize(75,75));
        }
        pieces.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, board[y][x].pieceImg).setDisplaySize(70,70));
        pieces.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, 'health').setDisplaySize(70 * (board[y][x].hp / board[y][x].maxHp),70));
      }
    }
  }
  if(gameState == 'whitewin'){
    self.add.image(300, 300, 'winW').setDisplaySize(400,200);
  }
  if(gameState == 'blackwin'){
    self.add.image(300, 300, 'winB').setDisplaySize(400,200);
  }
}

function movePiece(self, from, to, broadcast){
  board[from.y][from.x].selected = false;
  board[from.y][from.x].hasMoved = true;
  var winningMove = false;
  var doesMove = false;
  board[to.y][to.x].hp -= board[from.y][from.x].strength;
  if (board[to.y][to.x].hp <= 0){
    doesMove = true;
  }
  if(doesMove && board[to.y][to.x].pieceType == 'king'){
    winningMove = true;
  }

  if(doesMove){
    board[to.y][to.x] = board[from.y][from.x];
    board[from.y][from.x] = emptyPiece;
  }
  pieceSelected = false;

  if(broadcast){
    hasMoved = true;
    self.socket.emit('makeMove', { team: self.team, from: from, to: to, player: self.socket.id });
    if(winningMove){
      self.socket.emit('winGame', { team: self.team, player: self.socket.id });
    }
  }
}

function GetPossibleMoves (self, pos){
  var piece = board[pos.y][pos.x];
  var forward = (piece.team === 'white') ? -1 : 1;
  possibleMoves = [];
  var movesToCheck = [];
  
  if (piece.pieceType != ''){
    let mv = {x: 0, y:0};
    let xDir = 0;
    let yDir = 0;
    switch(piece.pieceType){
      case 'pawn':
        var pawnMove = {x: pos.x, y: pos.y + forward};
        if(PosOnBoard(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType === ''){
          movesToCheck.push(pawnMove);
        }
        pawnMove = {x: pos.x + 1, y: pos.y + forward}
        if(PosOnBoard(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType != ''){
          movesToCheck.push(pawnMove);
        }
        pawnMove = {x: pos.x - 1, y: pos.y + forward}
        if(PosOnBoard(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType != ''){
          movesToCheck.push(pawnMove);
        }
        pawnMove = {x: pos.x, y: pos.y + forward*2}
        if(PosOnBoard(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType == '' && !(board[pos.y][pos.x].hasMoved)){
          movesToCheck.push(pawnMove);
        }
        
        break;
      case 'bishop':
        for(let i = 0; i< 4; i++){
          xDir = (i == 1 || i == 3)? 1: -1;
          yDir = (i == 1 || i == 2)? 1: -1;
          for(let j = 1; j < 8; j++){
            mv = {x: pos.x + (j*xDir), y: pos.y + (j*yDir)};
            if(PosOnBoard(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){
                j = 8;
              }
            }
          }
        }
        break;
      case 'knight':
        movesToCheck.push({x: pos.x + 2, y: pos.y + 1});
        movesToCheck.push({x: pos.x - 2, y: pos.y + 1});
        movesToCheck.push({x: pos.x + 2, y: pos.y - 1});
        movesToCheck.push({x: pos.x - 2, y: pos.y - 1});
        movesToCheck.push({x: pos.x + 1, y: pos.y + 2});
        movesToCheck.push({x: pos.x - 1, y: pos.y + 2});
        movesToCheck.push({x: pos.x + 1, y: pos.y - 2});
        movesToCheck.push({x: pos.x - 1, y: pos.y - 2});
        break;
      case 'rook':
        
        for(let i = 0; i< 4; i++){
          xDir = 0;
          yDir = 0;
          if(i == 0){xDir = 1;}
          if(i == 1){xDir = -1;}
          if(i == 2){yDir = 1;}
          if(i == 3){yDir = -1;}
          for(let j = 1; j < 8; j++){
            mv = {x: pos.x + (j*xDir), y: pos.y + (j*yDir)};
            if(PosOnBoard(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){
                j = 8;
              }
            }
          }
        }
        break;
      case 'queen':
        for(let i = 0; i< 4; i++){
          xDir = (i == 1 || i == 3)? 1: -1;
          yDir = (i == 1 || i == 2)? 1: -1;
          for(let j = 1; j < 8; j++){
            mv = {x: pos.x + (j*xDir), y: pos.y + (j*yDir)};
            if(PosOnBoard(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){
                j = 8;
              }
            }
          }
          xDir = 0;
          yDir = 0;
          if(i == 0){xDir = 1;}
          if(i == 1){xDir = -1;}
          if(i == 2){yDir = 1;}
          if(i == 3){yDir = -1;}
          for(let j = 1; j < 8; j++){
            mv = {x: pos.x + (j*xDir), y: pos.y + (j*yDir)};
            if(PosOnBoard(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){
                j = 8;
              }
            }
          }
        }
        break;
      case 'king':
        for(let x = -1; x < 2; x++){
          for(let y = -1; y < 2; y++){
            movesToCheck.push({x: pos.x + x, y: pos.y  + y});
          }
        }
        break;
    }
  }

  while(movesToCheck.length != 0){
    let mv = movesToCheck.pop();
    if(PosOnBoard(mv) && board[mv.y][mv.x].team != self.team){
      possibleMoves.push(mv);
      let actualPos = (self.team == 'white')? {x: mv.x, y:mv.y} : {x: 7-mv.x, y:7-mv.y};
      moveMarkers.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, 'move').setDisplaySize(75,75));
    }
  }
}

function PosOnBoard(pos){
  if(pos.y >= 0 && pos.y <= 7 && pos.x >= 0 && pos.x <= 7 ){
    return true;
  }else{
    return false;
  }
}