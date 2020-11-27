var config = {
  type: Phaser.AUTO,
  parent: 'chess-game',
  width: 800,
  height: 600,
  scene: {
    preload: preload,
    create: create,
    update: update
  } 
};
 
var game = new Phaser.Game(config);

// starting board setup (W and B indicate color)
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
var board;

// default values for a space on the board
var emptyPiece = {
  hp: 0,
  maxHp : 0,
  strength: 0,
  pieceType: '',
  pieceImg: '',
  color: '',
  hasMoved: false,
  selected: false
}

// piece stats (used when creating pieces)
var pieceTypes = {
  'pawn' : {hp : 50, strength: 50},
  'rook' : {hp : 100, strength: 50},
  'bishop' : {hp : 50, strength: 100},
  'knight' : {hp : 50, strength: 100},
  'queen' : {hp : 150, strength: 150},
  'king' : {hp : 150, strength: 150},
}

var gameState = ''; //either empty, white, black, whitewin, or blackwin
var currentSelection = { x:-1, y:-1 }; //position of the currently selected piece
var pieceSelected = false; //if a piece is currently selected
var possibleMoves = []; //list of possible moves for the selected piece
var hasMoved = false; //set upon making a move. Ensures the player can't make more than one if the server responds slowly

// used for rendering the board and valid movement indicators
var pieceImages = [];
var moveImages = [];
var uiText;

//load images for the game
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
    self.color = ''; //set color as empty until the server assigns one

    //board setup
    this.cameras.main.backgroundColor.setTo(255,255,255); 
    this.add.image(300, 300, 'board').setDisplaySize(600,600);
    this.add.image(700, 530, 'stats').setDisplaySize(200,130);
    setupBoard(self);
    uiText = this.add.text(615, 10, '', { fill: '#000000' });

    //mouse setup
    this.input.on('pointerdown', function (pointer) {
      handleInput(self, pointer);
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
    // handle recieving moves from the server
    this.socket.on('moveMade', function (moveData) {
      if(moveData.player != self.socket.id){ //make sure the move did not originate from this player
        movePiece(self, moveData.from, moveData.to, false); //do not broadcast this move back to the server
      }
    });
    // update the gamestate based on what the server sends
    this.socket.on('gameState', function (turnData) {
      gameState = turnData.color;
      if(turnData.color === self.color){
        hasMoved = false; //it is now this player's turn, so allow them to move again
      }
    });
    // allow the server to assign player's color
    this.socket.on('setColor', function (colorData) {
      self.color = colorData.color;
    });
    // set the gamestate now that the game is over.
    this.socket.on('gameOver', function (winningColor) {
      gameState = winningColor.color + 'win';
    });

  }
 
function update() {
  var self = this;

  //handle rendering of the board
  drawBoard(self);

  if(self.color != ''){
    uiText.setText([
        'Your Color: ' + self.color,
        (!gameState.endsWith('win')) ? 'It is ' + gameState + '\'s turn' : 'Game Over' //show current turn, or game over text
    ]);
  }else{
    uiText.setText([
      'Waiting for Game...'
  ]);
  }
}

//creates player
function addPlayer(self, playerInfo) {
  self.color = playerInfo.color;
  self.playerId = playerInfo.playerId;
}

//handles input from the mouse to select or move a piece
function handleInput(self, pointer){
  //calculate board coordinates
  let Xindex = Math.trunc(pointer.x/75);
  let Yindex = Math.trunc(pointer.y/75);

  //rotates coordinates by 180 degrees for the black player
  if(self.color == 'black'){
    Xindex = 7 - Xindex;
    Yindex = 7 - Yindex;
  }
  clearMarkers(); //clear any valid move markers

  if(ValidPosition({x: Xindex, y: Yindex}) && gameState === self.color && !hasMoved){ //only allow input if it's the player's turn
    let chosenSpace = board[Yindex][Xindex];

    if(chosenSpace.pieceType != '' && chosenSpace.color === self.color){ //selected own piece
      if(pieceSelected){
        board[currentSelection.y][currentSelection.x].selected = false; //unselect previous piece, if any
      }
      //sets new selection and gets potential moves
      board[Yindex][Xindex].selected = true;
      currentSelection.x = Xindex;
      currentSelection.y = Yindex;
      pieceSelected = true;
      GetPossibleMoves(self, currentSelection);
      return;
    }else if (pieceSelected){
      //selected a move, so check to see if it is a valid move:
      while(possibleMoves.length != 0){
        var mv = possibleMoves.pop();
        if(mv.x === Xindex && mv.y === Yindex){ //move is in possibleMoves, so allow it
          movePiece(self, currentSelection, mv, true);
          return;
        }
      }
    }
  }
  if(pieceSelected){ //clicked outside of pieces or valid moves, so unselect current piece
    board[currentSelection.y][currentSelection.x].selected = false;
  }
}

//initialize board based on startBoard
function setupBoard (self){
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
        placePiece({x: x, y: y}, pieceType);
      }
    }
  }
}

