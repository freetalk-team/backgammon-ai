
import { GameState } from "./const.js";

const VARIATION_STANDARD = 0
	, MAX_FILTER_PLIES = 4
	;

export function initBoard(init=true) {

	const b = new Uint32Array(25).fill(0);

	if (init) {
		b[5] = 5;
		b[7] = 3;
		b[12] = 5;
		b[23] = 2;
	}

	// b[24] = 3;

	return [ b, new Uint32Array(b) ];
}

export function initCubeInfo() {
	return {
		nCube: 0,
		fCubeOwner: 0,
		fMove: 0,
		nMatchTo: 0,
		anScore: [0, 0],
		fCrawford: 0,
		fJacoby: 0,
		fBeavers: 0,
		arGammonPrice: new Float32Array(4),
		bgv: VARIATION_STANDARD
	};
}

export function initMatchState() {
	return {
		anBoard:  initBoard(true),
		anDice: [0, 0],
		fTurn: 0,
		fResigned: 0,
		fResignationDeclined: 0,
		fDoubled: false,
		cGames: 0,
		fMove: 0,
		fCubeOwner: -1,
    	fCrawford: false,
		fPostCrawford: false,
    	nMatchTo: 0,
		anScore: [0, 0],
		nCube: 1,
		cBeavers: 0,
		bgv: VARIATION_STANDARD,
		fCubeUse: true,
		fJacoby: true,
		gs: GameState.GAME_NONE
	};
}

export function initKey() {
	return new Uint32Array(7).fill(0);
}

export function initEvalContext(fCubeful=true, nPlies=1, fUsePrune=false) {
	return {
		fCubeful /* cubeful evaluation */
		, nPlies
		, fUsePrune 
		, fDeterministic: true 
		, rNoise: 0.0               /* standard deviation */
	};
}

export function initEvalSetup() {
	return {
		et: 0,
		ec: initEvalContext(),
		rc: {
			aecCube: [initEvalContext(false, 2), initEvalContext(false, 2)], 
			aecChequer: [initEvalContext(false, 0), initEvalContext(false, 0)],
			aecCubeLate: [initEvalContext(false, 2), initEvalContext(false, 2)],
			aecChequerLate: [initEvalContext(false, 0), initEvalContext(false, 0)],
			aecCubeTrunc: initEvalContext(false, 2),
			aecChequerTrunc: initEvalContext(false, 2),

			aaamfChequer: [ initMoveFilter(MAX_FILTER_PLIES), initMoveFilter(MAX_FILTER_PLIES) ],
			aaamfLate: [ initMoveFilter(MAX_FILTER_PLIES), initMoveFilter(MAX_FILTER_PLIES) ],
 
			fCubeful: false,    /* Cubeful rollout */
			fVarRedn: true,    /* variance reduction */
			fInitial: false,    /* roll out as opening position */
			fRotate: true,     /* quasi-random dice */
			fTruncBearoff2: true,      /* cubeless rollout: trunc at BEAROFF2 */
			fTruncBearoffOS: true,     /* cubeless rollout: trunc at BEAROFF_OS */
			fLateEvals: false,  /* enable different evals for later moves */
			fDoTruncate: true, /* enable truncated rollouts */
			fStopOnSTD: false,  /* stop when std's are small enough */
			fStopOnJsd: false,
			fStopMoveOnJsd: false,      /* stop multi-line rollout when jsd
												* is small enough */
			nTruncate: 10,   /* truncation */
			nTrials: 1296,       /* number of rollouts */
			nLate: 5,       /* switch evaluations on move nLate of game */
			// rng rngRollout;
			nSeed: 0,
			nMinimumGames: 324, /* always do at least this many */
			rStdLimit: 0.01,            /* stop when std < this */
			nMinimumJsdGames: 324,
			rJsdLimit: 2.33,
			nGamesDone: 0,
			rStoppedOnJSD: 0.0,
			nSkip: 0
		}
	}
}

function toFilter(Accept=0, Extra=0, Threshold=0.0) {
	return { Accept, Extra, Threshold };
}


export function initMoveFilter(type='normal') {

	const filters = {

		tiny: [ 
			[ toFilter(0,  5, .08), toFilter(), toFilter(), toFilter() ],
			[ toFilter(0,  5, .08), toFilter(-1), toFilter(), toFilter() ],
			[ toFilter(0,  5, .08), toFilter(-1), toFilter(0, 2, .02), toFilter() ],
			[ toFilter(0,  5, .08), toFilter(-1), toFilter(0, 2, .02), toFilter(-1) ]
		],

		narrow: [
			[ toFilter(0,  8, .12), toFilter(), toFilter(), toFilter() ],
			[ toFilter(0,  8, .12), toFilter(-1), toFilter(), toFilter() ],
			[ toFilter(0,  8, .12), toFilter(-1), toFilter(0, 2, .03), toFilter() ],
			[ toFilter(0,  8, .12), toFilter(-1), toFilter(0, 2, .03), toFilter(-1) ]
		],

		normal: [
			[ toFilter(0,  8, .16), toFilter(), toFilter(), toFilter() ],
			[ toFilter(0,  8, .16), toFilter(-1), toFilter(), toFilter() ],
			[ toFilter(0,  8, .16), toFilter(-1), toFilter(0, 2, .04), toFilter() ],
			[ toFilter(0,  8, .16), toFilter(-1), toFilter(0, 2, .04), toFilter(-1) ]
		],

		large: [
			[ toFilter(0,  16, .32), toFilter(), toFilter(), toFilter() ],
			[ toFilter(0,  16, .32), toFilter(-1), toFilter(), toFilter() ],
			[ toFilter(0,  16, .32), toFilter(-1), toFilter(0, 4, .08), toFilter() ],
			[ toFilter(0,  16, .32), toFilter(-1), toFilter(0, 4, .08), toFilter(-1) ]
		],

		huge: [
			[ toFilter(0,  20, .44), toFilter(), toFilter(), toFilter() ],
			[ toFilter(0,  20, .44), toFilter(-1), toFilter(), toFilter() ],
			[ toFilter(0,  20, .44), toFilter(-1), toFilter(0, 6, .11), toFilter() ],
			[ toFilter(0,  20, .44), toFilter(-1), toFilter(0, 6, .11), toFilter(-1) ]
		]

	};

	return filters[type];
}

export function initMoveList() {
	return { 
		cMoves: 0,
		cMaxMoves: 0,
		cMaxPips: 0,
		iMoveBest: 0,
		rBestScore: 0.0,
		amMoves: null
	};
}

