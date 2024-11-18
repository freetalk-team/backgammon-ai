import './utils.js';

import Game from './game.js';

var canvas, ctx;
var mousePos;
var rollButton = {onScreen: false};
var takeButton = {onScreen: false};
var passButton = {onScreen: false};
var startButton = {onScreen: false}

const Cube = {
	position: "center", // center, black, white, left, right, off
	value: 1,
	onScreen: false
  }

const Dices = {
	position: "",   //left, right
	diceValueLeft: 5,
	diceValueRight: 5,
	onScreen: false
  };

const Board = {
	// width: window.innerWidth*3/4 < window.innerHeight ? window.innerWidth - 20 : window.innerHeight*4/3*0.9,
	reset: function(color='black'){
  
	  // const [BLACK, WHITE] = owner == 'black' ? [0,1] : [1,0];
	  const [BLACK, WHITE] = [0,1];
  
	  this.p24 = [2, BLACK];  // 0 means that black is the owner
	  this.p23 = [0, -1]; // -1 means that the point is empty
	  this.p22 = [0, -1];
	  this.p21 = [0, -1];
	  this.p20 = [0, -1];
	  this.p19 = [5, WHITE];  // 1 means that white is the owner
	  this.p18 = [0, -1];
	  this.p17 = [3, WHITE];
	  this.p16 = [0, -1];
	  this.p15 = [0, -1];
	  this.p14 = [0, -1];
	  this.p13 = [5, BLACK];
	  this.p12 = [5, WHITE];
	  this.p11 = [0, -1];
	  this.p10 = [0, -1];
	  this.p9 = [0, -1];
	  this.p8 = [3, BLACK];
	  this.p7 = [0, -1];
	  this.p6 = [5, BLACK];
	  this.p5 = [0, -1];
	  this.p4 = [0, -1];
	  this.p3 = [0, -1];
	  this.p2 = [0, -1];
	  this.p1 = [2, WHITE];
	  this.offWhite = [0, WHITE];
	  this.offBlack = [0, BLACK];
	  this.barWhite = [0, WHITE];
	  this.barBlack = [0, BLACK];
	  this.status = "start";  // start, roll, move, accept
	  // this.onMove = "owner";
	  this.onMove = color;
	  this.moves = [];
	  this.playedMoves = [];
	  Cube.position = "center";
	  Cube.value = 1;
	  rollButton.onScreen = false;
	  Dices.onScreen = false;
	  takeButton.onScreen = false;
	  passButton.onScreen = false;
	},
	save: function() {
	  for (var i = 1; i <= 24; i++) this["b" + i] = this["p" + i].slice();
	  this.bOffWhite = this.offWhite.slice();
	  this.bOffBlack = this.offBlack.slice();
	  this.bBarWhite = this.barWhite.slice();
	  this.bBarBlack = this.barBlack.slice();
	  this.bMoves = this.moves.slice();
	},
	undo: function() {
	  for (var i = 1; i <= 24; i++) this["p" + i] = this["b" + i].slice();
	  this.offWhite = this.bOffWhite.slice();
	  this.offBlack = this.bOffBlack.slice();
	  this.barWhite = this.bBarWhite.slice();
	  this.barBlack = this.bBarBlack.slice();
	  this.moves = this.bMoves.slice();
	  this.playedMoves = [];    
	},
	mouseOverPoint: undefined
};

const ValidMoves = function() {
	this.numOfValidMoves = function(){
	  var result = 0;
	  for (var i in this) if (typeof this[i] === "object") result += this[i].length;
	  return result;
	}
	setValidMoves(this);
	
	function setValidMoves(vm) {
	  // if the player on move has men on the bar
	  if (Board["bar"+Board.onMove.capitalizeFirstLetter()][0] > 0) {
		vm["bar"+Board.onMove.capitalizeFirstLetter()] = [];
		for (var i=0; i<Board.moves.length; i++) {
		  if (isValid("bar" + Board.onMove.capitalizeFirstLetter(), Board.moves[i]) && vm["bar" + Board.onMove.capitalizeFirstLetter()].indexOf(Board.moves[i]) == -1) vm["bar" + Board.onMove.capitalizeFirstLetter()].push(Board.moves[i]);
		}
	  }
	  else {   // if the player on move has not any men on the bar
		for (var i=1; i<=24; i++) {
		  if (Board["p"+i][1] != (Board.onMove == "black" ? 0 : 1)) continue;
		  vm["p"+i] = [];
		  for (var j=0; j<Board.moves.length; j++) {
			if (isValid("p"+i, Board.moves[j]) && vm["p"+i].indexOf(Board.moves[j]) == -1) vm["p"+i].push(Board.moves[j]);
		  }
		}
	  }
	  //console.log("validmoves: ", vm);
	}
	
	function isValid(start, number){
	  var startPt, target;
	  if (start.charAt(0) == "b") startPt = Board.onMove == "black" ? 25 : 0;
	  else startPt = parseInt(start.substr(1));
	  target = Board.onMove == "black" ? startPt-number : startPt+number;
	  if (Board.onMove == "black" && target <= 0) target = "offBlack";
	  else if (Board.onMove == "white" && target >= 25) target = "offWhite";
	  else target = "p"+target;
	  
	  if (target.charAt(0) == "p") {
		if (Board[target][1] == -1) return true;
		if (Board[start][1] == Board[target][1]) return true;
		if (Board[target][0] > 1) return false;
		else return true;
	  }
	  else {   //bear off
		var playerCode = Board.onMove == "black" ? 0 : 1;
		var shift = Board.onMove == "black" ? 6 : 0;
		for (var i = 1+shift; i <= 18+shift; i++) {
		  if (Board["p"+i][1] == playerCode) return false;
		}
		if (startPt == (Board.onMove == "black" ? number : 25-number)) return true;
		if (Board.onMove == "black") {
		  for (var i = startPt+1; i <= 6; i++) {
			if (Board["p"+i][1] == playerCode) return false;
		  }
		}
		if (Board.onMove == "white") {
		  for (var i = startPt-1; i >= 19; i--) {
			if (Board["p"+i][1] == playerCode) return false;
		  }
		}
		return true;
	  }
	}
}