//deletes any potential move markers on board
function clearMarkers (self){
  while(moveImages.length != 0){
    var clr = moveImages.pop();
    clr.destroy();
  }
}

//creates images for each piece, as well as win messages when needed
function drawBoard (self){
  //first, clears all current piece images
  while(pieceImages.length != 0){
    var clr = pieceImages.pop();
    clr.destroy();
  }

  //loop through board
  for(var y = 0; y < 8; y++){
    for(var x = 0; x < 8; x++){
      if(board[y][x].pieceType != ''){
        //rotate image position by 180 degrees for the black player (shows black pieces on the bottom)
        let actualPos = (self.color == 'white')? {x: x, y:y} : {x: 7-x, y:7-y};

        if(board[y][x].selected){ //show outline around selected piece
          pieceImages.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, 'select').setDisplaySize(75,75));
        }
        //create piece image, as well as health bar based on current piece health
        pieceImages.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, board[y][x].pieceImg).setDisplaySize(70,70));
        pieceImages.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, 'health').setDisplaySize(70 * (board[y][x].hp / board[y][x].maxHp),70));
      }
    }
  }
  //show win messages depending on game state
  if(gameState == 'whitewin'){
    pieceImages.push(self.add.image(300, 300, 'winW').setDisplaySize(400,200));
  }
  if(gameState == 'blackwin'){
    pieceImages.push(self.add.image(300, 300, 'winB').setDisplaySize(400,200));
  }
}
//places piece of given piecetype at given position
function placePiece(pos, pieceType){
  var pieceTypeTrim = pieceType.substring(0, pieceType.length-1);
  board[pos.y][pos.x] = {
    hp: pieceTypes[pieceTypeTrim].hp,
    maxHp : pieceTypes[pieceTypeTrim].hp,
    strength: pieceTypes[pieceTypeTrim].strength,
    pieceType: pieceTypeTrim,
    pieceImg: pieceType,
    color: pieceType.endsWith('W') ? 'white' : 'black',
    
    hasMoved: false,
    selected: false
  };
}

//moves piece in 'from' position to the 'to' position, and can broadcast this to the server
function movePiece(self, from, to, broadcast){
  //unselects piece and sets hasMoved flag
  pieceSelected = false;
  board[from.y][from.x].selected = false;
  board[from.y][from.x].hasMoved = true;

  var winningMove = false; //flag for if this move will destroy the king
  var doesMove = false; //flag for if the piece beats the target and will move

  //subtract attacking piece's strength from target's health
  board[to.y][to.x].hp -= board[from.y][from.x].strength;
  if (board[to.y][to.x].hp <= 0){
    doesMove = true; //target destroyed, so piece will move
  }
  if(doesMove && board[to.y][to.x].pieceType == 'king'){
    winningMove = true; //king destroyed, so this is the winning move
  }

  //handles the actual movement
  if(doesMove){
    board[to.y][to.x] = board[from.y][from.x];
    board[from.y][from.x] = emptyPiece;
  }

  //broadcasts move to the server, as well as victory if this was the winning move
  if(broadcast){
    hasMoved = true;
    self.socket.emit('makeMove', { color: self.color, from: from, to: to, player: self.socket.id });
    if(winningMove){
      self.socket.emit('winGame', { color: self.color, player: self.socket.id });
    }
  }
}

