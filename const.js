export const MoveType = {
	MOVE_GAMEINFO: 0,
	MOVE_NORMAL: 1,
	MOVE_DOUBLE: 2,
	MOVE_TAKE: 3,
	MOVE_DROP: 4,
	MOVE_RESIGN: 5,
	MOVE_SETBOARD: 6,
	MOVE_SETDICE: 7,
	MOVE_SETCUBEVAL: 8,
	MOVE_SETCUBEPOS: 9
}

export const GameState = {
	GAME_NONE: 0, 
	GAME_PLAYING: 1, 
	GAME_OVER: 2,
	GAME_RESIGNED: 3, 
	GAME_DROP: 4
}

export const EvalType = {
    EVAL_NONE: 0, 
	EVAL_EVAL: 1, 
	EVAL_ROLLOUT: 2
};

export const CMark = {
    CMARK_NONE: 0,
    CMARK_ROLLOUT: 1
}

export const LuckType = {
    LUCK_VERYBAD: 0, 
	LUCK_BAD: 1, 
	LUCK_NONE: 2, 
	LUCK_GOOD: 3, 
	LUCK_VERYGOOD: 4
}

export const PositionClass = {
	CLASS_OVER: 0,             /* Game already finished */
    CLASS_HYPERGAMMON1: 1,         /* hypergammon with 1 chequers */
    CLASS_HYPERGAMMON2: 2,         /* hypergammon with 2 chequers */
    CLASS_HYPERGAMMON3: 3,         /* hypergammon with 3 chequers */
    CLASS_BEAROFF2: 4,             /* Two-sided bearoff database (in memory) */
    CLASS_BEAROFF_TS: 5,           /* Two-sided bearoff database (on disk) */
    CLASS_BEAROFF1: 6,             /* One-sided bearoff database (in memory) */
    CLASS_BEAROFF_OS: 7,           /* One-sided bearoff database /on disk) */
    CLASS_RACE: 8,                 /* Race neural network */
    CLASS_CRASHED: 9,              /* Contact, one side has less than 7 active checkers */
    CLASS_CONTACT: 10   
}

export const NNStateType = {
    NNSTATE_NONE: -1,
    NNSTATE_INCREMENTAL: 0,
    NNSTATE_DONE: 1
} 

export const MetIndeces = {
	DP: 0, NDW: 0, DTW: 1, NDWG: 1, NDWB: 2, DTWG: 3, DTWB: 4,
	/* player 0 loses, first cube value */
	NDL: 5, DTL: 6, NDLG: 6, NDLB: 7, DTLG: 8, DTLB: 9,
	/* player 0 wins, 2nd cube value */
	DPP0: 10, DTWP0: 11, NDWBP0: 12, DTWGP0: 13, DTWBP0: 14,
	/* player 0 loses, 2nd cube value */
	NDLP0: 15, DTLP0: 16, NDLBP0: 17, DTLGP0: 18, DTLBP0: 19,
	/* player 0 wins, 3rd cube value */
	DPP1: 20, DTWP1: 21, NDWBP1: 22, DTWGP1: 23, DTWBP1: 24,
	/* player 0 loses, 3rd cube value */
	NDLP1: 25, DTLP1: 26, NDLBP1: 27, DTLGP1: 28, DTLBP1: 29
};