export default class Backgammon {


	static defaultOptions = { 
		
		onmove: function() {},
		undo: function() {},
		onover: function() {}
	};


	#ctx;
	#opt = Backgammon.defaultOptions;
	#w = 600;
	#scale = 1;
	#score = [0, 0];
	#total = 1;
	#selection = -1;
	#moves = [];
	#last = [];
	#color = 'black';
	#game = new Game;

	get context() { return this.#ctx; }
	get canvas() { return this.#ctx.canvas; }
	get width() { return this.canvas.width; }
	get height() { return this.canvas.height; }

	get onmove() { return this.#game.board.getPlayingColor(); }
	get waiting() { return this.#color != this.onmove; }
	get opponent() { return this.#color == 'black' ? 'white' : 'black'; }
	get turn() { return Board.onMove; }

	set level(v) { this.#opt.ai = v; }

	constructor (canvas, color='black', opt={}) {

		canvas.onclick = (e) => this.#handleClick(e.offsetX, e.offsetY);
		
		ctx = canvas.getContext('2d');
		this.#ctx = ctx;

		this.#color = color;

		Object.assign(this.#opt, opt);

		this.reset(color);

		const resizeObserver = new ResizeObserver(e => this.#onResize(e[0].contentRect));
		resizeObserver.observe(canvas);
	}

	async init() {

		// initalize AI
		await this.#game.init();

	}

	draw() {

		const brd = Board;

		const boardBorderColor = "#663300";
		const boardInnerColor = "#B88A00";
		const triangleColor1 = "#ADAD85";
		const triangleColor2 = "#FF471A";
		const triangleBorderColor = "#444";
		//   const blackCheckerColor = "#333";
		//   const whiteCheckerColor = "#DDD";
		const cubeBodyColor = "#DDD";
		const cubeNumberColor = "#333";
		const buttonBackgroundColor = "#FCBD00";
		const buttonBorderColor = "#333";
		const buttonTextColor = "#FD3200";
		//   const blackDiceBodyColor = "#333";
		//   const blackDiceDotColor = "#DDD";
		//   const whiteDiceBodyColor = "#DDD";
		//   const whiteDiceDotColor = "#333";
		
		var blackCheckerColor, whiteCheckerColor, blackDiceBodyColor, blackDiceDotColor, whiteDiceBodyColor, whiteDiceDotColor;
		if (brd.owner == 'black') {
			blackCheckerColor = "#333";
			whiteCheckerColor = "#DDD";
			blackDiceBodyColor = "#333";
			blackDiceDotColor = "#DDD";
			whiteDiceBodyColor = "#DDD";
			whiteDiceDotColor = "#333";
		}
		else {
			blackCheckerColor = "#DDD";
			whiteCheckerColor = "#333";
			blackDiceBodyColor = "#DDD";
			blackDiceDotColor = "#333";
			whiteDiceBodyColor = "#333";
			whiteDiceDotColor = "#DDD";
		}
		
		var w = this.#w;
		var h = w*3/4;
		var p = 0.02; //the board is sliced to 50 pitches both vertically and horizontally
		//canvas.width = w;
		//canvas.height = h;

		drawEmptyBoard();
		drawPoints();
		drawCheckersOnTheBar();
		drawCheckersBearedOff();
		drawCube(Cube);
		drawRest();

		// draw functions
		function drawEmptyBoard() {
			// draw board frame
			ctx.save();
			ctx.fillStyle = boardBorderColor;
			ctx.fillRect(0, 0, w, h);
			ctx.fillStyle = boardInnerColor;
			ctx.fillRect(w*p, h*p*2, w*p*3, h*p*20); //top left holder
			ctx.fillRect(w*p, h*p*28, w*p*3, h*p*20); //bottom left holder
			ctx.fillRect(w*p*46, h*p*2, w*p*3, h*p*20); //top right holder
			ctx.fillRect(w*p*46, h*p*28, w*p*3, h*p*20); //bottom right holder
			ctx.fillRect(w*p*5, h*p*2, w*p*18, h*p*46); //left board
			ctx.fillRect(w*p*27, h*p*2, w*p*18, h*p*46); //right board
			// draw the 24 triangles
			for (var i = 0; i <= 5; i++) {
			  drawTriangle(5 + i*3, 2, 3, 20, i%2); //top left tiangs
			  drawTriangle(5 + i*3, 48, 3, 20, (i+1)%2); //bottom left triangs
			  drawTriangle(27 + i*3, 2, 3, 20, i%2); //top right triangs
			  drawTriangle(27 + i*3, 48, 3, 20, (i+1)%2); //bottom right triangs
			}
			ctx.restore();

			drawWatermark('www.sipme.io');
		
			function drawTriangle(startx, starty, width, height, color) {
				var peak;
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(w * p * startx, h * p * starty);
				peak = starty < 25 ? starty + height : starty - height;
				ctx.lineTo(w * p * (startx + width / 2), h * p * peak);
				ctx.lineTo(w * p * (startx + width), h * p * starty);
				ctx.fillStyle = color == 0 ? triangleColor1 : triangleColor2;
				ctx.strokeStyle = triangleBorderColor;
				ctx.fill();
				ctx.stroke();
				ctx.restore();
			}
			function drawWatermark(text) {
				ctx.save();
				//ctx.translate(btn.x, btn.y);
				//ctx.rotate(angle);

				const s = w / 50
					, x = w / 10
					, y = h - s * .7
					;
				
				
				ctx.fillStyle = '#fff8';
				ctx.textBaseline = "middle";
				ctx.textAlign = "center";
				ctx.font = "bold " + `${s}px` + " monospace";
				ctx.fillText(text, x, y);
				ctx.restore();
			}
		}

		function drawPoints() {
			for (var i = 1; i <= 24; i++) 
				drawPoint(i, brd["p" + i]);
		}

		function drawPoint(j, point) {
			if (point[1] == -1 || point[0] == 0) return;
			var color;
			color = point[1] == 0 ? blackCheckerColor : whiteCheckerColor;
			// color = point[1] == 0 ? whiteCheckerColor : blackCheckerColor ;
			var centerx, centery;
			var numCheckers = Math.min(point[0], 5);
			for (var i = 0; i < numCheckers; i++) {
			  if (j >= 19) {
				centerx = w*p * (28.5 + (j-19) * 3);
				centery = 2*h*p + 1.5*w*p + i*3*w*p;
			  } else if (j >= 13) {
				centerx = w*p * (6.5 + (j-13) * 3);
				centery = 2*h*p + 1.5*w*p + i*3*w*p;
			  } else if (j >= 7) {
				centerx = w*p * (6.5 + (12-j) * 3);
				centery = 48*h*p - 1.5*w*p - i*3*w*p;
			  } else {
				centerx = w*p * (28.5 + (6-j) * 3);
				centery = 48*h*p - 1.5*w*p - i*3*w*p;
			  }
			  drawChecker(centerx, centery, color, (j == brd.mouseOverPoint && i == numCheckers-1 && brd.status == "move" && point[1] == (brd.onMove == "black" ? 0 : 1)));
			}
			if (point[0] > 5) {  //draw number to the last checker if they are more then 5
			  ctx.save();
			  ctx.fillStyle = color == blackCheckerColor ? whiteCheckerColor : blackCheckerColor;
			  ctx.font = w*p*1.8 + "px Arial";
			  ctx.textBaseline = "middle";
			  ctx.textAlign = "center";
			  ctx.fillText(point[0].toString(), centerx, centery);
			  ctx.restore();
			}
		}

		function drawChecker(x, y, col, hl) {
			hl = hl || false;
			var r = w*p*1.5;
			ctx.save();
			ctx.beginPath();
			if (hl) { //highlight of the active checker by elevating it
				r *= 1.05;
				addShadow();
			}
			ctx.arc(x, y, r*0.99, 0, 2 * Math.PI);
			ctx.fillStyle = col;
			ctx.fill();
			ctx.restore();
			ctx.stroke();
		
			function addShadow() {
				ctx.shadowColor = "#444"; // color
				ctx.shadowBlur = 5; // blur level
				ctx.shadowOffsetX = r * 0.2; // horizontal offset
				ctx.shadowOffsetY = r * 0.2; // vertical offset
			}
		}

		function drawCheckersOnTheBar(){
			var x = w*p*25;
			var y, color;
			for (var i=0; i<brd.barBlack[0]; i++) {
			  y = h*p*18 - i*w*p*3;
			  color = blackCheckerColor;
			  drawChecker(x, y, color, (brd.mouseOver == "barBlack" && i == brd.barBlack[0]-1 && brd.status == "move" && brd.onMove == "black" ));
			}
			for (var i=0; i<brd.barWhite[0]; i++) {
			  y = h*p*32 + i*w*p*3;
			  color = whiteCheckerColor;
			  drawChecker(x, y, color, (brd.mouseOver == "barWhite" && i == brd.barWhite[0]-1 && brd.status == "move" && brd.onMove == "white" ));
			}
		}
		  
		function drawCheckersBearedOff() {
			ctx.save();
			ctx.fillStyle = blackCheckerColor;
			ctx.lineWidth = 2;
			for (var i = 1; i <= brd.offBlack[0]; i++) {
			  ctx.fillRect(w*p*46, h*p*(48 - i*4/3), w*p*3, h*p*4/3);
			  ctx.strokeRect(w*p*46, h*p*(48 - i*4/3), w*p*3, h*p*4/3);
			}
			ctx.fillStyle = whiteCheckerColor;
			for (var i = 0; i < brd.offWhite[0]; i++) {
			  ctx.fillRect(w*p*46, h*p*(2 + i*4/3), w*p*3, h*p*4/3);
			  ctx.strokeRect(w*p*46, h*p*(2 + i*4/3), w*p*3, h*p*4/3);
			}
			ctx.restore();
		}
		
		function drawCube(cb) {
			if (cb.position == "off") return;
			cb.x = w*p*2.5;  // x and y specify the center of the cube
			cb.y = h*p*25;
			cb.angle = 0;
			cb.size = w*p*3*0.95;
			cb.fontsize = cb.size*0.7 + "px";
			var nr = cb.value == 1 ? "64" : cb.value.toString();
			if (cb.position == "center") {
			  cb.angle = Math.PI * 1.5;
			} else if (cb.position == "black") {
			  cb.y = h*p*48 - cb.size/2;
			} else if (cb.position == "white") {
			  cb.y = h*p*2 + cb.size/2;
			  cb.angle = Math.PI;
			} else if (cb.position == "right") {
			  cb.x = w*p*36;
			  cb.angle = Math.PI;
			} else if (cb.position == "left") {
			  cb.x = w*p*14;
			}
			ctx.save();
			ctx.fillStyle = cubeBodyColor;
			ctx.translate(cb.x, cb.y);
			ctx.rotate(cb.angle);
			ctx.translate(-cb.size/2, -cb.size/2);
			roundRect(ctx, 0, 0, cb.size, cb.size, cb.size*0.05, true, true);
			ctx.fillStyle = cubeNumberColor;
			ctx.font = "bold " + cb.fontsize + " Arial";
			ctx.textBaseline = "middle";
			ctx.textAlign = "center";
			ctx.fillText(nr, cb.size/2, cb.size/2);
			ctx.restore();
			cb.onScreen = true;
		}

		function drawRest() {

			switch (brd.status) {

				case 'roll':
				drawRollButton();
				break;

				case 'move':
				drawDices()
				break;

				case 'accept':
				drawAcceptButton();
				break;

				case 'start':
				drawStartButton();
				break;

				case 'over':
				drawOverButton();
				break;
			}
			
		
			function drawRollButton() {
			  rollButton = new Button(0, h*p*25, w*p*6, h*p*3, "ROLL");
			  rollButton.x = brd.onMove == "black" ? w*p*36 : w*p*14;
			  drawButton(rollButton);
			}
			
			function drawStartButton(){
			  startButton = new Button(w*p*25, h*p*25, w*p*8, h*p*4, "START");
			  drawButton(startButton);
			}

			function drawOverButton(){
				const button = new Button(w*p*25, h*p*25, w*p*8, h*p*4, "OVER");
				drawButton(button);
			  }
		
			function drawDices() {
			  var x = brd.onMove == "black" ? w*p*35.5 - h*p*4 : w*p*14.5;
			  var y = h*p*23;
			  Dices.position = brd.onMove == "black" ? "right" : "left";
			  var diceColor = brd.onMove == "black" ? blackDiceBodyColor : whiteDiceBodyColor;
			  var dotColor = brd.onMove == "black" ? blackDiceDotColor : whiteDiceDotColor;
			  drawDice(ctx, x, y, h*p*4, Dices.diceValueLeft, diceColor, dotColor);
			  x = brd.onMove == "black" ? x + h*p*4 + w*p : x - h*p*4 - w*p;
			  drawDice(ctx, x, y, h*p*4, Dices.diceValueRight, diceColor, dotColor);
			  Dices.onScreen = true;
			  
			  function drawDice(ctx, x, y, size, value, diceColor, dotColor) {
				/*  This function draws a dice to the canvas.
				ctx is the canvas context
				x, y are the coordinates of the top left corner of the dice
				size is the length of the dice size in px
				value is the value of the dice. It shall be between 1 and 6
				diceColor and DotColor are color of the dice body and of the dots on it respectively 
				the roundRect function is not part of the function but it shall be in the code as well  */
				const dots = [];
				ctx.save();
				ctx.fillStyle = diceColor;
				ctx.translate(x, y);
				roundRect(ctx, 0, 0, size, size, size * 0.1, true, false);
		
				//define dot locations
				var padding = 0.25;
				var x, y;
				x = padding * size;
				y = padding * size;
				dots.push({x: x, y: y});
				y = size * 0.5;
				dots.push({x: x, y: y});
				y = size * (1 - padding);
				dots.push({x: x, y: y});
				x = size * 0.5;
				y = size * 0.5;
				dots.push({x: x, y: y});
				x = size * (1 - padding);
				y = padding * size;
				dots.push({x: x, y: y});
				y = size * 0.5;
				dots.push({x: x, y: y});
				y = size * (1 - padding);
				dots.push({x: x, y: y});
		
				var dotsToDraw;
				if (value == 1) dotsToDraw = [3];
				else if (value == 2) dotsToDraw = [0, 6];
				else if (value == 3) dotsToDraw = [0, 3, 6];
				else if (value == 4) dotsToDraw = [0, 2, 4, 6];
				else if (value == 5) dotsToDraw = [0, 2, 3, 4, 6];
				else if (value == 6) dotsToDraw = [0, 1, 2, 4, 5, 6];
				else console.log("Dice value shall be between 1 and 6");
		
				ctx.fillStyle = dotColor;
				for (var i = 0; i < dotsToDraw.length; i++) {
				  ctx.beginPath();
				  var j = dotsToDraw[i];
				  ctx.arc(dots[j].x, dots[j].y, size * 0.07, 0, 2 * Math.PI);
				  ctx.fill();
				}
				ctx.restore();
			  }
			}
		
			function drawAcceptButton() {
			  takeButton = new Button(0, h*p*25, w*p*6, h*p*3, "TAKE");
			  passButton = new Button(0, h*p*25, w*p*6, h*p*3, "PASS");
			  takeButton.x = brd.onMove == "black" ? w*p*36 - takeButton.width/2 - w*p/2 : w*p*14 + takeButton.width/2 + w*p/2;
			  passButton.x = brd.onMove == "black" ? w*p*36 + takeButton.width/2 + w*p/2 : w*p*14 - takeButton.width/2 - w*p/2;
			  drawButton(takeButton);
			  drawButton(passButton);
			}
		  }

		function drawButton(btn){
			btn.onScreen = true;
			// var angle = brd.onMove == "black" ? 0 : Math.PI;
			var angle = brd.onMove == 0;
			var fontsize = parseInt(btn.height*0.7).toString() + "px";
			ctx.save();
			ctx.translate(btn.x, btn.y);
			ctx.rotate(angle);
			ctx.translate(-btn.width/2, -btn.height/2);
			ctx.fillStyle = btn.backgroundColor;
			ctx.strokeStyle = btn.borderColor;
			roundRect(ctx, 0, 0, btn.width, btn.height, h*p*0.7, true, true);
			ctx.fillStyle = btn.textColor;
			ctx.textBaseline = "middle";
			ctx.textAlign = "center";
			ctx.font = "bold " + fontsize + " Arial";
			ctx.fillText(btn.text, btn.width/2, btn.height/2);
			ctx.restore();
		}

		function Button(x, y, width, height, text){
			this.x = x;  //take care, x and y specifiy the center of the button!
			this.y = y;
			this.width = width;
			this.height = height;
			this.text = text;
			this.backgroundColor = buttonBackgroundColor;
			this.borderColor = buttonBorderColor;
			this.textColor = buttonTextColor;
			this.onScreen = false;
		}
	}

	undo() {

		if (Board.onMove == 'white')
			return;

		Board.undo();

		this.draw();
	}

	reset(color='black', total=1, board) {
		Board.owner = color;

		this.#total = total;
		this.#reset(color, board);
	}

	#reset(color, board) {
		this.#game.reset();

		Board.reset(color);

		if (board) 
			this.#load(board);

		this.#roll();

		if (color == 'white') {
			this.#game.switchTurn();
			setTimeout(() => this.#move(), 1500);
		}
	}

	#load(board) {
		let w = -board[0], b = board[25];

		Board.barWhite = w;
		Board.barBlack = b;

		for (let i = 1; i < 25; ++i) {

			const p = Board[`p${i}`];

			if (board[i] > 0) {
				b += board[i];

				p[0] = board[i];
				p[1] = 0;
			}
			else if (board[i] < 0) {
				w += -board[i];

				p[0] = -board[i];
				p[1] = 1;
			}
			else {
				p[0] = p[1] = 0;
				Board[`p${i}`] = [0, 0];
			}

		}

		Board.offBlack = 15 - b;
		Board.offWhite = 15 - w;
	}

	#onResize(r) {

		// console.debug('#### ON RESIZE', r);

		const w = Math.min(r.width, r.height);

		this.#ctx.canvas.width = w;
		this.#ctx.canvas.height = w * 3 / 4;
		
		this.#setSize(w);
	}

	#setSize(s) {
		this.#w = s;
		// this.#scale = this.#w / Chessboard.SIZE;

		console.debug("# ", this.#w, this.#scale);

		this.draw();
	}

	#handleClick(X, Y) {
		// console.debug('On click:', X, Y);

		if (Board.status == 'over') {

			if (this.#score[0] < this.#total && this.#score[1] < this.#total) {
				this.#reset(Board.onMove);
			}

			return;
		}

		mousePos = getMousePos(this.canvas, X, Y);

		// console.log('Handle mouse click', Board.status, mousePos);
		if (!mousePos.point) return;

		Board.mouseOverPoint = mousePos.point.charAt(0) == "p" ? parseInt(mousePos.point.substr(1)) : undefined;
		
		if (Board.status == "start" && mousePos.point == "startButton") {
			Board.reset();
			var randomNumber1 = 0;
			var randomNumber2 = 0;
			while (randomNumber1 == randomNumber2) {
				randomNumber1 = Math.floor(Math.random()*6)+1;
				randomNumber2 = Math.floor(Math.random()*6)+1;
			}
			Board.onMove = randomNumber1 > randomNumber2 ? "black" : "white";
			Dices.diceValueLeft = Math.max(randomNumber1, randomNumber2);
			Dices.diceValueRight = Math.min(randomNumber1, randomNumber2);
			Board.moves.push(randomNumber1, randomNumber2);
			Board.moves.sort();
			// document.getElementById("statusInfo").innerHTML = Board.onMove.capitalizeFirstLetter() + " starts the game.";
			startButton.onScreen = false;
			Board.status = "move";
			this.draw();
		}
		
		if (Board.status == "roll") {
			if (mousePos.point == "rollButton") {
				this.#roll();
			}
			
			else if (mousePos.point == "Cube") {
				if (Board.onMove == "black" && Cube.position == "white") return;
				if (Board.onMove == "white" && Cube.position == "black") return;
				rollButton.onScreen = false;
				// document.getElementById("statusInfo").innerHTML = Board.onMove.capitalizeFirstLetter() + " has doubled. Do you accept?";
				Board.onMove = Board.onMove == "black" ? "white" : "black";
				Cube.position = Board.onMove == "black" ? "left" : "right";
				Cube.value *= 2;
				Board.status = "accept";
				this.draw();
			}
		}
		
		if (Board.status == "move") {
			// console.log(Board);
			var start, stpt;
			var target, tgpt;
			var valids = new ValidMoves();
			// usual move and entering from the bar
			if (mousePos.point.charAt(0) == "p" || mousePos.point.charAt(0) == "b") {
				if (Board[mousePos.point][1] != (Board.onMove == "black" ? 0 : 1)) {
					// document.getElementById("statusInfo").innerHTML = "This is not your checker!";
					return;
				}
				if (Board.moves.length == 0) {
					// document.getElementById("statusInfo").innerHTML = "You have moved already. Pick up the dice!";
					return;
				}
				start = mousePos.point;
				if (!valids.hasOwnProperty(start) || valids[start].length == 0) {
					// document.getElementById("statusInfo").innerHTML = "There aren't any valid moves from here.";
					return;
				} 
				stpt = start.charAt(0) == "p" ? Board.mouseOverPoint : (Board.onMove == "black" ? 25: 0);
				var currentMove = (valids[start].length > 1) ? Dices.diceValueLeft : valids[start][0];
				tgpt = Board.onMove == "black" ? stpt - currentMove : stpt + currentMove;
				if (Board.onMove == "black" && tgpt < 1) target = "offBlack";
				else if (Board.onMove == "white" && tgpt > 24) target = "offWhite";
				else target = "p" + tgpt;
				move(start, target);
				Board.moves.splice(Board.moves.indexOf(currentMove), 1);

				if (Board.moves.length > 0) {

					// check over
					if ((Board.onMove == 'black' && Board.offBlack[0] == 15) ||
						(Board.onMove == 'white' && Board.offWhite[0] == 15))
						this.#over();
					else {

						// human
						if (Board.onMove == 'black') {
							const validMoves = new ValidMoves;
							if (validMoves.numOfValidMoves() == 0) {
								this.#onmove();
								return;
							}
						}

						this.draw();
					}
				}
				else {
					this.#onmove();
				}
			}
			
			else if (mousePos.point == "Dices") {
				// change dice order
				if (valids.numOfValidMoves() > 0) {
					var temp = Dices.diceValueLeft;
					Dices.diceValueLeft = Dices.diceValueRight;
					Dices.diceValueRight = temp;
					this.draw();
				}
				// pick up the dice
				if (valids.numOfValidMoves() == 0) {
					// detect game end
					if (Board["off"+Board.onMove.capitalizeFirstLetter()][0] == 15) {
						// document.getElementById("statusInfo").innerHTML = Board.onMove.capitalizeFirstLetter() + " won the game. Press start for a new one.";
						Dices.onScreen = false;
						Board.status = "start";
						this.draw();
						return;
					}

					console.log('BG: send a move', Board.playedMoves);

					Dices.onScreen = false;
					Board.onMove = Board.onMove == "black" ? "white" : "black";
					Board.status = "roll";
					Board.moves = [];
					Board.playedMoves = [];
					// document.getElementById("statusInfo").innerHTML = "New turn."
					this.draw();
				}
			}
		}
		
		if (Board.status == "accept") {
			if (mousePos.point == "takeButton") {
				takeButton.onScreen = false;
				passButton.onScreen = false;
				// document.getElementById("statusInfo").innerHTML = Board.onMove.capitalizeFirstLetter() + " has taken the cube. New turn";
				Cube.position = Board.onMove == "black" ? "black" : "white";
				Board.onMove = Board.onMove == "black" ? "white" : "black";
				Board.status = "roll";
				this.draw();
				
			}
			else if (mousePos.point == "passButton") {
				takeButton.onScreen = false;
				passButton.onScreen = false;
				var winner = Board.onMove == "black" ? "White" : "Black";
				Board.status = "start";
				// document.getElementById("statusInfo").innerHTML = winner + " won the game. Press start for a new one.";
				this.draw();
			}
		}

		this.draw();
	}

	#roll() {

		Board.moves = [];

		var randomNumber1, randomNumber2;
		randomNumber1 = Math.floor(Math.random()*6)+1;
		randomNumber2 = Math.floor(Math.random()*6)+1;
		Dices.diceValueLeft = randomNumber1;
		Dices.diceValueRight = randomNumber2;
		if (randomNumber2 > randomNumber1) {
			Dices.diceValueLeft = randomNumber2;
			Dices.diceValueRight = randomNumber1;
		}

		// test
		// if (Board.onMove == 'white') {
		// 	Dices.diceValueLeft = 6;
		// 	Dices.diceValueRight = 1;
		// }

		rollButton.onScreen = false;
		Board.moves.push(randomNumber1, randomNumber2);
		if (randomNumber2 == randomNumber1) 
			Board.moves.push(randomNumber1, randomNumber2);
		Board.moves.sort();
		// document.getElementById("statusInfo").innerHTML = "Rolled numbers: " + Dices.diceValueLeft + " " + Dices.diceValueRight;
		Board.status = "move";
		/*for (var i=1; i<=24; i++) Board.posBackup[i] = Board["p" + i];
		Board.posBackup.barWhite = Board.barWhite[0];
		Board.posBackup.barBlack = Board.barBlack[0];
		Board.posBackup.offWhite = Board.offWhite[0];
		Board.posBackup.offBlack = Board.offBlack[0];*/

		

		console.debug('ROLL:', Board.moves);

		this.draw();

		const valids = new ValidMoves();
		const numOfValidMoves = valids.numOfValidMoves();
		if (numOfValidMoves == 0) {

			if (Board.onMove == 'black') {
				setTimeout(() => this.#onmove(), 800);
			}
			else {

				this.#opt.onmove({
					color: Board.onMove,
					dices: [Dices.diceValueLeft, Dices.diceValueRight],
					moves: []
				});

				this.#game.switchTurn();
				this.#updateTurn();

				setTimeout(() => this.#roll(), 1200);
			}
		}

		return numOfValidMoves;
	}

	#onmove() {

		console.debug('User move', Board.playedMoves);

		const moves = Board.playedMoves.map(i => {

			const [ from, to ] = i.split('/');

			let f, t;

			if (from.startsWith('p'))
				f = parseInt(from.slice(1)) - 1;
			else if (from.startsWith('b'))
				f = 24;


			if (to.startsWith('p'))
				t = parseInt(to.slice(1)) - 1;
			else if (to.startsWith('o'))
				t = -1;


			return [f, t];
		});

		this.#opt.onmove({
			color: Board.onMove,
			dices: [Dices.diceValueLeft, Dices.diceValueRight],
			moves: Board.playedMoves
		});

		// check game over
		if (Board.offBlack[0] == 15) {
			console.debug('Game over. Black win');

			this.#over();
			return;
		}

		this.#game.move(moves);

		this.#updateTurn();

		const numValidMoves = this.#roll();
		if (numValidMoves == 0) { // roll will handle
			return;
		}

		setTimeout(() => this.#move(), 1000);
	}

	#move() {

		const dices = [Dices.diceValueLeft, Dices.diceValueRight];
		const moves = this.#game.move(dices, true);

		if (moves.length > 0) {

			let s, t;

			for (const i of moves) {

				s = i[0] == 24 ? 'barWhite' : `p${24 - i[0]}`;
				t = i[1] == -1 ? 'offWhite' : `p${24 - i[1]}`;

				move(s, t);

			}

			if (Board.offWhite[0] == 15) {
				this.#over();
			}
			else {

				this.#opt.onmove({
					color: Board.onMove,
					dices,
					moves: Board.playedMoves
				});

				this.#updateTurn();
				this.#roll();
			}

		}
		else {
			// todo: no valid moves ?
			console.debug('TODO: no valid moves');

			this.#updateTurn();
			this.#roll();
		}

	}

	#updateTurn() {

		Board.moves = [];
		Board.playedMoves = [];
		Board.onMove = Board.onMove == "black" ? "white" : "black";

		console.debug('Change turn', Board.onMove), 'AI turn', this.#game.turn;
	}

	#over() {

		let points, over = false, i;

		if (Board.onMove == 'white') {
			i = 1;
			points = Board.offBlack[0] > 0 ? 1 : 2;
		}
		else {
			i = 0;
			points = Board.offWhite[0] > 0 ? 1 : 2;
		}

		this.#score[i] += points;
		over = this.#score[i] == this.#total;

		const info = {
			win: Board.onMove,
			score: this.#score,
			total: this.#total,
			points,
			over
		};

		console.debug('Game over:', info);

		Board.status = 'over';
		Cube.position == "off";
		Dices.onScreen = false;

		this.draw();

		this.#opt.onover(info);

		return;
	}
}

