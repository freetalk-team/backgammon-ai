
import { 
	initMatchState, 
	initMoveList, 
	initCubeInfo, 
	initEvalSetup,
	initMoveFilter
} from './init.js';
	
import { EvalInitialise, FindnSaveBestMoves, GetMatchStateCubeInfo } from "./eval.js";

const PLAYER_HUMAN = 0
	, PLAYER_GNU = 1
	, PLAYER_EXTERNAL = 2
	;

// const ap = [ initPlayer(PLAYER_GNU), initPlayer(PLAYER_HUMAN) ];
const ap = [ initPlayer(PLAYER_HUMAN), initPlayer(PLAYER_GNU) ];


function initPlayer(pt) {

	return { name: pt == PLAYER_GNU ? 'gnubg' : 'user', pt, 
		esChequer: initEvalSetup(), esCube: initEvalSetup(),
		aamf: initMoveFilter()
	};

}



export function init(weights) {

	EvalInitialise(weights);
}

export function newState(color, board) {
	const ms = initMatchState();

	if (color)
		ms.fTurn = color == 'black' ? 0 : 1;

	if (board) {
		const x = ms.anBoard[0];
		const o = ms.anBoard[1];

		x.fill(0);
		o.fill(0);

		x[24] = board[25];
		o[24] = -board[0];

		for (let i = 1; i < 25; ++i) {

			if (board[i] > 0) {
				x[i - 1] = board[i];
			}
			else if (board[i] < 0) {
				o[24 - i] = -board[i];
			}
		}

		printBoard(ms.anBoard);
	}
	
	return ms;
} 

export function move(ms, moves) {

	console.debug('GAME move:', moves);

	const anBoard = ms.anBoard[ms.fTurn];
	const anBoardOpp = ms.anBoard[1 - ms.fTurn];

	for (const m of moves) {

		// const [f, t] = ms.fTurn ? [23 - m[0], 23 - m[1]] : [m[0], m[1]];
		const [f, t] = [m[0], m[1]];

		anBoard[f]--;
		anBoard[t]++;

		if (anBoardOpp[23 - t]) {
			anBoardOpp[23 - t] = 0;
			anBoardOpp[24]++;
		}
	}

	ms.fTurn = 1 - ms.fTurn;

	console.debug('AI play:', 1 - ms.fTurn, '=>', ms.fTurn);

	printBoard(ms.anBoard);
} 

export function aiMove(ms, dices) {

	// printBoard(ms.anBoard);

	const ci = initCubeInfo();
	const ml = initMoveList();

	GetMatchStateCubeInfo(ci, ms);

	const ec = ap[ms.fTurn].esChequer.ec;
	const aamf = ap[ms.fTurn].aamf;
	
	FindnSaveBestMoves(ml, dices[0], dices[1], ms.anBoard, null, 0, ci, ec, aamf);

	console.debug('Moves:', ml.cMoves, 'Best move:', ml.iMoveBest, 'dices:', dices);

	if (!ml.amMoves) {
		return [];
	}

	const moves = ml.amMoves.slice(0, ml.cMoves);

	// moves.map(i => console.debug('##', Array.from(i.anMove), i.rScore, i.rScore2));


	const best = moves[ml.iMoveBest];
	// console.debug(best);

	const mv = Array.from(best.anMove.slice(0, best.cMoves * 2))
		.flatMap((_, i, a) => i % 2 ? [] : [a.slice(i, i + 2)]);

	console.log('AI move', mv.map(i => `${i[0]}/${i[1]}`));

	move(ms, mv);


	return mv;
} 

function printBoard(anBoard) {

	// console.debug(anBoard);
	console.log(dumpBoard(anBoard));
}

function dumpBoard(anBoard) {
	const o = Array.from(anBoard[1])
	const x = Array.from(anBoard[0]);

	let s = '+13-14-15-16-17-18------19-20-21-22-23-24-+\n';

	for (let i = 0, j; i < 6; ++i) {

		s += '|';

		for (j = 11; j >= 6; --j) {

			s += (o[j] > i) ? ' O ' : (x[23 - j] > i) ? ' X ' : '   '; 
		}

		s += '| ' + (x[24] > i ? 'X': ' ') + ' |';

		for (; j >= 0; --j) {
			s += (o[j] > i) ? ' O ' : (x[23 - j] > i) ? ' X ' : '   '; 
		}

		s += '|\n';

	}

	s += '|                  |BAR|                  |\n';

	for (let i = 5, j; i >= 0; --i) {

		s += '|';

		for (j = 11; j >= 6; --j) {

			s += (o[23 - j] > i) ? ' O ' : (x[j] > i) ? ' X ' : '   '; 
		}

		// s += '|   |';
		s += '| ' + (o[24] > i ? 'O': ' ') + ' |';

		for (; j >= 0; --j) {
			s += (o[23 - j] > i) ? ' O ' : (x[j] > i) ? ' X ' : '   '; 
		}

		s += '|\n';

	}

	s += '+12-11-10--9--8--7-------6--5--4--3--2--1-+\n';

	return s;
}