//populates possibleMoves with valid moves for a piece
function GetPossibleMoves (self, pos){
  var piece = board[pos.y][pos.x];
  var forward = (piece.color === 'white') ? -1 : 1; //forward direction changes depending on the player
  possibleMoves = []; //reset possible moves
  var movesToCheck = [];
  
  if (piece.pieceType != ''){
    let mv = {x: 0, y:0};
    let xDir = 0;
    let yDir = 0;

    switch(piece.pieceType){ //determine moves based on piece type (this switch statement is a bit long, but functional)
      case 'pawn':
        var pawnMove = {x: pos.x, y: pos.y + forward};
        //pawn can move forward if the space is empty
        if(ValidPosition(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType === ''){
          movesToCheck.push(pawnMove);
        }
        //pawn can attack forward diagonally if space is not empty
        pawnMove = {x: pos.x + 1, y: pos.y + forward}
        if(ValidPosition(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType != ''){
          movesToCheck.push(pawnMove);
        }
        pawnMove = {x: pos.x - 1, y: pos.y + forward}
        if(ValidPosition(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType != ''){
          movesToCheck.push(pawnMove);
        }
        //pawn can move forward twice if not moved yet
        pawnMove = {x: pos.x, y: pos.y + forward*2}
        if(ValidPosition(pawnMove) && board[pawnMove.y][pawnMove.x].pieceType == '' && !(board[pos.y][pos.x].hasMoved)){
          movesToCheck.push(pawnMove);
        }
        
        break;
      case 'bishop':
        //bishops can move diagonally, but cannot pass through pieces
        for(let i = 0; i< 4; i++){ //adjust x and y modifiers over 4 iterations to cover all movement directions
          xDir = (i == 1 || i == 3)? 1: -1;
          yDir = (i == 1 || i == 2)? 1: -1;
          for(let j = 1; j < 8; j++){
            mv = {x: pos.x + (j*xDir), y: pos.y + (j*yDir)};
            if(ValidPosition(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){ //a piece occupies this space, so stop checking in this direction
                j = 8;
              }
            }
          }
        }
        break;
      case 'knight':
        //knights only have 8 possible L-shaped  moves:
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
        //rooks can move horizontally, but cannot pass through pieces
        for(let i = 0; i< 4; i++){ //adjust x and y modifiers over 4 iterations to cover all movement directions
          xDir = 0;
          yDir = 0;
          if(i == 0){xDir = 1;}
          if(i == 1){xDir = -1;}
          if(i == 2){yDir = 1;}
          if(i == 3){yDir = -1;}
          for(let j = 1; j < 8; j++){
            mv = {x: pos.x + (j*xDir), y: pos.y + (j*yDir)};
            if(ValidPosition(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){ //a piece occupies this space, so stop checking in this direction
                j = 8;
              }
            }
          }
        }
        break;
      case 'queen':
        //the queen can move horizontally and vertically, but cannot pass through pieces
        for(let i = 0; i< 4; i++){ //adjust x and y modifiers over 4 iterations to cover all movement directions
          xDir = (i == 1 || i == 3)? 1: -1;
          yDir = (i == 1 || i == 2)? 1: -1;
          for(let j = 1; j < 8; j++){
            mv = {x: pos.x + (j*xDir), y: pos.y + (j*yDir)};
            if(ValidPosition(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){ //a piece occupies this space, so stop checking in this direction
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
            if(ValidPosition(mv)){
              movesToCheck.push(mv);
              if(board[mv.y][mv.x].pieceType != ''){ //a piece occupies this space, so stop checking in this direction
                j = 8;
              }
            }
          }
        }
        break;
      case 'king':
        //the king can move horizontally and vertically, but only 1 space at a time
        for(let x = -1; x < 2; x++){ //add spaces surrounding king
          for(let y = -1; y < 2; y++){
            movesToCheck.push({x: pos.x + x, y: pos.y  + y});
          }
        }
        break;
    }
  }

  //only add potential moves which are within the board, and not to a space occupied by a piece of the same color
  while(movesToCheck.length != 0){
    let mv = movesToCheck.pop();
    if(ValidPosition(mv) && board[mv.y][mv.x].color != self.color){
      possibleMoves.push(mv);
      let actualPos = (self.color == 'white')? {x: mv.x, y:mv.y} : {x: 7-mv.x, y:7-mv.y}; //rotate image position 180 degrees for the black player
      moveImages.push(self.add.image(actualPos.x * 75 + 38, actualPos.y * 75 + 38, 'move').setDisplaySize(75,75)); //create potential move image
    }
  }
}
// returns true if position is within board
function ValidPosition(pos){
  if(pos.y >= 0 && pos.y <= 7 && pos.x >= 0 && pos.x <= 7 ){
    return true;
  }else{
    return false;
  }
}