function move(start, target) {

	console.debug('MOVE:', start, target);

	if (Board.playedMoves.length == 0) Board.save();
	// if the target is off 
	if (target.charAt(0) == "o") Board["off" + Board.onMove.capitalizeFirstLetter()][0]++;
	// if the target point is empty
	else if (Board[target][0] == 0) {
	  Board[target][0]++;
	  Board[target][1] = Board[start][1];
	}
	// if the target point is owned by the player on move
	else if (Board[target][1] == Board[start][1]) Board[target][0]++;
	// if the player hits on the target point
	else {
	  Board[target][1] = 1 - Board[target][1];
	  if (Board.onMove == "black") Board.barWhite[0]++;
	  else Board.barBlack[0]++;
	}
	if (--Board[start][0] == 0 && start.charAt(0) == "p") Board[start][1] = -1;
	Board.playedMoves.push(start+"/"+target);
	// document.getElementById("statusInfo").innerHTML = "Moved: " + start + "/" + target;
}

function getMousePos(canvas, X, Y) {
	/*  This function gets the mouse position and returns with an object:
	{
	x: x coordinate of the mouse in the canvas,
	y: y coordinate of the mouse in the canvas,
	xp: mouse x coordinte in the canvas in horizontal pitches (0-50),
	yp: mouse y coordinte in the canvas in vertical pitches (0-50),
	point: specific area of the board as a string
	}
	*/
	var rect = canvas.getBoundingClientRect();
	var w = canvas.width;
	var h = canvas.height;
	var p = 0.02;
	var pt = 0;
	var result = {
	//   x: X - rect.left,
	//   y: Y - rect.top,
		x: X, y: Y
	};
	result.xp = parseFloat(result.x / rect.width * 50).toFixed(2);
	result.yp = parseFloat(result.y / rect.height * 50).toFixed(2);
  
	if (result.xp > 27 && result.xp < 45 && result.yp > 2 && result.yp < 22) 
	  pt = Math.floor((result.xp - 27) / 3) + 19;
	else if (result.xp > 5 && result.xp < 23 && result.yp > 2 && result.yp < 22) 
	  pt = Math.floor((result.xp - 5) / 3) + 13;
	else if (result.xp > 5 && result.xp < 23 && result.yp > 28 && result.yp < 48) 
	  pt = 12 - Math.floor((result.xp - 5) / 3);
	else if (result.xp > 27 && result.xp < 45 && result.yp > 28 && result.yp < 48) 
	  pt = 6 - Math.floor((result.xp - 27) / 3);
  
	if (pt != 0) result.point = "p" + pt;
	else if (result.xp > 46 && result.xp < 49 && result.yp > 2 && result.yp < 22) 
	  result.point = "offWhite";
	else if (result.xp > 46 && result.xp < 49 && result.yp > 28 && result.yp < 48) 
	  result.point = "offBlack";
	// else if (Board.barBlack[0] > 0 && result.xp > 23.5 && result.xp < 26.5 && result.y < h*p*18 + w*p*1.5 && result.y > h*p*18 - w*p*3*(Board.barBlack[0] - 0.5)) 
	//   result.point = "barBlack";
	// else if (Board.barWhite[0] > 0 && result.xp > 23.5 && result.xp < 26.5 && result.y > h*p*32 - w*p*1.5 && result.y < h*p*32 + w*p*3*(Board.barWhite[0] - 0.5)) 
	//   result.point = "barWhite";
	else if (Board.barBlack[0] > 0 && result.xp > 23.5 && result.xp < 26.5) 
		result.point = "barBlack";
	else if (rollButton.onScreen && result.x > rollButton.x - rollButton.width/2 && result.x < rollButton.x + rollButton.width/2 && result.y > rollButton.y - rollButton.height/2 && result.y < rollButton.y + rollButton.height/2) 
	  result.point = "rollButton";
	else if (startButton.onScreen && result.xp > 21 && result.xp < 29 && result.yp > 23 && result.yp < 27)
	  result.point = "startButton";
	else if (takeButton.onScreen && result.x > takeButton.x - takeButton.width/2 && result.x < takeButton.x + takeButton.width/2 && result.y > takeButton.y - takeButton.height/2 && result.y < takeButton.y + takeButton.height/2)
	  result.point = "takeButton";
	else if (passButton.onScreen && result.x > passButton.x - passButton.width/2 && result.x < passButton.x + passButton.width/2 && result.y > passButton.y - passButton.height/2 && result.y < passButton.y + passButton.height/2)
	  result.point = "passButton";
	else if (Cube.onScreen && result.x > Cube.x - Cube.size/2 && result.x < Cube.x + Cube.size/2 && result.y > Cube.y - Cube.size/2 && result.y < Cube.y + Cube.size/2) 
	  result.point = "Cube";
	else if (Dices.onScreen) {
	  if (Dices.position == "right" && result.xp > 32.5 && result.xp < 39.5 && result.yp > 23 && result.yp < 27) 
		result.point = "Dices";
	  if (Dices.position == "left" && result.xp > 10.5 && result.xp < 17.5 && result.yp > 23 && result.yp < 27) 
		result.point = "Dices";
	}
	else result.point = undefined;
  
	return result;
  }

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
	if (typeof stroke == 'undefined') {
	  stroke = true;
	}
	if (typeof radius === 'undefined') {
	  radius = 5;
	}
	if (typeof radius === 'number') {
	  radius = {
		tl: radius,
		tr: radius,
		br: radius,
		bl: radius
	  };
	} else {
	  var defaultRadius = {
		tl: 0,
		tr: 0,
		br: 0,
		bl: 0
	  };
	  for (var side in defaultRadius) {
		radius[side] = radius[side] || defaultRadius[side];
	  }
	}
	ctx.beginPath();
	ctx.moveTo(x + radius.tl, y);
	ctx.lineTo(x + width - radius.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	ctx.lineTo(x + width, y + height - radius.br);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	ctx.lineTo(x + radius.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	ctx.lineTo(x, y + radius.tl);
	ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	ctx.closePath();
	if (fill) {
	  ctx.fill();
	}
	if (stroke) {
	  ctx.stroke();
	}
}
