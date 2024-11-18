import md5 from './md5.js';
import { BearoffDist, getRaceBGprobs } from './bearoff.js';
import { NeuralNetEvaluate, NeuralNetLoadBinary, NNSTATE_INCREMENTAL, NNSTATE_DONE, NNSTATE_NONE } from './net.js';
import { PositionKey, PositionFromKey, PositionFromKeySwapped, EqualKeys, PositionBearoff } from './position.js';
import { GetHashKey, CacheLookup, CacheAdd, CacheCreate, CACHEHIT, newCacheNode } from './cache.js';
import { MoveType, GameState, EvalType, CMark, LuckType, PositionClass, NNStateType, MetIndeces } from './const.js';
import { initBoard, initCubeInfo, initEvalContext, initEvalSetup, initKey, initMoveFilter, initMoveList } from './init.js';
import { baseInputs } from './input.js';

const VARIATION_STANDARD = 0
	, VARIATION_NACKGAMMON = 1
	, VARIATION_HYPERGAMMON_1 = 2
	, VARIATION_HYPERGAMMON_2 = 3
	, VARIATION_HYPERGAMMON_3 = 4

	, BEAROFF_HYPERGAMMON = 3

	, MAX_CUBE = 1 << 12
	, NUM_OUTPUTS = 5
	, NUM_ROLLOUT_OUTPUTS = 7
	, MAX_FILTER_PLIES = 4
	, OUTPUT_EQUITY = 5
	, OUTPUT_CUBEFUL_EQUITY = 6

	, RI_OFF = 92
	, RI_NCROSS = 92 + 14
	, HALF_RACE_INPUTS = RI_NCROSS + 1
	/* n - number of checkers off
     * 
     * off1 -  1         n >= 5
     * n/5       otherwise
     * 
     * off2 -  1         n >= 10
     * (n-5)/5   n < 5 < 10
     * 0         otherwise
     * 
     * off3 -  (n-10)/5  n > 10
     * 0         otherwise
     */

    , I_OFF1 = 0, I_OFF2 = 1, I_OFF3 = 2

    /* Minimum number of pips required to break contact.
     * 
     * For each checker x, N(x) is checker location,
     * C(x) is max({forall o : N(x) - N(o)}, 0)
     * 
     * Break Contact : (sum over x of C(x)) / 152
     * 
     * 152 is dgree of contact of start position.
     */
    , I_BREAK_CONTACT = 3

    /* Location of back checker (Normalized to [01])
     */
    , I_BACK_CHEQUER = 4

    /* Location of most backward anchor.  (Normalized to [01])
     */
    , I_BACK_ANCHOR = 5

    /* Forward anchor in opponents home.
     * 
     * Normalized in the following way:  If there is an anchor in opponents
     * home at point k (1 <= k <= 6), value is k/6. Otherwise, if there is an
     * anchor in points (7 <= k <= 12), take k/6 as well. Otherwise set to 2.
     * 
     * This is an attempt for some continuity, since a 0 would be the "same" as
     * a forward anchor at the bar.
     */
    , I_FORWARD_ANCHOR = 6

    /* Average number of pips opponent loses from hits.
     * 
     * Some heuristics are required to estimate it, since we have no idea what
     * the best move actually is.
     * 
     * 1. If board is weak (less than 3 anchors), don't consider hitting on
     * points 22 and 23.
     * 2. Don't break anchors inside home to hit.
     */
    , I_PIPLOSS = 7

    /* Number of rolls that hit at least one checker.
     */
    , I_P1 = 8

    /* Number of rolls that hit at least two checkers.
     */
    , I_P2 = 9

    /* How many rolls permit the back checker to escape (Normalized to [01])
     */
    , I_BACKESCAPES = 10

    /* Maximum containment of opponent checkers, from our points 9 to op back 
     * checker.
     * 
     * Value is (1 - n/36), where n is number of rolls to escape.
     */
    , I_ACONTAIN = 11

    /* Above squared */
    , I_ACONTAIN2 = 12

    /* Maximum containment, from our point 9 to home.
     * Value is (1 - n/36), where n is number of rolls to escape.
     */
    , I_CONTAIN = 13

    /* Above squared */
    , I_CONTAIN2 = 14

    /* For all checkers out of home, 
     * sum (Number of rolls that let x escape * distance from home)
     * 
     * Normalized by dividing by 3600.
     */
    , I_MOBILITY = 15

    /* One sided moment.
     * Let A be the point of weighted average: 
     * A = sum of N(x) for all x) / nCheckers.
     * 
     * Then for all x : A < N(x), M = (average (N(X) - A)^2)
     * 
     * Diveded by 400 to normalize. 
     */
    , I_MOMENT2 = 16

    /* Average number of pips lost when on the bar.
     * Normalized to [01]
     */
    , I_ENTER = 17

    /* Probablity of one checker not entering from bar.
     * 1 - (1 - n/6)^2, where n is number of closed points in op home.
     */
    , I_ENTER2 = 18
    , I_TIMING = 19
    , I_BACKBONE = 20
    , I_BACKG = 21
    , I_BACKG1 = 22
    , I_FREEPIP = 23
    , I_BACKRESCAPES = 24
	, MORE_INPUTS = 25

	, MINPPERPOINT = 4
	, NUM_INPUTS = (25 * MINPPERPOINT + MORE_INPUTS) * 2
	, NUM_RACE_INPUTS = HALF_RACE_INPUTS * 2 
	, NUM_PRUNING_INPUTS = 25 * MINPPERPOINT * 2

	, OUTPUT_WIN = 0
	, OUTPUT_WINGAMMON = 1
	, OUTPUT_LOSEGAMMON = 3
	, OUTPUT_WINBACKGAMMON = 2
	, OUTPUT_LOSEBACKGAMMON = 4

	, MIN_PRUNE_MOVES = 5
	, MAX_PRUNE_MOVES = MIN_PRUNE_MOVES + 11
	, MAX_INCOMPLETE_MOVES = 3875

	, RBG_NPROBS = 5

	, UB4MAXVAL = 0xffffffff

	, CACHE_SIZE_DEFAULT = 19

	/* gammon possible by side on roll */
	, G_POSSIBLE = 0x1
    /* backgammon possible by side on roll */
	, BG_POSSIBLE = 0x2
    /* gammon possible by side not on roll */
	, OG_POSSIBLE = 0x4
    /* backgammon possible by side not on roll */
	, OBG_POSSIBLE = 0x8
	;

const CLASS_PERFECT = PositionClass.CLASS_BEAROFF_TS;
const CLASS_GOOD = PositionClass.CLASS_BEAROFF_OS;

const nBeavers = 3;
const fComputerDecision = false;
const cCache = 1 << CACHE_SIZE_DEFAULT;

const rTSCubeX = 0.6   /* for match play only */
	, rOSCubeX = 0.6
	, rRaceFactorX = 0.00125
	, rRaceCoefficientX = 0.55
	, rRaceMax = 0.7
	, rRaceMin = 0.6
	, rCrashedX = 0.68
	, rContactX = 0.68
	;

const cEval = { entries: [], hashMask: 0, size: 0 },
	cpEval = { entries: [], hashMask: 0, size: 0 }
	;

const gMoves = new Array(MAX_INCOMPLETE_MOVES);
const gNNState = new Array(3);

for (let i = 0; i < gMoves.length; ++i)
	gMoves[i] = initMove();

for (let i = 0; i < gNNState.length; ++i)
	gNNState[i] = { state: NNStateType.NNSTATE_NONE, savedBase: null, saveIBase: null };

const ecBasic = initEvalContext(false, 0, false, true, 0.0);
const defaultFilters = initMoveFilter('normal');
// const defaultFilters = initMoveFilter('tiny');

const acef = [
    EvalOver,
    /*EvalHypergammon1*/,
    /*EvalHypergammon2*/,
    /*EvalHypergammon3*/,
    /*EvalBearoff2*/, /*EvalBearoffTS*/,
    /*EvalBearoff1*/, /*EvalBearoffOS*/,
    EvalRace, EvalCrashed, EvalContact
];

const bc1 = null, bc2 = null;
const anChequers = new Int32Array([ 15, 15, 1, 2, 3 ]);

function cloneBoard(anBoard) {
	const [ b, w ] = anBoard;
	return [ new Uint32Array(b), new Uint32Array(w)];
}

function initMove() {
	return {
		anMove: new Int8Array(8).fill(0),
    	key: initKey(),
		cMoves: 0, cPips: 0,
		rScore: .0, rScore2: .0,
		arEvalMove: new Float32Array(NUM_ROLLOUT_OUTPUTS),
		arEvalStdDev: new Float32Array(NUM_ROLLOUT_OUTPUTS),

		esMove: initEvalSetup(),
		cmark: CMark.CMARK_NONE
	}
}

function initMoveInfo() {
	return {

		/* ordinal number of the game within a match */
		i: 0,
		/* match length */
		nMatch: 1,
		/* match score BEFORE the game */
		anScore: [0, 0],
		/* the Crawford rule applies during this match */
		fCrawford: 0,
		/* this is the Crawford game */
		fCrawfordGame: 0,
		fJacoby: 0,
		/* who won (-1 = unfinished) */
		fWinner: -1,
		/* how many points were scored by the winner */
		nPoints: 0,
		/* the game was ended by resignation */
		fResigned: 0,
		/* how many automatic doubles were rolled */
		nAutoDoubles: 0,
		/* Type of game */
		//bgvariation bgv; STANDARD
		/* Cube used in game */
		fCubeUse: 0
	};
}

function initNeuralNet() {
	return { 
		cInput: 0,
		cHidden: 0,
		cOutput: 0,
		nTrained: 0,
		rBetaHidden: 0.0,
		rBetaOutput: 0.0,
		arHiddenWeight: null,
		arOutputWeight: null,
		arHiddenThreshold: null,
		arOutputThreshold: null
	};
}

const nnContact = initNeuralNet()
	, nnRace = initNeuralNet()
	, nnCrashed = initNeuralNet()
	, nnpContact = initNeuralNet()
	, nnpRace = initNeuralNet()
	, nnpCrashed = initNeuralNet()
	;

const anEscapes = new Int32Array(0x1000)
	, anEscapes1 = new Int32Array(0x1000)
	, anPoint = new Int32Array([0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ])
	;

export function EvalInitialise(reader, fNoBearoff=true) {

	CacheCreate(cEval, cCache);
	CacheCreate(cpEval, 1 << 16);

	ComputeTable();

	reader.skip(8); // ????

	NeuralNetLoadBinary(nnContact, reader);
	NeuralNetLoadBinary(nnRace, reader);
	NeuralNetLoadBinary(nnCrashed, reader);
	NeuralNetLoadBinary(nnpContact, reader);
	NeuralNetLoadBinary(nnpRace, reader);
	NeuralNetLoadBinary(nnpCrashed, reader);

}


export function GetMatchStateCubeInfo(ci, ms) {

	SetCubeInfo(ci, ms.nCube, ms.fCubeOwner, ms.fMove,
		ms.nMatchTo, ms.anScore, ms.fCrawford, ms.fJacoby, nBeavers, ms.bgv);
}

function SetCubeInfo(ci, nCube, fCubeOwner, fMove, nMatchTo, anScore, fCrawford, fJacoby, fBeavers, bgv) {
	return nMatchTo 
		? SetCubeInfoMatch(ci, nCube, fCubeOwner, fMove, nMatchTo, anScore, fCrawford, bgv)
		: SetCubeInfoMoney(ci, nCube, fCubeOwner, fMove, fJacoby, fBeavers, bgv);
}

function SetCubeInfoMoney(ci, nCube, fCubeOwner, fMove, fJacoby, fBeavers, bgv) {

	ci.nCube = nCube;
	ci.fCubeOwner = fCubeOwner;
	ci.fMove = fMove;
	ci.fJacoby = fJacoby;
	ci.fBeavers = fBeavers;
	ci.nMatchTo = ci.anScore[0] = ci.anScore[1] = 0;
	ci.fCrawford = false;
	ci.bgv = bgv;

	ci.arGammonPrice = (fJacoby && fCubeOwner == -1) ? [0,0,0,0] : [1,1,1,1];
}

function SetCubeInfoMatch() {
	console.error('Set info match not implemented');
}

function CalculateHalfInputs(anBoard, anBoardOpp, afInput) {
    let i, j, k, l, nOppBack, n, aHit = new Int32Array(39), nBoard;

    /* aanCombination[n] -
     * How many ways to hit from a distance of n pips.
     * Each number is an index into aIntermediate below. 
     */
    const aanCombination = [
        new Int32Array([0, -1, -1, -1, -1]),    /*  1 */
        new Int32Array([1, 2, -1, -1, -1]),     /*  2 */
        new Int32Array([3, 4, 5, -1, -1]),      /*  3 */
        new Int32Array([6, 7, 8, 9, -1]),       /*  4 */
        new Int32Array([10, 11, 12, -1, -1]),   /*  5 */
        new Int32Array([13, 14, 15, 16, 17]),   /*  6 */
        new Int32Array([18, 19, 20, -1, -1]),   /*  7 */
        new Int32Array([21, 22, 23, 24, -1]),   /*  8 */
        new Int32Array([25, 26, 27, -1, -1]),   /*  9 */
        new Int32Array([28, 29, -1, -1, -1]),   /* 10 */
        new Int32Array([30, -1, -1, -1, -1]),   /* 11 */
        new Int32Array([31, 32, 33, -1, -1]),   /* 12 */
        new Int32Array([-1, -1, -1, -1, -1]),   /* 13 */
        new Int32Array([-1, -1, -1, -1, -1]),   /* 14 */
        new Int32Array([34, -1, -1, -1, -1]),   /* 15 */
        new Int32Array([35, -1, -1, -1, -1]),   /* 16 */
        new Int32Array([-1, -1, -1, -1, -1]),   /* 17 */
        new Int32Array([36, -1, -1, -1, -1]),   /* 18 */
        new Int32Array([-1, -1, -1, -1, -1]),   /* 19 */
        new Int32Array([37, -1, -1, -1, -1]),   /* 20 */
        new Int32Array([-1, -1, -1, -1, -1]),   /* 21 */
        new Int32Array([-1, -1, -1, -1, -1]),   /* 22 */
        new Int32Array([-1, -1, -1, -1, -1]),   /* 23 */
        new Int32Array([38, -1, -1, -1, -1])    /* 24 */
    ];

    /* One way to hit */
	/* if true, all intermediate points (if any) are required;
		* if false, one of two intermediate points are required.
		* Set to true for a direct hit, but that can be checked with
		* nFaces == 1,
		*/

	/* Intermediate points required */
	/* Number of faces used in hit (1 to 4) */
	/* Number of pips used to hit */

	function inter(fAll, anIntermediate, nFaces, nPips) {
		return { fAll, anIntermediate: new Int32Array(anIntermediate), nFaces, nPips };
	}

    let pi;
    /* All ways to hit */
    const aIntermediate = [
        inter(1, [0, 0, 0], 1, 1),   /*  0: 1x hits 1 */
        inter(1, [0, 0, 0], 1, 2),   /*  1: 2x hits 2 */
        inter(1, [1, 0, 0], 2, 2),   /*  2: 11 hits 2 */
        inter(1, [0, 0, 0], 1, 3),   /*  3: 3x hits 3 */
        inter(0, [1, 2, 0], 2, 3),   /*  4: 21 hits 3 */
        inter(1, [1, 2, 0], 3, 3),   /*  5: 11 hits 3 */
        inter(1, [0, 0, 0], 1, 4),   /*  6: 4x hits 4 */
        inter(0, [1, 3, 0], 2, 4),   /*  7: 31 hits 4 */
        inter(1, [2, 0, 0], 2, 4),   /*  8: 22 hits 4 */
        inter(1, [1, 2, 3], 4, 4),   /*  9: 11 hits 4 */
        inter(1, [0, 0, 0], 1, 5),   /* 10: 5x hits 5 */
        inter(0, [1, 4, 0], 2, 5),   /* 11: 41 hits 5 */
        inter(0, [2, 3, 0], 2, 5),   /* 12: 32 hits 5 */
        inter(1, [0, 0, 0], 1, 6),   /* 13: 6x hits 6 */
        inter(0, [1, 5, 0], 2, 6),   /* 14: 51 hits 6 */
        inter(0, [2, 4, 0], 2, 6),   /* 15: 42 hits 6 */
        inter(1, [3, 0, 0], 2, 6),   /* 16: 33 hits 6 */
        inter(1, [2, 4, 0], 3, 6),   /* 17: 22 hits 6 */
        inter(0, [1, 6, 0], 2, 7),   /* 18: 61 hits 7 */
        inter(0, [2, 5, 0], 2, 7),   /* 19: 52 hits 7 */
        inter(0, [3, 4, 0], 2, 7),   /* 20: 43 hits 7 */
        inter(0, [2, 6, 0], 2, 8),   /* 21: 62 hits 8 */
        inter(0, [3, 5, 0], 2, 8),   /* 22: 53 hits 8 */
        inter(1, [4, 0, 0], 2, 8),   /* 23: 44 hits 8 */
        inter(1, [2, 4, 6], 4, 8),   /* 24: 22 hits 8 */
        inter(0, [3, 6, 0], 2, 9),   /* 25: 63 hits 9 */
        inter(0, [4, 5, 0], 2, 9),   /* 26: 54 hits 9 */
        inter(1, [3, 6, 0], 3, 9),   /* 27: 33 hits 9 */
        inter(0, [4, 6, 0], 2, 10),  /* 28: 64 hits 10 */
        inter(1, [5, 0, 0], 2, 10),  /* 29: 55 hits 10 */
        inter(0, [5, 6, 0], 2, 11),  /* 30: 65 hits 11 */
        inter(1, [6, 0, 0], 2, 12),  /* 31: 66 hits 12 */
        inter(1, [4, 8, 0], 3, 12),  /* 32: 44 hits 12 */
        inter(1, [3, 6, 9], 4, 12),  /* 33: 33 hits 12 */
        inter(1, [5, 10, 0], 3, 15), /* 34: 55 hits 15 */
        inter(1, [4, 8, 12], 4, 16), /* 35: 44 hits 16 */
        inter(1, [6, 12, 0], 3, 18), /* 36: 66 hits 18 */
        inter(1, [5, 10, 15], 4, 20),        /* 37: 55 hits 20 */
        inter(1, [6, 12, 18], 4, 24) /* 38: 66 hits 24 */
    ];

    /* aaRoll[n] - All ways to hit with the n'th roll
     * Each entry is an index into aIntermediate above.
     */

    const aaRoll = [
        new Int32Array([0, 2, 5, 9]),           /* 11 */
        new Int32Array([1, 8, 17, 24]),         /* 22 */
        new Int32Array([3, 16, 27, 33]),        /* 33 */
        new Int32Array([6, 23, 32, 35]),        /* 44 */
        new Int32Array([10, 29, 34, 37]),       /* 55 */
        new Int32Array([13, 31, 36, 38]),       /* 66 */
        new Int32Array([0, 1, 4, -1]),          /* 21 */
        new Int32Array([0, 3, 7, -1]),          /* 31 */
        new Int32Array([1, 3, 12, -1]),         /* 32 */
        new Int32Array([0, 6, 11, -1]),         /* 41 */
        new Int32Array([1, 6, 15, -1]),         /* 42 */
        new Int32Array([3, 6, 20, -1]),         /* 43 */
        new Int32Array([0, 10, 14, -1]),        /* 51 */
        new Int32Array([1, 10, 19, -1]),        /* 52 */
        new Int32Array([3, 10, 22, -1]),        /* 53 */
        new Int32Array([6, 10, 26, -1]),        /* 54 */
        new Int32Array([0, 13, 18, -1]),        /* 61 */
        new Int32Array([1, 13, 21, -1]),        /* 62 */
        new Int32Array([3, 13, 25, -1]),        /* 63 */
        new Int32Array([6, 13, 28, -1]),        /* 64 */
        new Int32Array([10, 13, 30, -1])        /* 65 */
	];

    /* One roll stat */

    

    {
        let n = 0;

        for (nOppBack = 24; nOppBack >= 0; --nOppBack) {
            if (anBoardOpp[nOppBack]) {
                break;
            }
        }

        nOppBack = 23 - nOppBack;

        for (i = nOppBack + 1; i < 25; i++)
            if (anBoard[i])
                n += (i + 1 - nOppBack) * anBoard[i];

        // g_assert(n);

        afInput[I_BREAK_CONTACT] = n / (15 + 152.0);
    }
    {
        let p = 0;

        for (i = 0; i < nOppBack; i++) {
            if (anBoard[i])
                p += (i + 1) * anBoard[i];
        }

        afInput[I_FREEPIP] = p / 100.0;
    }

    {
        let t = 0;
        let no = 0;

        let m = (nOppBack >= 11) ? nOppBack : 11;

        t += 24 * anBoard[24];
        no += anBoard[24];

        for (i = 23; i > m; --i) {
            if (anBoard[i] && anBoard[i] != 2) {
                let n = ((anBoard[i] > 2) ? (anBoard[i] - 2) : 1);
                no += n;
                t += i * n;
            }
        }

        for (; i >= 6; --i) {
            if (anBoard[i]) {
                let n = anBoard[i];
                no += n;
                t += i * n;
            }
        }

        for (i = 5; i >= 0; --i) {
            if (anBoard[i] > 2) {
                t += i * (anBoard[i] - 2);
                no += (anBoard[i] - 2);
            } else if (anBoard[i] < 2) {
                let n = (2 - anBoard[i]);

                if (no >= n) {
                    t -= i * n;
                    no -= n;
                }
            }
        }

        afInput[I_TIMING] = t / 100.0;
    }

    /* Back chequer */

    {
        let nBack;

        for (nBack = 24; nBack >= 0; --nBack) {
            if (anBoard[nBack]) {
                break;
            }
        }

        afInput[I_BACK_CHEQUER] = nBack / 24.0;

        /* Back anchor */

        for (i = ((nBack == 24) ? 23 : nBack); i >= 0; --i) {
            if (anBoard[i] >= 2) {
                break;
            }
        }

        afInput[I_BACK_ANCHOR] = i / 24.0;

        /* Forward anchor */

        n = 0;
        for (j = 18; j <= i; ++j) {
            if (anBoard[j] >= 2) {
                n = 24 - j;
                break;
            }
        }

        if (n == 0) {
            for (j = 17; j >= 12; --j) {
                if (anBoard[j] >= 2) {
                    n = 24 - j;
                    break;
                }
            }
        }

        afInput[I_FORWARD_ANCHOR] = n == 0 ? 2.0 : n / 6.0;
    }


    /* Piploss */

    nBoard = 0;
    for (i = 0; i < 6; i++)
        if (anBoard[i])
            nBoard++;

	aHit.fill(0);

    /* for every point we'd consider hitting a blot on, */

    for (i = (nBoard > 2) ? 23 : 21; i >= 0; i--)
        /* if there's a blot there, then */

        if (anBoardOpp[i] == 1)
            /* for every point beyond */

            for (j = 24 - i; j < 25; j++)
                /* if we have a hitter and are willing to hit */

                if (anBoard[j] && !(j < 6 && anBoard[j] == 2))
                    /* for every roll that can hit from that point */

                    for (n = 0; n < 5; n++) {
                        if (aanCombination[j - 24 + i][n] == -1)
                            break;

                        /* find the intermediate points required to play */

                        pi = aIntermediate[aanCombination[j - 24 + i][n]];

						let cannot_hit = false;

                        if (pi.fAll) {
                            /* if nFaces is 1, there are no intermediate points */

                            if (pi.nFaces > 1) {
                                /* all the intermediate points are required */

                                for (k = 0; k < 3 && pi.anIntermediate[k] > 0; k++)
                                    if (anBoardOpp[i - pi.anIntermediate[k]] > 1) {
                                        /* point is blocked; look for other hits */
                                        cannot_hit = true;
										break;
									}
                            }
                        } else {
                            /* either of two points are required */

                            if (anBoardOpp[i - pi.anIntermediate[0]] > 1 && anBoardOpp[i - pi.anIntermediate[1]] > 1) {
                                /* both are blocked; look for other hits */
                                cannot_hit = true;
                            }
                        }

                        /* enter this shot as available */

						if (!cannot_hit)
							aHit[aanCombination[j - 24 + i][n]] |= 1 << j;
       
                    }

	/* number of chequers this roll hits */
	/* count of pips this roll hits */

	const aRoll = new Array(21);
	for (i = 0; i < aRoll.length; ++i) 
		aRoll[i] = { nChequers: 0, nPips: 0 };

    // memset(aRoll, 0, sizeof(aRoll));

    if (!anBoard[24]) {
        /* we're not on the bar; for each roll, */

        for (i = 0; i < 21; i++) {
            n = -1;             /* (hitter used) */

            /* for each way that roll hits, */
            for (j = 0; j < 4; j++) {
                let r = aaRoll[i][j];

                if (r < 0)
                    break;

                if (!aHit[r])
                    continue;

                pi = aIntermediate[r];

                if (pi.nFaces == 1) {
                    /* direct shot */
                    k = msb32(aHit[r]);
                    /* select the most advanced blot; if we still have
                     * a chequer that can hit there */

                    if (n != k || anBoard[k] > 1)
                        aRoll[i].nChequers++;

                    n = k;

                    if (k - pi.nPips + 1 > aRoll[i].nPips)
                        aRoll[i].nPips = k - pi.nPips + 1;

                    /* if rolling doubles, check for multiple
                     * direct shots */

                    if (aaRoll[i][3] >= 0 && aHit[r] & ~(1 << k))
                        aRoll[i].nChequers++;

                } else {
                    /* indirect shot */
                    if (!aRoll[i].nChequers)
                        aRoll[i].nChequers = 1;

                    /* find the most advanced hitter */

                    k = msb32(aHit[r]);

                    if (k - pi.nPips + 1 > aRoll[i].nPips)
                        aRoll[i].nPips = k - pi.nPips + 1;

                    /* check for blots hit on intermediate points */

                    for (l = 0; l < 3 && pi.anIntermediate[l] > 0; l++)
                        if (anBoardOpp[23 - k + pi.anIntermediate[l]] == 1) {

                            aRoll[i].nChequers++;
                            break;
                        }
                }
            }
        }
    } else if (anBoard[24] == 1) {
        /* we have one on the bar; for each roll, */

        for (i = 0; i < 21; i++) {
            n = 0;              /* (free to use either die to enter) */

            for (j = 0; j < 4; j++) {
                let r = aaRoll[i][j];

                if (r < 0)
                    break;

                if (!aHit[r])
                    continue;

                pi = aIntermediate[r];

                if (pi.nFaces == 1) {
                    /* direct shot */

                    /* FIXME: There must be a more profitable way to use
                     * the possibility of finding the msb quickly,
                     * but I don't understand the code below. */
                    for (k = 24; k > 0; k--) {
                        if (aHit[r] & (1 << k)) {
                            /* if we need this die to enter, we can't hit elsewhere */

                            if (n && k != 24)
                                break;

                            /* if this isn't a shot from the bar, the
                             * other die must be used to enter */

                            if (k != 24) {
                                let npip = aIntermediate[aaRoll[i][1 - j]].nPips;

                                if (anBoardOpp[npip - 1] > 1)
                                    break;

                                n = 1;
                            }

                            aRoll[i].nChequers++;

                            if (k - pi.nPips + 1 > aRoll[i].nPips)
                                aRoll[i].nPips = k - pi.nPips + 1;
                        }
                    }
                } else {
                    /* indirect shot -- consider from the bar only */
                    if (!(aHit[r] & (1 << 24)))
                        continue;

                    if (!aRoll[i].nChequers)
                        aRoll[i].nChequers = 1;

                    if (25 - pi.nPips > aRoll[i].nPips)
                        aRoll[i].nPips = 25 - pi.nPips;

                    /* check for blots hit on intermediate points */
                    for (k = 0; k < 3 && pi.anIntermediate[k] > 0; k++)
                        if (anBoardOpp[pi.anIntermediate[k] + 1] == 1) {

                            aRoll[i].nChequers++;
                            break;
                        }
                }
            }
        }
    } else {
        /* we have more than one on the bar --
         * count only direct shots from point 24 */

        for (i = 0; i < 21; i++) {
            /* for the first two ways that hit from the bar */

            for (j = 0; j < 2; j++) {
                let r = aaRoll[i][j];

                if (!(aHit[r] & (1 << 24)))
                    continue;

                pi = aIntermediate + r;

                /* only consider direct shots */

                if (pi.nFaces != 1)
                    continue;

                aRoll[i].nChequers++;

                if (25 - pi.nPips > aRoll[i].nPips)
                    aRoll[i].nPips = 25 - pi.nPips;
            }
        }
    }

    {
        let np = 0
        	, n1 = 0
        	, n2 = 0
			, nc, ni
			;

        for (i = 0; i < 6; i++) {
            nc = aRoll[i].nChequers;

            np += aRoll[i].nPips;

            if (nc > 0) {
                n1 += 1;

                if (nc > 1) {
                    n2 += 1;
                }
            }
        }

        for (; i < 21; i++) {
            nc = aRoll[i].nChequers;

            np += aRoll[i].nPips * 2;

            if (nc > 0) {
                n1 += 2;

                if (nc > 1) {
                    n2 += 2;
                }
            }
        }

        afInput[I_PIPLOSS] = np / (12.0 * 36.0);

        afInput[I_P1] = n1 / 36.0;
        afInput[I_P2] = n2 / 36.0;
    }

    afInput[I_BACKESCAPES] = Escapes(anBoard, 23 - nOppBack) / 36.0;

    afInput[I_BACKRESCAPES] = Escapes1(anBoard, 23 - nOppBack) / 36.0;

    for (n = 36, i = 15; i < 24 - nOppBack; i++)
        if ((j = Escapes(anBoard, i)) < n)
            n = j;

    afInput[I_ACONTAIN] = (36 - n) / 36.0;
    afInput[I_ACONTAIN2] = afInput[I_ACONTAIN] * afInput[I_ACONTAIN];

    if (nOppBack < 0) {
        /* restart loop, point 24 should not be included */
        i = 15;
        n = 36;
    }

    for (; i < 24; i++)
        if ((j = Escapes(anBoard, i)) < n)
            n = j;


    afInput[I_CONTAIN] = (36 - n) / 36.0;
    afInput[I_CONTAIN2] = afInput[I_CONTAIN] * afInput[I_CONTAIN];

    for (n = 0, i = 6; i < 25; i++)
        if (anBoard[i])
            n += (i - 5) * anBoard[i] * Escapes(anBoardOpp, i);

    afInput[I_MOBILITY] = n / 3600.0;

    j = 0;
    n = 0;
    for (i = 0; i < 25; i++) {
        let ni = anBoard[i];

        if (ni) {
            j += ni;
            n += i * ni;
        }
    }

    if (j) {
        n = (n + j - 1) / j;
    }

    j = 0;
    for (k = 0, i = n + 1; i < 25; i++) {
        let ni = anBoard[i];

        if (ni) {
            j += ni;
            k += ni * (i - n) * (i - n);
        }
    }

    if (j) {
        k = (k + j - 1) / j;
    }

    afInput[I_MOMENT2] = k / 400.0;

    if (anBoard[24] > 0) {
        let loss = 0;
        let two = anBoard[24] > 1;

        for (i = 0; i < 6; ++i) {
            if (anBoardOpp[i] > 1) {
                /* any double loses */

                loss += 4 * (i + 1);

                for (j = i + 1; j < 6; ++j) {
                    if (anBoardOpp[j] > 1) {
                        loss += 2 * (i + j + 2);
                    } else {
                        if (two) {
                            loss += 2 * (i + 1);
                        }
                    }
                }
            } else {
                if (two) {
                    for (j = i + 1; j < 6; ++j) {
                        if (anBoardOpp[j] > 1) {
                            loss += 2 * (j + 1);
                        }
                    }
                }
            }
        }

        afInput[I_ENTER] = loss / (36.0 * (49.0 / 6.0));
    } else {
        afInput[I_ENTER] = 0.0;
    }

    n = 0;
    for (i = 0; i < 6; i++) {
        n += anBoardOpp[i] > 1;
    }

    afInput[I_ENTER2] = (36 - (n - 6) * (n - 6)) / 36.0;

    {
        let pa = -1
        	, w = 0
        	, tot = 0
        	, np;

        for (np = 23; np > 0; --np) {
            if (anBoard[np] >= 2) {
                if (pa == -1) {
                    pa = np;
                    continue;
                }

                {
                    let d = pa - np;

                    const ac = new Int32Array([ 11, 11, 11, 11, 11, 11, 11,
                        6, 5, 4, 3, 2,
                        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
					]);

                    w += ac[d] * anBoard[pa];
                    tot += anBoard[pa];
                }
            }
        }

        if (tot) {
            afInput[I_BACKBONE] = 1 - (w / (tot * 11.0));
        } else {
            afInput[I_BACKBONE] = 0;
        }
    }

    {
        let nAc = 0;

        for (i = 18; i < 24; ++i) {
            if (anBoard[i] > 1) {
                ++nAc;
            }
        }

        afInput[I_BACKG] = 0.0;
        afInput[I_BACKG1] = 0.0;

        if (nAc >= 1) {
            let tot = 0;
            for (i = 18; i < 25; ++i) {
                tot += anBoard[i];
            }

            if (nAc > 1) {
                /* g_assert( tot >= 4 ); */

                afInput[I_BACKG] = (tot - 3) / 4.0;
            } else if (nAc == 1) {
                afInput[I_BACKG1] = tot / 8.0;
            }
        }
    }
}

function CalculateRaceInputs(anBoard, inputs) {
    let side;

    for (side = 0; side < 2; ++side) {
        let i, k;

        let board = anBoard[side];
        let afInput = inputs.subarray(side * HALF_RACE_INPUTS);

        let menOff = 15;

        {
            // g_assert(board[23] == 0 && board[24] == 0);
        }

        /* Points */
        for (i = 0; i < 23; ++i) {
            const nc = board[i];

            k = i * 4;

            menOff -= nc;

            afInput[k++] = (nc == 1) ? 1.0 : 0.0;
            afInput[k++] = (nc == 2) ? 1.0 : 0.0;
            afInput[k++] = (nc >= 3) ? 1.0 : 0.0;
            afInput[k] = nc > 3 ? (nc - 3) / 2.0 : 0.0;
        }

        /* Men off */
        for (k = 0; k < 14; ++k) {
            afInput[RI_OFF + k] = (menOff == (k + 1)) ? 1.0 : 0.0;
        }

        {
            let nCross = 0;

            for (k = 1; k < 4; ++k) {
                for (i = 6 * k; i < 6 * k + 6; ++i) {
                    const nc = board[i];

                    if (nc) {
                        nCross += nc * k;
                    }
                }
            }

            afInput[RI_NCROSS] = nCross / 10.0;
        }
    }
}

/* baseInputs() is now in lib/inputs.c */

function menOffAll(anBoard, afInput) {
    /* Men off */
    let menOff = 15
		, i;

    for (i = 0; i < 25; i++) {
        menOff -= anBoard[i];
    }

    if (menOff <= 5) {
        afInput[0] = menOff ? menOff / 5.0 : 0.0;
        afInput[1] = 0.0;
        afInput[2] = 0.0;
    } else if (menOff <= 10) {
        afInput[0] = 1.0;
        afInput[1] = (menOff - 5) / 5.0;
        afInput[2] = 0.0;
    } else {
        afInput[0] = 1.0;
        afInput[1] = 1.0;
        afInput[2] = (menOff - 10) / 5.0;
    }
}

function menOffNonCrashed(anBoard, afInput) {
    let menOff = 15
    	, i;

    for (i = 0; i < 25; ++i) {
        menOff -= anBoard[i];
    }
    {
        // g_assert(menOff <= 8);
    }

    if (menOff <= 2) {
        afInput[0] = menOff ? menOff / 3.0 : 0.0;
        afInput[1] = 0.0;
        afInput[2] = 0.0;
    } else if (menOff <= 5) {
        afInput[0] = 1.0;
        afInput[1] = (menOff - 3) / 3.0;
        afInput[2] = 0.0;
    } else {
        afInput[0] = 1.0;
        afInput[1] = 1.0;
        afInput[2] = (menOff - 6) / 3.0;
    }

}

/* Calculates contact neural net inputs from the board position. */

function CalculateContactInputs(anBoard, arInput)
{
    baseInputs(anBoard, arInput);

    {
        let b = arInput.subarray(MINPPERPOINT * 25 * 2);

        /* I accidentally switched sides (0 and 1) when I trained the net */
        menOffNonCrashed(anBoard[0], b.subarray(I_OFF1));

        CalculateHalfInputs(anBoard[1], anBoard[0], b);
    }

    {
        let b = arInput.subarray((MINPPERPOINT * 25 * 2 + MORE_INPUTS));

        menOffNonCrashed(anBoard[1], b.subarray(I_OFF1));

        CalculateHalfInputs(anBoard[0], anBoard[1], b);
    }
}

/* Calculates crashed neural net inputs from the board position. */

function CalculateCrashedInputs(anBoard, arInput)
{
    baseInputs(anBoard, arInput);

    {
        let b = arInput.subarray(MINPPERPOINT * 25 * 2);

        menOffAll(anBoard[1], b.subarray(I_OFF1));

        CalculateHalfInputs(anBoard[1], anBoard[0], b);
    }

    {
        let b = arInput.subarray((MINPPERPOINT * 25 * 2 + MORE_INPUTS));

        menOffAll(anBoard[0], b.subarray(I_OFF1));

        CalculateHalfInputs(anBoard[0], anBoard[1], b);
    }
}

export function FindnSaveBestMoves(ml, nDice0, nDice1, anBoard, keyMove, rThr, ci, ec, aamf) {

	let i, nMoves, m, mFilters, nMaxPly = 0, cOldMoves, finished = false;

	/* Find all moves -- note that pml contains internal pointers to static
     * data, so we can't call GenerateMoves again (or anything that calls
     * it, such as ScoreMoves at more than 0 plies) until we have saved
     * the moves we want to keep in amCandidates. */
	GenerateMoves(ml, anBoard, nDice0, nDice1, false);

	if (ml.cMoves == 0) {
        /* no legal moves */
        ml.amMoves = null;
        return 0;
    }

	nMoves = ml.cMoves;

	mFilters = (ec.nPlies > 0 && ec.nPlies <= MAX_FILTER_PLIES) ?
        aamf[ec.nPlies - 1] : aamf[MAX_FILTER_PLIES - 1];

	const NullFilter = { Accept: 0, Extra: 0, Threshold: 0 };

	for (let iPly = 0; iPly < ec.nPlies; iPly++) {

		const mFilter = (iPly < MAX_FILTER_PLIES) ? mFilters[iPly] : NullFilter;

		let k;

		if (mFilter.Accept < 0) {
			continue;
		}

		if (ScoreMoves(ml, ci, ec, iPly) < 0) {
			ml.cMoves = 0;
			ml.amMoves = null;
			return -1;
		}

		ml.amMoves.sort(CompareMoves);
		ml.iMoveBest = 0;

		k = ml.cMoves;
		/* we check for mFilter->Accept < 0 above */
		ml.cMoves = Math.min(mFilter.Accept, ml.cMoves);

		{
			let limit = Math.min(k, ml.cMoves + mFilter.Extra);

			for ( /**/; ml.cMoves < limit; ++ml.cMoves) {
				if (ml.amMoves[ml.cMoves].rScore < ml.amMoves[0].rScore - mFilter.Threshold) {
					break;
				}
			}
		}

		nMaxPly = iPly;

		if (ml.cMoves == 1 && mFilter.Accept != 1) {
			/* if there is only one move to evaluate there is no need to continue */
			finished = true;
			break;
		}


	}

	/* evaluate moves on top ply */

	if (!finished) {


		if (ScoreMoves(ml, ci, ec, ec.nPlies) < 0) {
			ml.cMoves = 0;
			ml.amMoves = null;
			return -1;
		}

		nMaxPly = ec.nPlies;

		/* Resort the moves, in case the new evaluation reordered them. */
		// todo: sort to cMoves
		ml.amMoves.sort(CompareMoves);
		ml.iMoveBest = 0;

	}

	/* set the proper size of the movelist */

//finished:

	cOldMoves = ml.cMoves;
	ml.cMoves = nMoves;

	/* Make sure that keyMove and top move are both  
		* evaluated at the deepest ply. */
	if (keyMove) {

		let fResort = false;

		for (i = 0; i < ml.cMoves; i++)
			if (EqualKeys(keyMove, ml.amMoves[i].key)) {

				/* ensure top move is evaluted at deepest ply */

				if (ml.amMoves[i].esMove.ec.nPlies < nMaxPly) {
					ScoreMove(null, ml.amMoves[i], ci, ec, nMaxPly);
					fResort = true;
				}

				if ((Math.abs(ml.amMoves[i].rScore - ml.amMoves[0].rScore) > rThr) && (nMaxPly < ec.nPlies)) {

					/* this is en error/blunder: re-analyse at top-ply */

					ScoreMove(null, ml.amMoves[0], ci, ec, ec.nPlies);
					ScoreMove(null, ml.amMoves[i], ci, ec, ec.nPlies);
					cOldMoves = 1;      /* only one move scored at deepest ply */
					fResort = true;

				}

				/* move it up to the other moves evaluated on nMaxPly */

				if (fResort && ec.nPlies) {
					let m, j;

					m = ml.amMoves[i];

					for (j = i - 1; j >= cOldMoves; --j)
						ml.amMoves[j + 1] = ml.amMoves[j];

					ml.amMoves[cOldMoves] = m;


					/* reorder moves evaluated on nMaxPly */
					ml.amMoves.sort(CompareMoves);

				}
				break;
			}
	}

	return 0
}

function FindBestMoveInEval(nnStates, nDice0, nDice1, anBoardIn,
	anBoardOut, ci, ec) {

	let i
		, ml = initMoveList()
		, evalClass = PositionClass.CLASS_OVER
		, bmovesi = new Uint32Array(MAX_PRUNE_MOVES)
		, prune_moves;
	// movelist ml;
	// positionclass evalClass = PositionClass.CLASS_OVER;
	// unsigned int bmovesi[MAX_PRUNE_MOVES];
	// unsigned int prune_moves;

	GenerateMoves(ml, anBoardIn, nDice0, nDice1, false);

	// console.debug('Find best move in eval', ml.cMoves);

	if (ml.cMoves == 0) {
		/* no legal moves */
		return;
	}

	if (ml.cMoves == 1) {
		/* forced move */
		ml.iMoveBest = 0;
		PositionFromKey(anBoardOut, ml.amMoves[ml.iMoveBest].key);
		return;
	}

	/* LogCube() is floor(log2()) */
	prune_moves = MIN_PRUNE_MOVES + LogCube(ml.cMoves);

	if (ml.cMoves <= prune_moves) {
		ScoreMoves(ml, ci, ec, 0);
		PositionFromKey(anBoardOut, ml.amMoves[ml.iMoveBest].key);
		return;
	}

	ci.fMove = 1 - ci.fMove;

	const arInput = new Float32Array(NUM_PRUNING_INPUTS)
		, arOutput = new Float32Array(NUM_OUTPUTS)
		;

	for (i = 0; i < ml.cMoves; i++) {
		let pc, ec = newCacheNode(), l;
		
		/* declared volatile to avoid wrong compiler optimization
		* on some gcc systems. Remove with great care. */
		let m = ml.amMoves[i];

		PositionFromKeySwapped(anBoardOut, m.key);

		pc = ClassifyPosition(anBoardOut, VARIATION_STANDARD);
		if (i == 0) {
			if (pc < PositionClass.CLASS_RACE)
				break;
			evalClass = pc;
		} else if (pc != evalClass)
			break;

		CopyKey(m.key, ec.key);
		ec.nEvalContext = 0;
		if ((l = CacheLookup(cpEval, ec, arOutput, null)) != CACHEHIT) {
			baseInputs(anBoardOut, arInput);
			{
				const nets = [ nnpRace, nnpCrashed, nnpContact ];
				const n = nets[pc - PositionClass.CLASS_RACE];
				if (nnStates)
					nnStates[pc - PositionClass.CLASS_RACE].state = (i == 0) ? NNSTATE_INCREMENTAL : NNSTATE_DONE;
				NeuralNetEvaluate(n, arInput, arOutput, nnStates);
				if (pc == PositionClass.CLASS_RACE)
					/* special evaluation of backgammons
					* overrides net output */
					EvalRaceBG(anBoardOut, arOutput, VARIATION_STANDARD);

				SanityCheck(anBoardOut, arOutput);
			}
			ec.ar.set(arOutput);
			ec.ar[5] = 0;
			CacheAdd(cpEval, ec, l);
		}
		m.rScore = UtilityME(arOutput, ci);
		if (i < prune_moves) {
			bmovesi[i] = i;
			if (m.rScore > ml.amMoves[bmovesi[0]].rScore) {
				bmovesi[i] = bmovesi[0];
				bmovesi[0] = i;
			}
		} else if (m.rScore < ml.amMoves[bmovesi[0]].rScore) {
			let m = 0, k;
			bmovesi[0] = i;
			for (k = 1; k < prune_moves; ++k) {
				if (ml.amMoves[bmovesi[k]].rScore > ml.amMoves[bmovesi[m]].rScore) {
					m = k;
				}
			}
			bmovesi[0] = bmovesi[m];
			bmovesi[m] = i;
		}
	}

	ci.fMove = 1 - ci.fMove;

	if (i == ml.cMoves)
		ScoreMovesPruned(ml, ci, ec, bmovesi, prune_moves);
	else
		ScoreMoves(ml, ci, ec, 0);

	PositionFromKey(anBoardOut, ml.amMoves[ml.iMoveBest].key);
}

function FindBestMovePlied(anMove, nDice0, nDice1,
	anBoard,
	ci, ectx, nPlies,
	aamf) {

	// todo: bitields ?
	const ec = Object.clone(ectx);
	const ml = {
		cMoves: 0, cMaxMoves: 0, cMaxPips: 0,
		iMoveBest: 0, rBestScore: 0,
		amMoves: null
	};
	let i;

	ec.nPlies = nPlies;

	if (anMove)
		for (i = 0; i < 8; ++i)
			anMove[i] = -1;

	if (FindnSaveBestMoves(ml, nDice0, nDice1, anBoard, null, 0.0, ci, ec, aamf) < 0) {
		return -1;
	}

	if (anMove) {
		for (i = 0; i < ml.cMaxMoves * 2; i++)
			anMove[i] = ml.amMoves[ml.iMoveBest].anMove[i];
	}

	if (ml.cMoves)
		PositionFromKey(anBoard, ml.amMoves[ml.iMoveBest].key);

	return ml.cMaxMoves * 2;
}

function EvaluatePosition(nnStates, anBoard, arOutput, ci, ec) {

	const pc = ClassifyPosition(anBoard, ci.bgv);

	return EvaluatePositionCache(nnStates, anBoard, arOutput, ci, ec ? ec : ecBasic, ec ? ec.nPlies : 0, pc);
}

function ScoreMove(nnStates, m, cinfo, ec, nPlies) {

	var anBoardTemp =  initBoard()
		, arEval = new Float32Array(7)
		, ci = Object.clone(cinfo);
		;

    PositionFromKeySwapped(anBoardTemp, m.key);

    /* swap fMove in cubeinfo */
    ci.fMove = 1 - ci.fMove;

    if (GeneralEvaluationEPlied(nnStates, arEval, anBoardTemp, ci, ec, nPlies))
        return -1;

	// console.debug('Generated output:', nPlies, Array.from(arEval));

    InvertEvaluationR(arEval, ci);

    if (ci.nMatchTo)
        arEval[OUTPUT_CUBEFUL_EQUITY] = mwc2eq(arEval[OUTPUT_CUBEFUL_EQUITY], ci);

    /* Save evaluations */
	m.arEvalMove = arEval;
    //memcpy(pm->arEvalMove, arEval, NUM_ROLLOUT_OUTPUTS * sizeof(float));

    /* Save evaluation setup */
    m.esMove.et = EvalType.EVAL_EVAL;
    m.esMove.ec = Object.clone(ec);
    m.esMove.ec.nPlies = nPlies;

    /* Score for move:
     * rScore is the primary score (cubeful/cubeless)
     * rScore2 is the secondary score (cubeless) */
    m.rScore = (ec.fCubeful) ? arEval[OUTPUT_CUBEFUL_EQUITY] : arEval[OUTPUT_EQUITY];
    m.rScore2 = arEval[OUTPUT_EQUITY];

    return 0;
}

function GeneralEvaluationEPlied(nnStates, arOutput, anBoard, ci, ec, nPlies) {

	if (ec.fCubeful) {

		if (GeneralEvaluationEPliedCubeful(nnStates, arOutput, anBoard, ci, ec, nPlies))
			return -1;

	} else {
		if (EvaluatePositionCache(nnStates, anBoard, arOutput, ci, ec, nPlies, ClassifyPosition(anBoard, ci.bgv)))
			return -1;

		arOutput[OUTPUT_EQUITY] = UtilityME(arOutput, ci);
		arOutput[OUTPUT_CUBEFUL_EQUITY] = 0.0;

	}

	return 0;

}

function SwapSides(anBoard) {

    let i, n;

    for (i = 0; i < 25; i++) {
        n = anBoard[0][i];
        anBoard[0][i] = anBoard[1][i];
        anBoard[1][i] = n;
    }
}

function MaxTurns(id) {
    let aus = [];
    let i;

    BearoffDist(bc1, id, null, null, null, aus, null);

    for (i = 31; i >= 0; i--) {
        if (aus[i])
            return i;
    }

    return -1;
}

function SanityCheck(anBoard, arOutput) {
    var i, j, nciq, ac = [0,0], anBack = [0,0], anCross = [0,0], anGammonCross = [1,1], anMaxTurns = [0,0], fContact;

    // g_assert(arOutput[OUTPUT_WIN] >= 0.0f && arOutput[OUTPUT_WIN] <= 1.0f);
    // g_assert(arOutput[OUTPUT_WINGAMMON] >= 0.0f && arOutput[OUTPUT_WINGAMMON] <= 1.0f);
    // g_assert(arOutput[OUTPUT_WINBACKGAMMON] >= 0.0f && arOutput[OUTPUT_WINBACKGAMMON] <= 1.0f);
    // g_assert(arOutput[OUTPUT_LOSEGAMMON] >= 0.0f && arOutput[OUTPUT_LOSEGAMMON] <= 1.0f);
    // g_assert(arOutput[OUTPUT_LOSEBACKGAMMON] >= 0.0f && arOutput[OUTPUT_LOSEBACKGAMMON] <= 1.0f);

    for (j = 0; j < 2; j++) {
        for (i = 0, nciq = 0; i < 6; i++)
            if (anBoard[j][i]) {
                anBack[j] = i;
                nciq += anBoard[j][i];
            }
        ac[j] = anCross[j] = nciq;

        for (i = 6, nciq = 0; i < 12; i++)
            if (anBoard[j][i]) {
                anBack[j] = i;
                nciq += anBoard[j][i];
            }
        ac[j] += nciq;
        anCross[j] += 2 * nciq;
        anGammonCross[j] += nciq;

        for (i = 12, nciq = 0; i < 18; i++)
            if (anBoard[j][i]) {
                anBack[j] = i;
                nciq += anBoard[j][i];
            }
        ac[j] += nciq;
        anCross[j] += 3 * nciq;
        anGammonCross[j] += 2 * nciq;

        for (i = 18, nciq = 0; i < 24; i++)
            if (anBoard[j][i]) {
                anBack[j] = i;
                nciq += anBoard[j][i];
            }
        ac[j] += nciq;
        anCross[j] += 4 * nciq;
        anGammonCross[j] += 3 * nciq;

        if (anBoard[j][24]) {
            anBack[j] = 24;
            ac[j] += anBoard[j][24];
            anCross[j] += 5 * anBoard[j][24];
            anGammonCross[j] += 4 * anBoard[j][24];
        }
    }

    fContact = anBack[0] + anBack[1] >= 24;

    if (!fContact) {
        for (i = 0; i < 2; i++)
            if (anBack[i] < 6 && bc1)
                anMaxTurns[i] = MaxTurns(PositionBearoff(anBoard[i], bc1.nPoints, bc1.nChequers));
            else
                anMaxTurns[i] = anCross[i] * 2;

        if (!anMaxTurns[1])
            anMaxTurns[1] = 1;

    }

    if (!fContact && anCross[0] > 4 * (anMaxTurns[1] - 1))
        /* Certain win */
        arOutput[OUTPUT_WIN] = 1.0;

    if (ac[0] < 15)
        /* Opponent has borne off; no gammons or backgammons possible */
        arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_WINBACKGAMMON] = 0.0;
    else if (!fContact) {
        if (anCross[1] > 8 * anGammonCross[0])
            /* Gammon impossible */
            arOutput[OUTPUT_WINGAMMON] = 0.0;
        else if (anGammonCross[0] > 4 * (anMaxTurns[1] - 1))
            /* Certain gammon */
            arOutput[OUTPUT_WINGAMMON] = 1.0;
        if (anBack[0] < 18)
            /* Backgammon impossible */
            arOutput[OUTPUT_WINBACKGAMMON] = 0.0;
    }

    if (!fContact && anCross[1] > 4 * anMaxTurns[0])
        /* Certain loss */
        arOutput[OUTPUT_WIN] = 0.0;

    if (ac[1] < 15)
        /* Player has borne off; no gammon or backgammon losses possible */
        arOutput[OUTPUT_LOSEGAMMON] = arOutput[OUTPUT_LOSEBACKGAMMON] = 0.0;
    else if (!fContact) {
        if (anCross[0] > 8 * anGammonCross[1] - 4)
            /* Gammon loss impossible */
            arOutput[OUTPUT_LOSEGAMMON] = 0.0;
        else if (anGammonCross[1] > 4 * anMaxTurns[0])
            /* Certain gammon loss */
            arOutput[OUTPUT_LOSEGAMMON] = 1.0;
        if (anBack[1] < 18)
            /* Backgammon impossible */
            arOutput[OUTPUT_LOSEBACKGAMMON] = 0.0;
    }

    /* gammons must be less than wins */
    if (arOutput[OUTPUT_WINGAMMON] > arOutput[OUTPUT_WIN]) {
        arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_WIN];
    }

    {
        let lose = 1.0 - arOutput[OUTPUT_WIN];
        if (arOutput[OUTPUT_LOSEGAMMON] > lose) {
            arOutput[OUTPUT_LOSEGAMMON] = lose;
        }
    }

    /* Backgammons cannot exceed gammons */
    if (arOutput[OUTPUT_WINBACKGAMMON] > arOutput[OUTPUT_WINGAMMON])
        arOutput[OUTPUT_WINBACKGAMMON] = arOutput[OUTPUT_WINGAMMON];

    if (arOutput[OUTPUT_LOSEBACKGAMMON] > arOutput[OUTPUT_LOSEGAMMON])
        arOutput[OUTPUT_LOSEBACKGAMMON] = arOutput[OUTPUT_LOSEGAMMON];

    if (fContact) {
        let noise = 1 / 10000.0;

        for (i = OUTPUT_WINGAMMON; i < NUM_OUTPUTS; ++i) {
            if (arOutput[i] < noise) {
                arOutput[i] = 0.0;
            }
        }
    }

}

function ClassifyPosition(anBoard, bgv) {
    let nOppBack = -1, nBack = -1;

    for (nOppBack = 24; nOppBack >= 0; --nOppBack) {
        if (anBoard[0][nOppBack]) {
            break;
        }
    }

    for (nBack = 24; nBack >= 0; --nBack) {
        if (anBoard[1][nBack]) {
            break;
        }
    }

    if (nBack < 0 || nOppBack < 0)
        return PositionClass.CLASS_OVER;

    /* special classes for hypergammon variants */

    switch (bgv) {
		case VARIATION_HYPERGAMMON_1:
		return PositionClass.CLASS_HYPERGAMMON1;

		case VARIATION_HYPERGAMMON_2:
		return PositionClass.CLASS_HYPERGAMMON2;

		case VARIATION_HYPERGAMMON_3:
		return PositionClass.CLASS_HYPERGAMMON3;

		case VARIATION_STANDARD:
		case VARIATION_NACKGAMMON:

			/* normal backgammon */

		if (nBack + nOppBack > 22) {

			/* contact position */

			const N = 6;

			for (let side = 0; side < 2; ++side) {
				let tot = 0;

				const board = anBoard[side];

				for (let i = 0; i < 25; ++i) {
					tot += board[i];
				}

				if (tot <= N) {
					return PositionClass.CLASS_CRASHED;
				} else {
					if (board[0] > 1) {
						if (tot <= (N + board[0])) {
							return PositionClass.CLASS_CRASHED;
						} else {
							if ((1 + tot - (board[0] + board[1]) <= N) && board[1] > 1) {
								return PositionClass.CLASS_CRASHED;
							}
						}
					} else {
						if (tot <= (N + (board[1] - 1))) {
							return PositionClass.CLASS_CRASHED;
						}
					}
				}
			}

			return PositionClass.CLASS_CONTACT;
		} else {

			// todo
			// if (isBearoff(pbc2, anBoard))
			// 	return PositionClass.CLASS_BEAROFF2;

			// if (isBearoff(pbcTS, anBoard))
			// 	return PositionClass.CLASS_BEAROFF_TS;

			// if (isBearoff(pbc1, anBoard))
			// 	return PositionClass.CLASS_BEAROFF1;

			// if (isBearoff(pbcOS, anBoard))
			// 	return PositionClass.CLASS_BEAROFF_OS;

			return PositionClass.CLASS_RACE;

		}

    }

    return PositionClass.CLASS_OVER;          /* for fussy compilers */
}



function GeneralEvaluationEPliedCubeful(nnStates, arOutput, anBoard, ci, ec, nPlies) {

	let arCubeful = [0.0];
	let arCi = [ci];

	if (EvaluatePositionCubeful3(nnStates, anBoard, arOutput, arCubeful, arCi, 1, ci, ec, nPlies, false))
		return -1;

	arOutput[OUTPUT_EQUITY] = UtilityME(arOutput, ci);
	arOutput[OUTPUT_CUBEFUL_EQUITY] = arCubeful[0];

	return 0;

}

function EvaluatePositionCubeful4(nnStates, anBoard,
                         arOutput,
                         arCubeful,
                         aciCubePos, cci,
                         ciMove, ec, nPlies, fTop)
{


    /* calculate cubeful equity */

    let i, ici, pc, r
		, ar = new Float32Array(NUM_OUTPUTS).fill(0)
		, arEquity = new Float32Array(4).fill(0)
		, rCubeX
		;
 

    const ciMoveOpp = initCubeInfo();

    // float *arCf = (float *) g_alloca(2 * cci * sizeof(float));
    // float *arCfTemp = (float *) g_alloca(2 * cci * sizeof(float));
    // cubeinfo *aci = (cubeinfo *) g_alloca(2 * cci * sizeof(cubeinfo));
	let arCf = new Float32Array(2*cci)
		, arCfTemp = new Float32Array(2*cci)
		, aci = newArray(2*cci, initCubeInfo)
		;

    let w, n0, n1;

    pc = ClassifyPosition(anBoard, ciMove.bgv);

	// console.debug('NPlies:', nPlies);

    if (pc > PositionClass.CLASS_OVER && nPlies > 0 && !(pc <= CLASS_PERFECT && !ciMove.nMatchTo)) {
        /* internal node; recurse */

        const anBoardNew =  initBoard();
        const usePrune = ec.fUsePrune && ec.rNoise == 0.0 && ciMove.bgv == VARIATION_STANDARD;

        for (i = 0; i < NUM_OUTPUTS; i++)
            arOutput[i] = 0.0;

        for (i = 0; i < 2 * cci; i++)
            arCf[i] = 0.0;

        /* construct next level cube positions */

        MakeCubePos(aciCubePos, cci, fTop, aci, true);

        /* loop over rolls */

        for (n0 = 1; n0 <= 6; n0++) {
            for (n1 = 1; n1 <= n0; n1++) {
                w = (n0 == n1) ? 1 : 2;

                for (i = 0; i < 25; i++) {
                    anBoardNew[0][i] = anBoard[0][i];
                    anBoardNew[1][i] = anBoard[1][i];
                }

                if (usePrune) {
                    FindBestMoveInEval(nnStates, n0, n1, anBoard, anBoardNew, ciMove, ec);
                } else {

                    FindBestMovePlied(null, n0, n1, anBoardNew, ciMove, ec, 0, defaultFilters);
                }

                SwapSides(anBoardNew);

                SetCubeInfo(ciMoveOpp,
                            ciMove.nCube, ciMove.fCubeOwner,
                            1 - ciMove.fMove, ciMove.nMatchTo,
                            ciMove.anScore, ciMove.fCrawford, ciMove.fJacoby, ciMove.fBeavers, ciMove.bgv);

                /* Evaluate at 0-ply */
                if (EvaluatePositionCubeful3(nnStates, anBoardNew,
                                             ar, arCfTemp, aci, 2 * cci, ciMoveOpp, ec, nPlies - 1, false))
                    return -1;

                /* Sum up cubeless winning chances and cubeful equities */

                for (i = 0; i < NUM_OUTPUTS; i++)
                    arOutput[i] += w * ar[i];
                for (i = 0; i < 2 * cci; i++)
                    arCf[i] += w * arCfTemp[i];

            }

        }

        /* Flip evals */
		const sumW = 36;

        arOutput[OUTPUT_WIN] = 1.0 - arOutput[OUTPUT_WIN] / sumW;

        r = arOutput[OUTPUT_WINGAMMON] / sumW;
        arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_LOSEGAMMON] / sumW;
        arOutput[OUTPUT_LOSEGAMMON] = r;

        r = arOutput[OUTPUT_WINBACKGAMMON] / sumW;
        arOutput[OUTPUT_WINBACKGAMMON] = arOutput[OUTPUT_LOSEBACKGAMMON] / sumW;
        arOutput[OUTPUT_LOSEBACKGAMMON] = r;

        for (i = 0; i < 2 * cci; i++)
            if (ciMove.nMatchTo)
                arCf[i] = 1.0 - arCf[i] / sumW;
            else
                arCf[i] = -arCf[i] / sumW;

        /* invert fMove */
        /* Remember than fMove was inverted in the call to MakeCubePos */

        for (i = 0; i < 2 * cci; i++)
            aci[i].fMove = 1 - aci[i].fMove;

        /* get cubeful equities */

        GetECF3(arCubeful, cci, arCf, aci);

    } else {
        /* at leaf node; use static evaluation */

        if (pc == PositionClass.CLASS_HYPERGAMMON1 || pc == PositionClass.CLASS_HYPERGAMMON2 || pc == PositionClass.CLASS_HYPERGAMMON3) {

            // bearoffcontext *pbc = apbcHyper[pc - PositionClass.CLASS_HYPERGAMMON1];
            // let nUs, nThem, iPos, n;

            // if (!bc)
            //     return -1;

            // nUs = PositionBearoff(anBoard[1], bc.nPoints, bc.nChequers);
            // nThem = PositionBearoff(anBoard[0], bc.nPoints, bc.nChequers);
            // n = Combination(bc.nPoints + bc.nChequers, bc.nPoints);
            // iPos = nUs * n + nThem;

            // if (BearoffHyper(apbcHyper[pc - PositionClass.CLASS_HYPERGAMMON1], iPos, arOutput, arEquity))
            //     return -1;

        } else if (pc > PositionClass.CLASS_OVER && pc <= CLASS_PERFECT /* && ! pciMove->nMatchTo */ ) {

            if (EvaluatePerfectCubeful(anBoard, arEquity, ciMove.bgv)) {
                return -1;
            }

            arOutput[OUTPUT_WIN] = (arEquity[0] + 1.0) / 2.0;
            arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_WINBACKGAMMON] = arOutput[OUTPUT_LOSEGAMMON] =
                arOutput[OUTPUT_LOSEBACKGAMMON] = 0.0;

        } else {

            /* evaluate with neural net */

            if (EvaluatePosition(nnStates, anBoard, arOutput, ciMove, null))
                return -1;

            if (ec.rNoise > 0.0 && pc != PositionClass.CLASS_OVER) {
                for (i = 0; i < NUM_OUTPUTS; i++) {
                    arOutput[i] += Noise(pec, anBoard, i);
                    arOutput[i] = Math.max(arOutput[i], 0.0);
                    arOutput[i] = Math,min(arOutput[i], 1.0);
                }
            }

            if (pc > CLASS_GOOD || ec.rNoise > 0.0)
                /* no sanity check needed for accurate evaluations */
                SanityCheck(anBoard, arOutput);

        }

        /* Calculate cube efficiency */

        rCubeX = EvalEfficiency(anBoard, pc);

        /* Build all possible cube positions */

        MakeCubePos(aciCubePos, cci, fTop, aci, false);

        /* Calculate cubeful equity for each possible cube position */

        for (ici = 0; ici < 2 * cci; ici++)
            if (aci[ici].nCube > 0) {
                /* cube available */

                if (!aci[ici].nMatchTo) {

                    /* money play */

                    switch (pc) {
                    case PositionClass.CLASS_HYPERGAMMON1:
                    case PositionClass.CLASS_HYPERGAMMON2:
                    case PositionClass.CLASS_HYPERGAMMON3:
                        /* exact bearoff equities & contact */

                        arCf[ici] = CFHYPER(arEquity, aci[ici]);
                        break;

                    case PositionClass.CLASS_BEAROFF2:
                    case PositionClass.CLASS_BEAROFF_TS:
                        /* exact bearoff equities */

                        arCf[ici] = CFMONEY(arEquity, aci[ici]);
                        break;

                    case PositionClass.CLASS_OVER:
                    case PositionClass.CLASS_RACE:
                    case PositionClass.CLASS_CRASHED:
                    case PositionClass.CLASS_CONTACT:
                    case PositionClass.CLASS_BEAROFF1:
                    case PositionClass.CLASS_BEAROFF_OS:
                        /* approximate using Janowski's formulae */

                        arCf[ici] = Cl2CfMoney(arOutput, aci[ici], rCubeX);
                        break;

                    }

                } else {

                    let rCl, rCf, rCfMoney;
                    let X = rCubeX;
                    //const ciMoney = initCubeInfo();

                    /* match play */

                    switch (pc) {
                    case PositionClass.CLASS_HYPERGAMMON1:
                    case PositionClass.CLASS_HYPERGAMMON2:
                    case PositionClass.CLASS_HYPERGAMMON3:
                        // /* use exact money equities to guess cube efficiency */

                        // SetCubeInfoMoney(&ciMoney, 1, aci[ici].fCubeOwner, aci[ici].fMove, FALSE, FALSE, aci[ici].bgv);

                        // rCl = Utility(arOutput, &ciMoney);
                        // rCubeX = 1.0;
                        // rCf = Cl2CfMoney(arOutput, &ciMoney, rCubeX);
                        // rCfMoney = CFHYPER(arEquity, &ciMoney);

                        // if (fabsf(rCl - rCf) > 0.0001f)
                        //     rCubeX = (rCfMoney - rCl) / (rCf - rCl);

                        // arCf[ici] = Cl2CfMatch(arOutput, &aci[ici], rCubeX);

                        // rCubeX = X;

						console.error('Not implemented');

                        break;

                    case PositionClass.CLASS_BEAROFF2:
                    case PositionClass.CLASS_BEAROFF_TS:
                        /* use exact money equities to guess cube efficiency */

                        // SetCubeInfoMoney(&ciMoney, 1, aci[ici].fCubeOwner, aci[ici].fMove, FALSE, FALSE, aci[ici].bgv);

                        // rCl = arEquity[0];
                        // rCubeX = 1.0;
                        // rCf = Cl2CfMoney(arOutput, &ciMoney, rCubeX);
                        // rCfMoney = CFMONEY(arEquity, &ciMoney);

                        // if (fabsf(rCl - rCf) > 0.0001)
                        //     rCubeX = (rCfMoney - rCl) / (rCf - rCl);
                        // else
                        //     rCubeX = X;

                        // /* fabs(...) > 0.0001 above is not enough. We still get some
                        //  * nutty values for rCubeX and need more sanity checking */

                        // if (rCubeX < 0.0)
                        //     rCubeX = 0.0;
                        // if (rCubeX > X)
                        //     rCubeX = X;

                        // arCf[ici] = Cl2CfMatch(arOutput, &aci[ici], rCubeX);

                        // rCubeX = X;

						console.error('Not implemented');
                        break;

                    case PositionClass.CLASS_OVER:
                    case PositionClass.CLASS_RACE:
                    case PositionClass.CLASS_CRASHED:
                    case PositionClass.CLASS_CONTACT:
                    case PositionClass.CLASS_BEAROFF1:
                    case PositionClass.CLASS_BEAROFF_OS:
                        /* approximate using Joern's generalisation of 
                         * Janowski's formulae */

                        arCf[ici] = Cl2CfMatch(arOutput, aci[ici], rCubeX);
                        break;

                    }

                }

            }


        /* find optimal of "no double" and "double" */

        GetECF3(arCubeful, cci, arCf, aci);

    }

    return 0;
}


function EvaluatePositionCubeful3(nnStates, anBoard,
	arOutput,
	arCubeful,
	aciCubePos, cci,
	ciMove, ec, nPlies, fTop) {

	var ici, fAll = true, ce = newCacheNode();

	if (!cCache || ec.rNoise != 0.0)
	/* non-deterministic evaluation; never cache */
	{
		return EvaluatePositionCubeful4(nnStates, anBoard, arOutput, arCubeful,
					aciCubePos, cci, ciMove, ec, nPlies, fTop);
	}

	PositionKey(anBoard, ce.key);

	/* check cache for existence for earlier calculation */

	fAll = !fTop;               /* FIXME: fTop should be a part of EvalKey */

	for (ici = 0; ici < cci && fAll; ++ici) {

		if (aciCubePos[ici].nCube < 0) 
			continue;
		

		ce.nEvalContext = EvalKey(ec, nPlies, aciCubePos[ici], true);

		if (CacheLookup(cEval, ce, arOutput, arCubeful[ici]) != CACHEHIT) 
			fAll = false;
		
	}

	/* get equities */

	if (!fAll) {

	/* cache miss */
		if (EvaluatePositionCubeful4(nnStates, anBoard, arOutput, arCubeful,
						aciCubePos, cci, ciMove, ec, nPlies, fTop))
			return -1;

		/* add to cache */

		if (!fTop) {

			for (ici = 0; ici < cci; ++ici) {
				if (aciCubePos[ici].nCube < 0)
					continue;

				// memcpy(ec.ar, arOutput, sizeof(float) * NUM_OUTPUTS);
				ce.ar.set(arOutput.subarray(0, NUM_OUTPUTS));
				ce.ar[NUM_OUTPUTS] = arCubeful[ici];      /* Cubeful equity stored in slot 5 */
				ce.nEvalContext = EvalKey(ec, nPlies, aciCubePos[ici], true);

				CacheAdd(cEval, ce, GetHashKey(cEval.hashMask, ce));

			}
		}
	}

	return 0;

}

function EvaluatePositionFull(nnStates, anBoard, arOutput,
	ci, ec, nPlies, pc) {

	let i, n0, n1, eTemp, w;
	let arVariationOutput = new Float32Array(5);

	if (pc > CLASS_PERFECT && nPlies > 0) {
		/* internal node; recurse */

		let anBoardNew =  initBoard();
		/* int anMove[ 8 ]; */
		let ciOpp = initCubeInfo();
		const usePrune = ec.fUsePrune && ec.rNoise == 0.0 && ci.bgv == VARIATION_STANDARD;

		for (i = 0; i < NUM_OUTPUTS; i++)
			arOutput[i] = 0.0;

		/* loop over rolls */

		for (n0 = 1; n0 <= 6; n0++) {
			for (n1 = 1; n1 <= n0; n1++) {
				w = (n0 == n1) ? 1 : 2;

				for (i = 0; i < 25; i++) {
					anBoardNew[0][i] = anBoard[0][i];
					anBoardNew[1][i] = anBoard[1][i];
				}


				if (usePrune) 
					FindBestMoveInEval(nnStates, n0, n1, anBoard, anBoardNew, ci, ec);
				else 
					FindBestMovePlied(null, n0, n1, anBoardNew, ci, ec, 0, defaultFilters);
				

				SwapSides(anBoardNew);

				SetCubeInfo(ciOpp, ci.nCube, ci.fCubeOwner, 1 - ci.fMove,
						ci.nMatchTo, ci.anScore, ci.fCrawford, ci.fJacoby, ci.fBeavers, ci.bgv);

				/* Evaluate at 0-ply */
				if (EvaluatePositionCache(nnStates, anBoardNew, arVariationOutput,
										ciOpp, pec, nPlies - 1,
										ClassifyPosition(anBoardNew, ciOpp.bgv)))
					return -1;

				for (i = 0; i < NUM_OUTPUTS; i++)
					arOutput[i] += w * arVariationOutput[i];
			}

		}

	/* normalize */
	for (i = 0; i < NUM_OUTPUTS; i++)
		arOutput[i] /= 36;

	/* flop eval */
	arOutput[OUTPUT_WIN] = 1.0 - arOutput[OUTPUT_WIN];

	rTemp = arOutput[OUTPUT_WINGAMMON];
	arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_LOSEGAMMON];
	arOutput[OUTPUT_LOSEGAMMON] = rTemp;

	rTemp = arOutput[OUTPUT_WINBACKGAMMON];
	arOutput[OUTPUT_WINBACKGAMMON] = arOutput[OUTPUT_LOSEBACKGAMMON];
	arOutput[OUTPUT_LOSEBACKGAMMON] = rTemp;

	} else {
	/* at leaf node; use static evaluation */

		if (acef[pc] (anBoard, arOutput, ci.bgv, nnStates))
			return -1;

		if (ec.rNoise > 0.0 && pc != PositionClass.CLASS_OVER) {
			for (i = 0; i < NUM_OUTPUTS; i++) {
				arOutput[i] += Noise(pec, anBoard, i);
				arOutput[i] = Math.max(arOutput[i], 0.0);
				arOutput[i] = Math.min(arOutput[i], 1.0);
			}
		}

		if (pc > CLASS_GOOD || ec.rNoise > 0.0)
			/* no sanity check needed for accurate evaluations */
			SanityCheck(anBoard, arOutput);
	}

	return 0;
}

function EvaluatePositionCache(nnStates, anBoard, arOutput,
	ci, ecx, nPlies, pc) {

	let l, ec = { 
		key: initKey(), 
		nEvalContext: 0, 
		ar: new Float32Array(6)
	};

	/* This should be a part of the code that is called in all
	* time-consuming operations at a relatively steady rate, so is a
	* good choice for a callback function. */
	if (!cCache || ecx.rNoise != 0.0) {      /* non-deterministic noisy evaluations; cannot cache */
		return EvaluatePositionFull(nnStates, anBoard, arOutput, ci, ecx, nPlies, pc);
	}

	PositionKey(anBoard, ec.key);

	ec.nEvalContext = EvalKey(ecx, nPlies, ci, false);
	if ((l = CacheLookup(cEval, ec, arOutput, null)) == CACHEHIT) 
		return 0;

	if (EvaluatePositionFull(nnStates, anBoard, arOutput, ci, ecx, nPlies, pc))
		return -1;

	ec.ar = new Float32Array(arOutput);
	ec.ar[5] = 0;

	CacheAdd(cEval, ec, l);

	return 0;
}


function PerfectCubeful(bc, anBoard, arEquity) {

    let nUs = PositionBearoff(anBoard[1], bc.nPoints, bc.nChequers)
    	, nThem = PositionBearoff(anBoard[0], bc.nPoints, bc.nChequers)
    	, n = Combination(bc.nPoints + bc.nChequers, bc.nPoints)
    	, iPos = nUs * n + nThem;

    return BearoffCubeful(pbc, iPos, arEquity, NULL);

}

function EvaluatePerfectCubeful(anBoard, arEquity, bgv) {

    const pc = ClassifyPosition(anBoard, bgv);

    // g_assert(pc <= CLASS_PERFECT);

    switch (pc) {
    case PositionClass.CLASS_BEAROFF2:
        return PerfectCubeful(pbc2, anBoard, arEquity);
    case PositionClass.CLASS_BEAROFF_TS:
        return PerfectCubeful(pbcTS, anBoard, arEquity);
    default:
        // g_assert_not_reached();
    }

    return -1;

}

function Cl2CfMoney(arOutput, ci, rCubeX) {
    const epsilon = 0.0000001
    	, omepsilon = 0.9999999;

    let rW, rL;
    let rEqDead, rEqLive;

    /* money game */

    /* Transform cubeless 0-ply equity to cubeful 0-ply equity using
     * Rick Janowski's formulas [insert ref here]. */

    /* First calculate average win and loss W and L: */

    if (arOutput[OUTPUT_WIN] > epsilon)
        rW = 1.0 + (arOutput[OUTPUT_WINGAMMON] + arOutput[OUTPUT_WINBACKGAMMON]) / arOutput[OUTPUT_WIN];
    else {
        /* basically a dead cube */
        return Utility(arOutput, ci);
    }

    if (arOutput[OUTPUT_WIN] < omepsilon)
        rL = 1.0 + (arOutput[OUTPUT_LOSEGAMMON] + arOutput[OUTPUT_LOSEBACKGAMMON]) / (1.0 - arOutput[OUTPUT_WIN]);
    else {
        /* basically a dead cube */
        return Utility(arOutput, ci);
    }


    rEqDead = Utility(arOutput, ci);
    rEqLive = MoneyLive(rW, rL, arOutput[OUTPUT_WIN], ci);

    return rEqDead * (1.0 - rCubeX) + rEqLive * rCubeX;

}

function Cl2CfMatchCentered(arOutput, ci, rCubeX) {

    /* normalized score */

    let rG0, rBG0, rG1, rBG1;
    let arCP = new Float32Array(2);

    let rMWCDead, rMWCLive, rMWCWin, rMWCLose;
    let rMWCOppCash, rMWCCash, rOppTG, rTG;
    let aarMETResult = [new Float32Array(MetIndeces.DTLBP1 + 1), new Float32Array(MetIndeces.DTLBP1 + 1)];

    /* Centered cube */

    /* Calculate normal, gammon, and backgammon ratios */

    if (arOutput[OUTPUT_WIN] > 0.0) {
        rG0 = (arOutput[OUTPUT_WINGAMMON] - arOutput[OUTPUT_WINBACKGAMMON]) / arOutput[OUTPUT_WIN];
        rBG0 = arOutput[OUTPUT_WINBACKGAMMON] / arOutput[OUTPUT_WIN];
    } else {
        rG0 = 0.0;
        rBG0 = 0.0;
    }

    if (arOutput[OUTPUT_WIN] < 1.0) {
        rG1 = (arOutput[OUTPUT_LOSEGAMMON] - arOutput[OUTPUT_LOSEBACKGAMMON]) / (1.0 - arOutput[OUTPUT_WIN]);
        rBG1 = arOutput[OUTPUT_LOSEBACKGAMMON] / (1.0 - arOutput[OUTPUT_WIN]);
    } else {
        rG1 = 0.0;
        rBG1 = 0.0;
    }

    /* MWC(dead cube) = cubeless equity */

    rMWCDead = eq2mwc(Utility(arOutput, ci), ci);

    /* Get live cube cash points */

    GetPoints(arOutput, ci, arCP);

    getMEMultiple(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                  ci.nCube, -1, -1, ci.fCrawford, aafMET, aafMETPostCrawford, aarMETResult[0], aarMETResult[1]);

    rMWCCash = aarMETResult[ci.fMove][MetIndeces.NDW];

    rMWCOppCash = aarMETResult[ci.fMove][MetIndeces.NDL];

    rOppTG = 1.0 - arCP[1 - ci.fMove];
    rTG = arCP[ci.fMove];

    if (arOutput[OUTPUT_WIN] <= rOppTG) {

        /* Opp too good to double */

        rMWCLose = (1.0 - rG1 - rBG1) * aarMETResult[ci.fMove][MetIndeces.NDL]
            + rG1 * aarMETResult[ci.fMove][MetIndeces.NDLG]
            + rBG1 * aarMETResult[ci.fMove][MetIndeces.NDLB];

        if (rOppTG > 0.0)
            /* avoid division by zero */
            rMWCLive = rMWCLose + (rMWCOppCash - rMWCLose) * arOutput[OUTPUT_WIN] / rOppTG;
        else
            rMWCLive = rMWCLose;

        /* (1-x) MWC(dead) + x MWC(live) */

        return rMWCDead * (1.0 - rCubeX) + rMWCLive * rCubeX;

    } else if (arOutput[OUTPUT_WIN] < rTG) {

        /* In doubling window */

        rMWCLive = rMWCOppCash + (rMWCCash - rMWCOppCash) * (arOutput[OUTPUT_WIN] - rOppTG) / (rTG - rOppTG);
        return rMWCDead * (1.0 - rCubeX) + rMWCLive * rCubeX;

    } else {

        /* I'm too good to double */

        /* MWC(live cube) linear interpolation between the
         * points:
         * 
         * p = TG, MWC = I win 1 point
         * p = 1, MWC = I win (normal, gammon, or backgammon)
         * 
         */

        rMWCWin = (1.0 - rG0 - rBG0) * aarMETResult[ci.fMove][MetIndeces.NDW]
            + rG0 * aarMETResult[ci.fMove][MetIndeces.NDWG]
            + rBG0 * aarMETResult[ci.fMove][MetIndeces.NDWB];

        if (rTG < 1.0)
            rMWCLive = rMWCCash + (rMWCWin - rMWCCash) * (arOutput[OUTPUT_WIN] - rTG) / (1.0 - rTG);
        else
            rMWCLive = rMWCWin;

        /* (1-x) MWC(dead) + x MWC(live) */

        return rMWCDead * (1.0 - rCubeX) + rMWCLive * rCubeX;

    }

}

function Cl2CfMatchOwned(arOutput, ci, rCubeX) {

    /* normalized score */
	let rG0, rBG0, rG1, rBG1;
    let arCP = new Float32Array(2);

    let rMWCDead, rMWCLive, rMWCWin, rMWCLose;
    let rMWCCash, rTG;
    let aarMETResult = [new Float32Array(MetIndeces.DTLBP1 + 1), new Float32Array(MetIndeces.DTLBP1 + 1)];

    /* I own cube */

    /* Calculate normal, gammon, and backgammon ratios */

    if (arOutput[OUTPUT_WIN] > 0.0) {
        rG0 = (arOutput[OUTPUT_WINGAMMON] - arOutput[OUTPUT_WINBACKGAMMON]) / arOutput[OUTPUT_WIN];
        rBG0 = arOutput[OUTPUT_WINBACKGAMMON] / arOutput[OUTPUT_WIN];
    } else {
        rG0 = 0.0;
        rBG0 = 0.0;
    }

    if (arOutput[OUTPUT_WIN] < 1.0) {
        rG1 = (arOutput[OUTPUT_LOSEGAMMON] - arOutput[OUTPUT_LOSEBACKGAMMON]) / (1.0 - arOutput[OUTPUT_WIN]);
        rBG1 = arOutput[OUTPUT_LOSEBACKGAMMON] / (1.0 - arOutput[OUTPUT_WIN]);
    } else {
        rG1 = 0.0;
        rBG1 = 0.0;
    }

    /* MWC(dead cube) = cubeless equity */

    rMWCDead = eq2mwc(Utility(arOutput, ci), ci);

    /* Get live cube cash points */

    GetPoints(arOutput, ci, arCP);

    getMEMultiple(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                  ci.nCube, -1, -1, ci.fCrawford, aafMET, aafMETPostCrawford, aarMETResult[0], aarMETResult[1]);

    rMWCCash = aarMETResult[ci.fMove][MetIndeces.NDW];

    rTG = arCP[ci.fMove];

    if (arOutput[OUTPUT_WIN] <= rTG) {

        /* MWC(live cube) linear interpolation between the
         * points:
         * 
         * p = 0, MWC = I lose (normal, gammon, or backgammon)
         * p = TG, MWC = I win 1 point
         * 
         */

        rMWCLose = (1.0 - rG1 - rBG1) * aarMETResult[ci.fMove][MetIndeces.NDL]
            + rG1 * aarMETResult[ci.fMove][MetIndeces.NDLG]
            + rBG1 * aarMETResult[ci.fMove][MetIndeces.NDLB];

        if (rTG > 0.0)
            rMWCLive = rMWCLose + (rMWCCash - rMWCLose) * arOutput[OUTPUT_WIN] / rTG;
        else
            rMWCLive = rMWCLose;

        /* (1-x) MWC(dead) + x MWC(live) */

        return rMWCDead * (1.0 - rCubeX) + rMWCLive * rCubeX;

    } else {

        /* we are too good to double */

        /* MWC(live cube) linear interpolation between the
         * points:
         * 
         * p = TG, MWC = I win 1 point
         * p = 1, MWC = I win (normal, gammon, or backgammon)
         * 
         */

        rMWCWin = (1.0 - rG0 - rBG0) * aarMETResult[ci.fMove][MetIndeces.NDW]
            + rG0 * aarMETResult[ci.fMove][MetIndeces.NDWG]
            + rBG0 * aarMETResult[ci.fMove][MetIndeces.NDWB];

        if (rTG < 1.0)
            rMWCLive = rMWCCash + (rMWCWin - rMWCCash) * (arOutput[OUTPUT_WIN] - rTG) / (1.0 - rTG);
        else
            rMWCLive = rMWCWin;

        /* (1-x) MWC(dead) + x MWC(live) */

        return rMWCDead * (1.0 - rCubeX) + rMWCLive * rCubeX;

    }

}

function Cl2CfMatchUnavailable(arOutput, ci, rCubeX) {

    /* normalized score */

	let rG0, rBG0, rG1, rBG1;
    let arCP = new Float32Array(2);

    let rMWCDead, rMWCLive, rMWCWin, rMWCLose;
    let rMWCOppCash, rOppTG;
    let aarMETResult = [new Float32Array(MetIndeces.DTLBP1 + 1), new Float32Array(MetIndeces.DTLBP1 + 1)];


    /* I own cube */

    /* Calculate normal, gammon, and backgammon ratios */

    if (arOutput[OUTPUT_WIN] > 0.0) {
        rG0 = (arOutput[OUTPUT_WINGAMMON] - arOutput[OUTPUT_WINBACKGAMMON]) / arOutput[OUTPUT_WIN];
        rBG0 = arOutput[OUTPUT_WINBACKGAMMON] / arOutput[OUTPUT_WIN];
    } else {
        rG0 = 0.0;
        rBG0 = 0.0;
    }

    if (arOutput[OUTPUT_WIN] < 1.0) {
        rG1 = (arOutput[OUTPUT_LOSEGAMMON] - arOutput[OUTPUT_LOSEBACKGAMMON]) / (1.0 - arOutput[OUTPUT_WIN]);
        rBG1 = arOutput[OUTPUT_LOSEBACKGAMMON] / (1.0 - arOutput[OUTPUT_WIN]);
    } else {
        rG1 = 0.0;
        rBG1 = 0.0;
    }

    /* MWC(dead cube) = cubeless equity */

    rMWCDead = eq2mwc(Utility(arOutput, ci), ci);

    /* Get live cube cash points */

    GetPoints(arOutput, ci, arCP);

    getMEMultiple(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                  ci.nCube, -1, -1, ci.fCrawford, aafMET, aafMETPostCrawford, aarMETResult[0], aarMETResult[1]);

    rMWCOppCash = aarMETResult[ci.fMove][MetIndeces.NDL];

    rOppTG = 1.0 - arCP[1 - ci.fMove];

    if (arOutput[OUTPUT_WIN] <= rOppTG) {

        /* Opponent is too good to double.
         * 
         * MWC(live cube) linear interpolation between the
         * points:
         * 
         * p = 0, MWC = opp win normal, gammon, backgammon
         * p = OppTG, MWC = opp cashes
         * 
         */

        rMWCLose = (1.0 - rG1 - rBG1) * aarMETResult[ci.fMove][MetIndeces.NDL]
            + rG1 * aarMETResult[ci.fMove][MetIndeces.NDLG]
            + rBG1 * aarMETResult[ci.fMove][MetIndeces.NDLB];

        if (rOppTG > 0.0)
            /* avoid division by zero */
            rMWCLive = rMWCLose + (rMWCOppCash - rMWCLose) * arOutput[OUTPUT_WIN] / rOppTG;
        else
            rMWCLive = rMWCLose;

        /* (1-x) MWC(dead) + x MWC(live) */

        return rMWCDead * (1.0 - rCubeX) + rMWCLive * rCubeX;

    } else {

        /* MWC(live cube) linear interpolation between the
         * points:
         * 
         * p = OppTG, MWC = opponent cashes
         * p = 1, MWC = I win (normal, gammon, or backgammon)
         * 
         */

        rMWCWin = (1.0 - rG0 - rBG0) * aarMETResult[ci.fMove][MetIndeces.NDW]
            + rG0 * aarMETResult[ci.fMove][MetIndeces.NDWG]
            + rBG0 * aarMETResult[ci.fMove][MetIndeces.NDWB];

        rMWCLive = rMWCOppCash + (rMWCWin - rMWCOppCash) * (arOutput[OUTPUT_WIN] - rOppTG) / (1.0 - rOppTG);

        /* (1-x) MWC(dead) + x MWC(live) */

        return rMWCDead * (1.0 - rCubeX) + rMWCLive * rCubeX;

    }

}

function Cl2CfMatch(arOutput, ci, rCubeX)
{
    /* Check if this requires a cubeful evaluation */

    if (!fDoCubeful(ci)) {

        /* cubeless eval */

        return eq2mwc(Utility(arOutput, ci), ci);

    } /* fDoCubeful */
    else {

        /* cubeful eval */

        if (ci.fCubeOwner == -1)
            return Cl2CfMatchCentered(arOutput, ci, rCubeX);
        else if (ci.fCubeOwner == ci.fMove)
            return Cl2CfMatchOwned(arOutput, ci, rCubeX);
        else
            return Cl2CfMatchUnavailable(arOutput, ci, rCubeX);

    }

}

function EvalEfficiency(anBoard, pc) {
    /* Since it's somewhat costly to call CalcInputs, the 
     * inputs should preferably be cached to save time. */

    switch (pc) {
    case PositionClass.CLASS_OVER:
        return 0.0;            /* dead cube */

    case PositionClass.CLASS_HYPERGAMMON1:
    case PositionClass.CLASS_HYPERGAMMON2:
    case PositionClass.CLASS_HYPERGAMMON3:

        /* FIXME */

        return 0.60;

    case PositionClass.CLASS_BEAROFF1:
    case PositionClass.CLASS_BEAROFF_OS:
        /* FIXME: calculate based on #rolls to get off.
         * For example, 15 rolls probably have cube eff. of
         * 0.7, and 1.25 rolls have cube eff. of 1.0.
         * 
         * It's not so important to have cube eff. correct here as an
         * n-ply evaluation will take care of last-roll and 2nd-last-roll
         * situations. */

        return rOSCubeX;

    case PositionClass.CLASS_RACE:
        {
            const anPips = new Uint32Array(2).fill(0);

            PipCount(anBoard, anPips);

            let rEff = anPips[1] * rRaceFactorX + rRaceCoefficientX;
            if (rEff > rRaceMax)
                return rRaceMax;
            else {
                if (rEff < rRaceMin)
                    return rRaceMin;
                else
                    return rEff;
            }
        }

    case PositionClass.CLASS_CONTACT:

        /* FIXME: should CLASS_CRASHED be handled differently? */

        /* FIXME: use Oystein's values published in rec.games.backgammon,
         * or work some other semiempirical values */

        /* FIXME: very important: use opponents inputs as well */

        return rContactX;

    case PositionClass.CLASS_CRASHED:

	return rCrashedX;

    case PositionClass.CLASS_BEAROFF2:
    case PositionClass.CLASS_BEAROFF_TS:

        return rTSCubeX;        /* for match play only */

    default:
        // g_assert_not_reached();

    }
    return 0;

}

function InvertEvaluation(ar) {

    let r;

    ar[OUTPUT_WIN] = 1.0 - ar[OUTPUT_WIN];

    r = ar[OUTPUT_WINGAMMON];
    ar[OUTPUT_WINGAMMON] = ar[OUTPUT_LOSEGAMMON];
    ar[OUTPUT_LOSEGAMMON] = r;

    r = ar[OUTPUT_WINBACKGAMMON];
    ar[OUTPUT_WINBACKGAMMON] = ar[OUTPUT_LOSEBACKGAMMON];
    ar[OUTPUT_LOSEBACKGAMMON] = r;
}

function InvertEvaluationR(ar, ci)
{
    /* invert win, gammon etc. */

    InvertEvaluation(ar);

    /* invert equities */

    ar[OUTPUT_EQUITY] = -ar[OUTPUT_EQUITY];

    if (ci.nMatchTo)
        ar[OUTPUT_CUBEFUL_EQUITY] = 1.0 - ar[OUTPUT_CUBEFUL_EQUITY];
    else
        ar[OUTPUT_CUBEFUL_EQUITY] = -ar[OUTPUT_CUBEFUL_EQUITY];
}

function Utility(ar, ci) {

    if (!ci.nMatchTo) {

        /* equity calculation for money game */

        /* For money game the gammon price is the same for both
         * players, so there is no need to use pci->fMove. */

        return ar[OUTPUT_WIN] * 2.0 - 1.0 + (ar[OUTPUT_WINGAMMON] - ar[OUTPUT_LOSEGAMMON]) * ci.arGammonPrice[0] + (ar[OUTPUT_WINBACKGAMMON] - ar[OUTPUT_LOSEBACKGAMMON]) * ci.arGammonPrice[1];

	}

	/* equity calculation for match play */

	return ar[OUTPUT_WIN] * 2.0 - 1.0 + ar[OUTPUT_WINGAMMON] * ci.arGammonPrice[ci.fMove]
		- ar[OUTPUT_LOSEGAMMON] * ci.arGammonPrice[1 - ci.fMove]
		+ ar[OUTPUT_WINBACKGAMMON] * ci.arGammonPrice[2 + ci.fMove]
		- ar[OUTPUT_LOSEBACKGAMMON] * ci.arGammonPrice[2 + 1 - ci.fMove];
}

/*
 * UtilityME is identical to Utility for match play.
 * For money play it returns the money equity instead of the 
 * correct cubeless equity.
 */

function UtilityME(ar, ci) {

    if (!ci.nMatchTo)

        /* calculate money equity */

        return ar[OUTPUT_WIN] * 2.0 - 1.0 + (ar[OUTPUT_WINGAMMON] - ar[OUTPUT_LOSEGAMMON]) + (ar[OUTPUT_WINBACKGAMMON] - ar[OUTPUT_LOSEBACKGAMMON]);

	return Utility(ar, ci);
}

function getME(nScore0, nScore1, nMatchTo,
	fPlayer,
	nPoints, fWhoWins,
	fCrawford, aafMET, aafMETPostCrawford) {

	var n0 = nMatchTo - (nScore0 + (!fWhoWins) * nPoints) - 1;
	var n1 = nMatchTo - (nScore1 + fWhoWins * nPoints) - 1;

	/* check if any player has won the match */

	if (n0 < 0)
	  /* player 0 has won the game */
	  return (fPlayer) ? 0.0 : 1.0;
	
	if (n1 < 0)
	  /* player 1 has won the game */
	  return (fPlayer) ? 1.0 : 0.0;

	/* the match is not finished */

	if (fCrawford || (nMatchTo - nScore0 == 1) || (nMatchTo - nScore1 == 1)) {

	  /* the next game will be post-Crawford */

	  if (!n0)
		  /* player 0 is leading match */
		  /* FIXME: use pc-MET for player 0 */
		  return (fPlayer) ? aafMETPostCrawford[1][n1] : 1.0 - aafMETPostCrawford[1][n1];
	  
		  /* player 1 is leading the match */
		  return (fPlayer) ? 1.0 - aafMETPostCrawford[0][n0] : aafMETPostCrawford[0][n0];

  } else
	  /* non-post-Crawford games */
	  return (fPlayer) ? 1.0 - aafMET[n0][n1] : aafMET[n0][n1];

}

function getMEMultiple(nScore0, nScore1, nMatchTo,
              nCube, nCubePrime0, nCubePrime1,
              fCrawford, aafMET,
              aafMETPostCrawford, player0=new Float32Array(30), player1=new Float32Array(30))
{

    let scores = [
		new Int32Array(MetIndeces.DTLBP1 + 1), 
		new Int32Array(MetIndeces.DTLBP1 + 1)
	]  /* the resulting match scores */
    	, i, j, max_res, s0, s1
    	, score0, score1
     	, mult = new Int32Array([ 1, 2, 3, 4, 6 ])
    	, p0, p1, f
    	, away0, away1
    	, fCrawf = fCrawford;

    /* figure out how many results we'll be returning */
    max_res = (nCubePrime0 < 0) ? MetIndeces.DTLB + 1 : (nCubePrime1 < 0) ? MetIndeces.DTLBP0 + 1 : MetIndeces.DTLBP1 + 1;

    /* set up a table of resulting match scores for all 
     * the results we're calculating */
    score0 = scores[0];
    score1 = scores[1];
    away0 = nMatchTo - nScore0 - 1;
    away1 = nMatchTo - nScore1 - 1;
    fCrawf |= (nMatchTo - nScore0 == 1) || (nMatchTo - nScore1 == 1);

    /* player 0 wins normal, doubled, gammon, backgammon */
    for (i = 0, j = 0; i < MetIndeces.NDL; ++i, ++j) {
        // *score0++ = away0 - mult[i] * nCube;
        // *score1++ = away1;
		score0[j] = away0 - mult[i] * nCube;
		score1[j] = away1;
    }
    /* player 1 wins normal, doubled, etc. */
    for (i = 0; i < MetIndeces.NDL; ++i, ++j) {
        score0[j] = away0;
        score1[j] = away1 - mult[i] * nCube;
    }
    if (max_res > MetIndeces.DPP0) {
        /* same using the second cube value */
        for (i = 0; i < MetIndeces.NDL; ++i, ++j) {
            score0[j] = away0 - mult[i] * nCubePrime0;
            score1[j] = away1;
        }
        for (i = 0; i < MetIndeces.NDL; ++i, ++j) {
            score0[j] = away0;
            score1[j] = away1 - mult[i] * nCubePrime0;
        }
        if (max_res > MetIndeces.DPP1) {
            /* same using the third cube value */
            for (i = 0; i < MetIndeces.NDL; ++i, ++j) {
                score0[j] = away0 - mult[i] * nCubePrime1;
                score1[j] = away1;
            }
            for (i = 0; i < MetIndeces.NDL; ++i, ++j) {
                score0[j] = away0;
                score1[j] = away1 - mult[i] * nCubePrime1;
            }
        }
    }

    // score0 = scores[0];
    // score1 = scores[1];
    // p0 = player0;
    // p1 = player1;

    /* now go through the resulting scores, looking up the equities */
    for (i = 0, p0 = 0, p1 = 0; i < max_res; ++i) {
        s0 = score0[i];
        s1 = score1[i];

        if (s0 < 0) {
            /* player 0 wins */
            // *p0++ = 1.0f;
            // *p1++ = 0.0f;

			player0[p0++] = 1.0;
			player1[p1++] = 0.0;


        } else if (s1 < 0) {
			player0[p0++] = 0.0;
			player1[p1++] = 1.0;
        } else if (fCrawf) {
            if (s0 == 0) {      /* player 0 is leading */
				player0[p0++] = 1.0 - aafMETPostCrawford[1][s1];
                player1[p1++] = aafMETPostCrawford[1][s1];
            } else {
                player0[p0++] = aafMETPostCrawford[0][s0];
                player1[p1++] = 1.0 - aafMETPostCrawford[0][s0];
            }
        } else {                /* non-post-Crawford */
			player0[p0++] = aafMET[s0][s1];
            player1[p1++] = 1.0 - aafMET[s0][s1];
        }
    }

    /* results for player 0 are done, results for player 1 have the
     *  losses in cols 0-4 and 8-12, but we want them to be in the same
     *  order as results0 - e.g wins in cols 0-4, and 8-12
     */
    // p0 = player1;
    // p1 = player1 + MetIndeces.NDL;
    for (i = 0, p0 = 0, p1 = MetIndeces.NDL; i < MetIndeces.NDL; ++i) {
        f = player1[p0];
        player1[p0++] = player1[p1];
        player1[p1++] = f;
    }

    if (max_res > MetIndeces.DTLBP0) {
        p0 += MetIndeces.NDL;
        p1 += MetIndeces.NDL;
        for (i = 0; i < MetIndeces.NDL; ++i) {
			f = player1[p0];
			player1[p0++] = player1[p1];
			player1[p1++] = f;
        }
    }

    if (max_res > MetIndeces.DTLBP1) {
        p0 += MetIndeces.NDL;
        p1 += MetIndeces.NDL;
        for (i = 0; i < MetIndeces.NDL; ++i) {
			f = player1[p0];
			player1[p0++] = player1[p1];
			player1[p1++] = f;
        }
    }

}

function mwc2eq(rMwc, ci) {

    /* mwc if I win/lose */

    var rMwcWin, rMwcLose;

    rMwcWin = getME(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                    ci.fMove, ci.nCube, ci.fMove, ci.fCrawford, aafMET, aafMETPostCrawford);

    rMwcLose = getME(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                     ci.fMove, ci.nCube, 1 - ci.fMove, ci.fCrawford, aafMET, aafMETPostCrawford);

    /* 
     * make linear inter- or extrapolation:
     * equity       mwc
     *  -1          rMwcLose
     *  +1          rMwcWin
     *
     * Interpolation formula:
     *
     *       2 * rMwc - ( rMwcWin + rMwcLose )
     * rEq = ---------------------------------
     *            rMwcWin - rMwcLose
     *
     * FIXME: numerical problems?
     * If you are trailing 30-away, 1-away the difference between
     * 29-away, 1-away and 30-away, 0-away is not very large, and it may
     * give numerical problems.
     *
     */

    return (2.0 * rMwc - (rMwcWin + rMwcLose)) / (rMwcWin - rMwcLose);

}

function eq2mwc(rEq, ci) {

    /* mwc if I win/lose */

    let rMwcWin, rMwcLose;

    rMwcWin = getME(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                    ci.fMove, ci.nCube, ci.fMove, ci.fCrawford, aafMET, aafMETPostCrawford);

    rMwcLose = getME(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                     ci.fMove, ci.nCube, 1 - ci.fMove, ci.fCrawford, aafMET, aafMETPostCrawford);

    /*
     * Linear inter- or extrapolation.
     * Solve the formula in the routine above (mwc2eq):
     *
     *        rEq * ( rMwcWin - rMwcLose ) + ( rMwcWin + rMwcLose )
     * rMwc = -----------------------------------------------------
     *                                   2
     */

    return 0.5 * (rEq * (rMwcWin - rMwcLose) + (rMwcWin + rMwcLose));

}

function ScoreMoves(ml, ci, ec, nPlies) {
	let i, r = 0;
    let nnStates = gNNState;

    ml.rBestScore = -99999.9;

    if (nPlies == 0) {
        /* start incremental evaluations */
        nnStates[0].state = nnStates[1].state = nnStates[2].state = NNStateType.NNSTATE_INCREMENTAL;
    }


    for (i = 0; i < ml.cMoves; i++) {
        if (ScoreMove(nnStates, ml.amMoves[i], ci, ec, nPlies) < 0) {
            r = -1;
            break;
        }

        if ((ml.amMoves[i].rScore > ml.rBestScore) || ((ml.amMoves[i].rScore == ml.rBestScore)
                                                           && (ml.amMoves[i].rScore2 >
                                                               ml.amMoves[ml.iMoveBest].rScore2))) {
            ml.iMoveBest = i;
            ml.rBestScore = ml.amMoves[i].rScore;
        }

		// console.debug('Move scored:', i);
    }

    if (nPlies == 0) {
        /* reset to none */

        nnStates[0].state = nnStates[1].state = nnStates[2].state = NNStateType.NNSTATE_NONE;
    }

	// console.groupCollapsed('score moves', ml.cMoves);
	// for (i = 0; i < ml.cMoves; ++i) {
	// 	const m = ml.amMoves[i];
	// 	console.debug('\t', Array.from(m.anMove));
	// 	console.debug('\t', m.rScore, m.rScore2);
	// }
	// console.groupEnd();

    return r;
}

function ScoreMovesPruned(ml, ci, ec, bmovesi, prune_moves) {
    let i, j
    	, r = 0                  /* return value */
    	, nnStates = gNNState;

    ml.rBestScore = -99999.9;

    /* start incremental evaluations */
    nnStates[0].state = nnStates[1].state = nnStates[2].state = NNSTATE_INCREMENTAL;

    for (j = 0; j < prune_moves; j++) {

        i = bmovesi[j];

        if (ScoreMove(nnStates, ml.amMoves[i], ci, ec, 0) < 0) {
            r = -1;
            break;
        }

        if ((ml.amMoves[i].rScore > ml.rBestScore) || ((ml.amMoves[i].rScore == ml.rBestScore)
                                                           && (ml.amMoves[i].rScore2 >
                                                               ml.amMoves[ml.iMoveBest].rScore2))) {
            ml.iMoveBest = i;
            ml.rBestScore = ml.amMoves[i].rScore;
        }
    }

    nnStates[0].state = nnStates[1].state = nnStates[2].state = NNSTATE_NONE;

    return r;
}

function CompareMoves(m0, m1) {

    /*high score first */
    return (m1.rScore > m0.rScore || (m1.rScore == m0.rScore && m1.rScore2 > m0.rScore2)) ? 1 : -1;
}

function GenerateMoves(ml, anBoard, n0, n1, fPartial) {

    const anRoll = new Int32Array(4), anMoves = new Int32Array(8);
    anRoll[0] = n0;
    anRoll[1] = n1;

    anRoll[2] = anRoll[3] = ((n0 == n1) ? n0 : 0);

    ml.cMoves = ml.cMaxMoves = ml.cMaxPips = ml.iMoveBest = 0;
    ml.amMoves = gMoves;

    GenerateMovesSub(ml, anRoll, 0, 23, 0, anBoard, anMoves, fPartial);

    if (anRoll[0] != anRoll[1]) {
		anRoll[0] = n1;
		anRoll[1] = n0;

        GenerateMovesSub(ml, anRoll, 0, 23, 0, anBoard, anMoves, fPartial);
    }

	ml.amMoves = ml.amMoves.slice(0, ml.cMoves).map(i => Object.clone(i));

    return ml.cMoves;
}

function LegalMove(anBoard, iSrc, nPips) {

    let nBack;
    const iDest = iSrc - nPips;

    if (iDest >= 0) {           /* Here we can do the Chris rule check */
        return (anBoard[0][23 - iDest] < 2);
    }
    /* otherwise, attempting to bear off */

    for (nBack = 24; nBack > 0; nBack--)
        if (anBoard[1][nBack] > 0)
            break;

    return (nBack <= 5 && (iSrc == nBack || iDest == -1));
}

function GenerateMovesSub(ml, anRoll, nMoveDepth, iPip, cPip, anBoard, anMoves, fPartial) {
	let i, fUsed = false;

	if (nMoveDepth > 3 || !anRoll[nMoveDepth])
        return true;

	let anBoardNew =  initBoard();

	if (anBoard[1][24]) {       /* on bar */
		if (anBoard[0][anRoll[nMoveDepth] - 1] >= 2)
			return true;

		anMoves[nMoveDepth * 2] = 24;
		anMoves[nMoveDepth * 2 + 1] = 24 - anRoll[nMoveDepth];

		for (i = 0; i < 25; i++) {
			anBoardNew[0][i] = anBoard[0][i];
			anBoardNew[1][i] = anBoard[1][i];
		}

		ApplySubMove(anBoardNew, 24, anRoll[nMoveDepth], true);

		if (GenerateMovesSub(ml, anRoll, nMoveDepth + 1, 23, cPip +
			anRoll[nMoveDepth], anBoardNew, anMoves, fPartial)) {

			SaveMoves(ml, nMoveDepth + 1, cPip + anRoll[nMoveDepth], anMoves, anBoardNew, fPartial);

		}

		return fPartial;
	}
	else {
		for (i = iPip; i >= 0; i--)
            if (anBoard[1][i] && LegalMove(anBoard, i, anRoll[nMoveDepth])) {
                anMoves[nMoveDepth * 2] = i;
                anMoves[nMoveDepth * 2 + 1] = i - anRoll[nMoveDepth];

				anBoardNew = cloneBoard(anBoard);
                // memcpy(anBoardNew, anBoard, sizeof(anBoardNew));

                ApplySubMove(anBoardNew, i, anRoll[nMoveDepth], true);

                if (GenerateMovesSub(ml, anRoll, nMoveDepth + 1,
                                     anRoll[0] == anRoll[1] ? i : 23,
                                     cPip + anRoll[nMoveDepth], anBoardNew, anMoves, fPartial))
                    SaveMoves(ml, nMoveDepth + 1, cPip +
                              anRoll[nMoveDepth], anMoves, anBoardNew, fPartial);

                fUsed = 1;
            }
	}

	return !fUsed || fPartial;
}

function ApplySubMove(anBoard, iSrc, nRoll, fCheckLegal) {

    const iDest = iSrc - nRoll;

    if (fCheckLegal && (nRoll < 1 || nRoll > 6)) {
        /* Invalid dice roll */
        // errno = EINVAL;
        return -1;
    }

    if (iSrc < 0 || iSrc > 24 || iDest > 24 || anBoard[1][iSrc] < 1) {
        /* Invalid point number, or source point is empty */
        // errno = EINVAL;
        return -1;
    }

    anBoard[1][iSrc]--;

    if (iDest < 0)
        return 0;

    if (anBoard[0][23 - iDest]) {
        if (anBoard[0][23 - iDest] > 1) {
            /* Trying to move to a point already made by the opponent */
            // errno = EINVAL;
            return -1;
        }
        anBoard[1][iDest] = 1;
        anBoard[0][23 - iDest] = 0;
        anBoard[0][24]++;
    } else
        anBoard[1][iDest]++;

    return 0;
}

function SaveMoves(ml, cMoves, cPip, anMoves, anBoard, fPartial)
{
    let i, j;

    let m =  {
		anMove: new Uint8Array(8).fill(0),
		key: initKey(),
		cMoves: 0, cPips: 0,
   
		/* scores for this move */
		rScore: 0, rScore2: 0,
		/* evaluation for this move */
		arEvalMove: [],
		arEvalStdDev: []
	};

	const key = initKey();

    if (fPartial) {
        /* Save all moves, even incomplete ones */
        if (cMoves > ml.cMaxMoves)
            ml.cMaxMoves = cMoves;

        if (cPip > ml.cMaxPips)
            ml.cMaxPips = cPip;
    } else {
        /* Save only legal moves: if the current move moves plays less
         * chequers or pips than those already found, it is illegal; if
         * it plays more, the old moves are illegal. */
        if (cMoves < ml.cMaxMoves || cPip < ml.cMaxPips)
            return;

        if (cMoves > ml.cMaxMoves || cPip > ml.cMaxPips)
            ml.cMoves = 0;

        ml.cMaxMoves = cMoves;
        ml.cMaxPips = cPip;
    }

    m = ml.amMoves[ml.cMoves];

    PositionKey(anBoard, key);

    for (i = 0; i < ml.cMoves; i++) {
        const m = ml.amMoves[i];

        if (EqualKeys(key, m.key)) {
            if (cMoves > m.cMoves || cPip > m.cPips) {
                for (j = 0; j < cMoves * 2; j++)
                    m.anMove[j] = anMoves[j] > -1 ? anMoves[j] : -1;

                if (cMoves < 4)
                    m.anMove[cMoves * 2] = -1;

                m.cMoves = cMoves;
                m.cPips = cPip;
            }

            return;
        }
    }

    for (i = 0; i < cMoves * 2; i++)
        m.anMove[i] = anMoves[i] > -1 ? anMoves[i] : -1;

    if (cMoves < 4)
        m.anMove[cMoves * 2] = -1;

    CopyKey(key, m.key);

    m.cMoves = cMoves;
    m.cPips = cPip;
    m.cmark = CMark.CMARK_NONE;

    for (i = 0; i < NUM_OUTPUTS; i++)
        m.arEvalMove[i] = 0.0;

    ml.cMoves++;

    // g_assert(pml->cMoves < MAX_INCOMPLETE_MOVES);
}



function CopyKey(ks, kd) {
	kd[0]=ks[0],kd[1]=ks[1],kd[2]=ks[2],kd[3]=ks[3],kd[4]=ks[4],kd[5]=ks[5],kd[6]=ks[6];
}

function Noise(ec, anBoard, iOutput) {
    let r;

    if (ec.fDeterministic) {
        let auchBoard, auch;
        let i;

        for (i = 0; i < 25; i++) {
            auchBoard[i << 1] = anBoard[0][i];
            auchBoard[(i << 1) + 1] = anBoard[1][i];
        }

        auchBoard[0] += iOutput;
		auch = md5(auchBoard, null, true);
        // md5_buffer(auchBoard, 50, auch);

        /* We can't use a Box-Muller transform here, because generating
         * a point in the unit circle requires a potentially unbounded
         * number of integers, and all we have is the board.  So we
         * just take the sum of the bytes in the hash, which (by the
         * central limit theorem) should have a normal-ish distribution. */

        r = 0.0;
        for (i = 0; i < 16; i++)
            r += auch[i];

        r -= 2040.0;
        r /= 295.6;
    } else {
        /* Box-Muller transform of a point in the unit circle. */
        let x, y;

        do {
            // x = (float) irand(&rc) * 2.0 / UB4MAXVAL - 1.0;
            x = (Math.random() * 0xffffffff) * 2.0 / UB4MAXVAL - 1.0;
            y = (Math.random() * 0xffffffff) * 2.0 / UB4MAXVAL - 1.0;
            r = x * x + y * y;
        } while (r > 1.0 || r == 0.0);

        r = y * Math.sqrt(-2.0 * Math.log(r) / r);
    }

    r *= ec.rNoise;

    if (iOutput == OUTPUT_WINGAMMON || iOutput == OUTPUT_LOSEGAMMON)
        r *= 0.25;
    else if (iOutput == OUTPUT_WINBACKGAMMON || iOutput == OUTPUT_LOSEBACKGAMMON)
        r *= 0.01;

    return r;
}

function EvalKey(ec, nPlies, ci, fCubefulEquity) {

    var iKey;
    /*
     * Bit 00-03: nPlies
     * Bit 04   : fCubeful
     * Bit 05   : fMove
     * Bit 06   : fUsePrune
     * Bit 07-12: anScore[ 0 ]
     * Bit 13-18: anScore[ 1 ]
     * Bit 19-22: log2(nCube)
     * Bit 23-24: fCubeOwner
     * Bit 25   : fCrawford
     * Bit 26   : fJacoby
     * Bit 27   : fBeavers
     */

    iKey = (nPlies | (ec.fCubeful << 4) | (ci.fMove << 5));

    if (nPlies)
        iKey ^= ((ec.fUsePrune) << 6);


    if (nPlies || fCubefulEquity) {
        /* In match play, the score and cube value and position are important. */
        if (ci.nMatchTo)
            iKey ^=
                ((ci.nMatchTo - ci.anScore[ci.fMove] - 1) << 7) ^
                ((ci.nMatchTo - ci.anScore[1 - ci.fMove] - 1) << 13) ^
                (LogCube(ci.nCube) << 19) ^
                ((ci.fCubeOwner < 0 ? 2 : ci.fCubeOwner == ci.fMove) << 23) ^ (ci.fCrawford << 25);
        else if (ec.fCubeful || fCubefulEquity)
            /* in cubeful money games the cube position and rules are important. */
            iKey ^=
                ((ci.fCubeOwner < 0 ? 2 :
                  ci.fCubeOwner == ci.fMove) << 23) ^ (ci.fJacoby << 26) ^ (ci.fBeavers << 27);

        if (fCubefulEquity)
            iKey ^= 0x6a47b47e;
    }

    return iKey;

}


function LogCube(n) {
    let i = 0;

    while (n >>= 1)
        i++;

    return i;
}

function msb32(n) {
    let b = 0;

	const step = x => { if (n >= 1 << x) b += x, n >>= x };
    step(16);
    step(8);
    step(4);
    step(2);
    step(1);

    return b;
}

function ComputeTable0() {
    let i, c, n0, n1;

    for (i = 0; i < 0x1000; i++) {
        c = 0;

        for (n0 = 0; n0 <= 5; n0++)
            for (n1 = 0; n1 <= n0; n1++)
                if (!(i & (1 << (n0 + n1 + 1))) && !((i & (1 << n0)) && (i & (1 << n1))))
                    c += (n0 == n1) ? 1 : 2;

        anEscapes[i] = c;
    }
}

function Escapes(anBoard, n) {

    let i, af = 0, m;

    m = (n < 12) ? n : 12;

    for (i = 0; i < m; i++)
        af |= (anPoint[anBoard[24 + i - n]] << i);

    return anEscapes[af];
}

function ComputeTable1() {
    let i, c, n0, n1, low;

    anEscapes1[0] = 0;

    for (i = 1; i < 0x1000; i++) {
        c = 0;

        low = 0;
        while (!(i & (1 << low))) {
            ++low;
        }

        for (n0 = 0; n0 <= 5; n0++)
            for (n1 = 0; n1 <= n0; n1++) {

                if ((n0 + n1 + 1 > low) && !(i & (1 << (n0 + n1 + 1))) && !((i & (1 << n0)) && (i & (1 << n1)))) {
                    c += (n0 == n1) ? 1 : 2;
                }
            }

        anEscapes1[i] = c;
    }
}

function Escapes1(anBoard, n) {

    let i, af = 0, m;

    m = (n < 12) ? n : 12;

    for (i = 0; i < m; i++)
        af |= (anPoint[anBoard[24 + i - n]] << i);

    return anEscapes1[af];
}

function ComputeTable() {
    ComputeTable0();
    ComputeTable1();

	console.groupCollapsed('Compute table');
	console.debug(anEscapes[0], anEscapes[anEscapes.length - 1]);
	console.debug(anEscapes1[0], anEscapes1[anEscapes1.length - 1]);
	console.groupEnd();
}

function GetECF3(arCubeful, cci, arCf, aci) {

    let i, ici;
    let rND, rDT, r = { rDP: 0 };

    for (ici = 0, i = 0; ici < cci; ici++, i += 2) {

        if (aci[i + 1].nCube > 0) {

            /* cube available */

            rND = arCf[i];

            if (aci[0].nMatchTo)
                rDT = arCf[i + 1];
            else
                rDT = 2.0 * arCf[i + 1];

            GetDPEq(r, aci[i]);

            if (rDT >= rND && r.rDP >= rND) {

                /* double */

                if (rDT >= r.rDP)
                    /* pass */
                    arCubeful[ici] = r.rDP;
                else
                    /* take */
                    arCubeful[ici] = rDT;

            } else {

                /* no double */

                arCubeful[ici] = rND;

            }


        } else {

            /* no cube available: always no double */

            arCubeful[ici] = arCf[i];

        }

    }

}

function fDoCubeful(ci) {

    if (ci.anScore[0] + ci.nCube >= ci.nMatchTo && ci.anScore[1] + ci.nCube >= ci.nMatchTo)
        /* cube is dead */
        return false;

    if (ci.anScore[0] == ci.nMatchTo - 2 && ci.anScore[1] == ci.nMatchTo - 2)
        /* score is -2,-2 */
        return false;

    if (ci.fCrawford)
        /* cube is dead in Crawford game */
        return false;

    return true;
}

function MoneyLive(rW, rL, p, ci) {

    if (ci.fCubeOwner == -1) {

        /* centered cube */
        let rTP = (rL - 0.5) / (rW + rL + 0.5);
        let rCP = (rL + 1.0) / (rW + rL + 0.5);

        if (p < rTP)
            /* linear interpolation between
             * (0,-rL) and ( rTP,-1) */
            return (ci.fJacoby) ? -1.0 : (-rL + (-1.0 + rL) * p / rTP);
        else if (p < rCP)
            /* linear interpolation between
             * (rTP,-1) and (rCP,+1) */
            return -1.0 + 2.0 * (p - rTP) / (rCP - rTP);
        else
            /* linear interpolation between
             * (rCP,+1) and (1,+rW) */
            return (ci.fJacoby) ? 1.0 : (+1.0 + (rW - 1.0) * (p - rCP) / (1.0 - rCP));

    } else if (ci.fCubeOwner == ci.fMove) {

        /* owned cube */

        /* cash point */
        let rCP = (rL + 1.0) / (rW + rL + 0.5);

        if (p < rCP)
            /* linear interpolation between
             * (0,-rL) and (rCP,+1) */
            return -rL + (1.0 + rL) * p / rCP;
        else
            /* linear interpolation between
             * (rCP,+1) and (1,+rW) */
            return +1.0 + (rW - 1.0) * (p - rCP) / (1.0 - rCP);

    } else {

        /* unavailable cube */

        /* take point */
        let rTP = (rL - 0.5) / (rW + rL + 0.5);

        if (p < rTP)
            /* linear interpolation between
             * (0,-rL) and ( rTP,-1) */
            return -rL + (-1.0 + rL) * p / rTP;
        else
            /* linear interpolation between
             * (rTP,-1) and (1,rW) */
            return -1.0 + (rW + 1.0) * (p - rTP) / (1.0 - rTP);

    }

}

function GetDPEq(r, ci) {

	let fCube, fPostCrawford;

    if (!ci.nMatchTo) {

        /* Money game:
         * Double, pass equity for money game is 1.0 points, since we always
         * calculate equity normed to a 1-cube.
         * Take the double branch if the cube is centered or I own the cube. */

        if ('rDPEq' in r)
             r.rDPEq = 1.0;

        fCube = (ci.fCubeOwner == -1) || (ci.fCubeOwner == ci.fMove);

		if ('fCube' in r)
			r.fCube = fCube;
    } else {

        /* Match play:
         * Equity for double, pass is found from the match equity table.
         * Take the double branch is I can/will use cube:
         * - if it is not the Crawford game,
         * - and if the cube is not dead,
         * - and if it is post-Crawford and I'm trailing
         * - and if I have access to the cube.
         */

        /* FIXME: equity for double, pass */
        fPostCrawford = !ci.fCrawford &&
            (ci.anScore[0] == ci.nMatchTo - 1 || ci.anScore[1] == ci.nMatchTo - 1);

        fCube = (!ci.fCrawford) &&
            (ci.anScore[ci.fMove] + ci.nCube < ci.nMatchTo) &&
            (!(fPostCrawford && (ci.anScore[ci.fMove] == ci.nMatchTo - 1)))
            && ((ci.fCubeOwner == -1) || (ci.fCubeOwner == ci.fMove));

        if ('rDPEq' in r)
            r.rDPEq =
                getME(ci.anScore[0], ci.anScore[1], ci.nMatchTo,
                      ci.fMove, ci.nCube, ci.fMove, ci.fCrawford, aafMET, aafMETPostCrawford);

        if ('fCube' in r)
            r.fCube = fCube;

    }

    return fCube;

}

function EvalBearoff2(anBoard, arOutput, bgv, nnStates) {
	return bc2 ? BearoffEval(bc2, anBoard, arOutput) : 0;
}

function EvalBearoff1(anBoard, arOutput, bgv, nnStates) {
    return bc1 ? BearoffEval(bc1, anBoard, arOutput) : 0;
}

function raceBGprob(anBoard, side, bgv) {
    let totMenHome = 0
		, totPipsOp = 0
    	, i
    	, dummy = initBoard();

    for (i = 0; i < 6; ++i) {
        totMenHome += anBoard[side][i];
    }

    for (i = 22; i >= 18; --i) {
        totPipsOp += anBoard[1 - side][i] * (i - 17);
    }

    if (!((totMenHome + 3) / 4 - (side == 1 ? 1 : 0) <= (totPipsOp + 2) / 3)) {
        return 0.0;
    }

    for (i = 0; i < 25; ++i) {
        dummy[side][i] = anBoard[side][i];
    }

    for (i = 0; i < 6; ++i) {
        dummy[1 - side][i] = anBoard[1 - side][18 + i];
    }

    for (i = 6; i < 25; ++i) {
        dummy[1 - side][i] = 0;
    }

    {
        let p = 0.0;
        let bgp = getRaceBGprobs(dummy[1 - side]);
        if (bgp && bc1) {
            let k = PositionBearoff(anBoard[side], bc1.nPoints, bc1.nChequers)
            	, aProb = new Uint16Array(32)
				, j
				, scale = (side == 0) ? 36 : 1;

            BearoffDist(bc1, k, null, null, null, aProb, null);

            for (j = 1 - side; j < RBG_NPROBS; j++) {
                let sum = 0;
                scale *= 36;
                for (i = 1; i <= j + side; ++i) {
                    sum += aProb[i];
                }
                p += bgp[j] / scale * sum;
            }

            p /= 65535.0;

        } else {
            let ap = new Float32Array(5).fill(0);

            if (PositionBearoff(dummy[0], 6, 15) > 923 || PositionBearoff(dummy[1], 6, 15) > 923) {
                EvalBearoff1(dummy, ap, bgv, null);
            } else {
                EvalBearoff2(dummy, ap, bgv, null);
            }

            p = (side == 1 ? ap[0] : 1 - ap[0]);
        }

        return Math.min(p, 1.0);
    }
}

function EvalRaceBG(anBoard, arOutput, bgv) 
/* anBoard[1] is on roll */
{
    /* total men for side not on roll */
    let totMen0 = 0;

	/* total men for side on roll */
	let totMen1 = 0;

    /* a set flag for every possible outcome */
    let any = 0;

    let i;

    for (i = 23; i >= 0; --i) {
        totMen0 += anBoard[0][i];
        totMen1 += anBoard[1][i];
    }

    if (totMen1 == 15) {
        any |= OG_POSSIBLE;
    }

    if (totMen0 == 15) {
        any |= G_POSSIBLE;
    }

    if (any) {
        if (any & OG_POSSIBLE) {
            for (i = 23; i >= 18; --i) {
                if (anBoard[1][i] > 0) {
                    break;
                }
            }
            if (i >= 18) {
                any |= OBG_POSSIBLE;
            }
        }

        if (any & G_POSSIBLE) {
            for (i = 23; i >= 18; --i) {
                if (anBoard[0][i] > 0) {
                    break;
                }
            }

            if (i >= 18) {
                any |= BG_POSSIBLE;
            }
        }
    }

    if (any & (BG_POSSIBLE | OBG_POSSIBLE)) {
        /* side that can have the backgammon */
        let side = (any & BG_POSSIBLE) ? 1 : 0;

        let pr = raceBGprob(anBoard, side, bgv);

        if (pr > 0.0) {
            if (side == 1) {
                arOutput[OUTPUT_WINBACKGAMMON] = pr;

                if (arOutput[OUTPUT_WINGAMMON] < arOutput[OUTPUT_WINBACKGAMMON]) {
                    arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_WINBACKGAMMON];
                }
            } else {
                arOutput[OUTPUT_LOSEBACKGAMMON] = pr;

                if (arOutput[OUTPUT_LOSEGAMMON] < arOutput[OUTPUT_LOSEBACKGAMMON]) {
                    arOutput[OUTPUT_LOSEGAMMON] = arOutput[OUTPUT_LOSEBACKGAMMON];
                }
            }
        } else {
            if (side == 1) {
                arOutput[OUTPUT_WINBACKGAMMON] = 0.0;
            } else {
                arOutput[OUTPUT_LOSEBACKGAMMON] = 0.0;
            }
        }
    }
}

function EvalRace(anBoard, arOutput, bgv, nnStates) {
    const arInput = new Float32Array(NUM_RACE_INPUTS);

    CalculateRaceInputs(anBoard, arInput);

    if (NeuralNetEvaluate(nnRace, arInput, arOutput, nnStates ? nnStates + (PositionClass.CLASS_RACE - PositionClass.CLASS_RACE) : null))
        return -1;

    /* special evaluation of backgammons overrides net output */

    EvalRaceBG(anBoard, arOutput, bgv);

    /* sanity check will take care of rest */

    return 0;
}

function EvalContact(anBoard, arOutput, bgv, nnStates) {
    const arInput = new Float32Array(NUM_INPUTS);

    CalculateContactInputs(anBoard, arInput);

    return NeuralNetEvaluate(nnContact, arInput, arOutput, nnStates ? nnStates[PositionClass.CLASS_CONTACT - PositionClass.CLASS_RACE] : null);
}

function EvalCrashed(anBoard, arOutput,bgv, nnStates) {
    const arInput = new Float32Array(NUM_INPUTS);

    CalculateCrashedInputs(anBoard, arInput);

    return NeuralNetEvaluate(nnCrashed, arInput, arOutput, nnStates ? nnStates[PositionClass.CLASS_CRASHED - PositionClass.CLASS_RACE] : null);
}

function EvalOver(anBoard, arOutput, bgv) {
    let i, c;
    let n = anChequers[bgv];

    for (i = 0; i < 25; i++)
        if (anBoard[0][i])
            break;

    if (i == 25) {
        /* opponent has no pieces on board; player has lost */
        arOutput[OUTPUT_WIN] = arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_WINBACKGAMMON] = 0.0;

        for (i = 0, c = 0; i < 25; i++)
            c += anBoard[1][i];

        if (c == n) {
            /* player still has all pieces on board; loses gammon */
            arOutput[OUTPUT_LOSEGAMMON] = 1.0;

            for (i = 18; i < 25; i++)
                if (anBoard[1][i]) {
                    /* player still has pieces in opponent's home board;
                     * loses backgammon */
                    arOutput[OUTPUT_LOSEBACKGAMMON] = 1.0;

                    return 0;
                }

            arOutput[OUTPUT_LOSEBACKGAMMON] = 0.0;

            return 0;
        }

        arOutput[OUTPUT_LOSEGAMMON] = arOutput[OUTPUT_LOSEBACKGAMMON] = 0.0;

        return 0;
    }

    for (i = 0; i < 25; i++)
        if (anBoard[1][i])
            break;

    if (i == 25) {
        /* player has no pieces on board; wins */
        arOutput[OUTPUT_WIN] = 1.0;
        arOutput[OUTPUT_LOSEGAMMON] = arOutput[OUTPUT_LOSEBACKGAMMON] = 0.0;

        for (i = 0, c = 0; i < 25; i++)
            c += anBoard[0][i];

        if (c == n) {
            /* opponent still has all pieces on board; win gammon */
            arOutput[OUTPUT_WINGAMMON] = 1.0;

            for (i = 18; i < 25; i++)
                if (anBoard[0][i]) {
                    /* opponent still has pieces in player's home board;
                     * win backgammon */
                    arOutput[OUTPUT_WINBACKGAMMON] = 1.0;

                    return 0;
                }

            arOutput[OUTPUT_WINBACKGAMMON] = 0.0;

            return 0;
        }

        arOutput[OUTPUT_WINGAMMON] = arOutput[OUTPUT_WINBACKGAMMON] = 0.0;
    }

    return 0;

}

function MakeCubePos(aciCubePos, cci, fTop, aci, fInvert) {
    let i, ici;

    for (ici = 0, i = 0; ici < cci; ici++) {

        /* no double */

        if (aciCubePos[ici].nCube > 0) {

            SetCubeInfo(aci[i],
                        aciCubePos[ici].nCube,
                        aciCubePos[ici].fCubeOwner,
                        fInvert ?
                        1 - aciCubePos[ici].fMove : aciCubePos[ici].fMove,
                        aciCubePos[ici].nMatchTo,
                        aciCubePos[ici].anScore,
                        aciCubePos[ici].fCrawford,
                        aciCubePos[ici].fJacoby, aciCubePos[ici].fBeavers, aciCubePos[ici].bgv);

        } else {

            aci[i].nCube = -1;

        }

        i++;

        if (!fTop && aciCubePos[ici].nCube > 0 && GetDPEq({}, aciCubePos[ici]))
            /* we may double */
            SetCubeInfo(aci[i],
                        2 * aciCubePos[ici].nCube,
                        1 - aciCubePos[ici].fMove,
                        fInvert ?
                        1 - aciCubePos[ici].fMove : aciCubePos[ici].fMove,
                        aciCubePos[ici].nMatchTo,
                        aciCubePos[ici].anScore,
                        aciCubePos[ici].fCrawford,
                        aciCubePos[ici].fJacoby, aciCubePos[ici].fBeavers, aciCubePos[ici].bgv);
        else
            /* mark cube position as unavailable */
            aci[i].nCube = -1;

        i++;


    }                           /* loop cci */

}

function GetCubePrimeValue(i, j, nCubeValue) {

    if ((i < 2 * nCubeValue) && (j >= 2 * nCubeValue))

        /* automatic double */

        return 2 * nCubeValue;
    else
        return nCubeValue;

}

function GetPoints(arOutput, ci, arCP) {

    /*
     * Input:
     * - arOutput: we need the gammon and backgammon ratios
     *   (we assume arOutput is evaluate for pci -> fMove)
     * - anScore: the current score.
     * - nMatchTo: matchlength
     * - pci: value of cube, who's turn is it
     * 
     *
     * Output:
     * - arCP : cash points with live cube
     * These points are necessary for the linear
     * interpolation used in cubeless -> cubeful equity 
     * transformation.
     */

    /* Match play */

    /* normalize score */

    let i = ci.nMatchTo - ci.anScore[0] - 1;
    let j = ci.nMatchTo - ci.anScore[1] - 1;

    let nCube = ci.nCube;

    let arCPLive = [new Float32Array(MAXCUBELEVEL), new Float32Array(MAXCUBELEVEL)]
    	, arCPDead = [new Float32Array(MAXCUBELEVEL), new Float32Array(MAXCUBELEVEL)]
		, arG = new Float32Array(2)
		, arBG = Float32Array(2)
		;

    let rDP, rRDP, rDTW, rDTL;

    let nDead, n, nMax, nCubeValue, k;


    let aarMETResults = [
		new Float32Array(MetIndeces.DTLBP1 + 1),
		new Float32Array(MetIndeces.DTLBP1 + 1)
	];

    /* Gammon and backgammon ratio's. 
     * Avoid division by zero in extreme cases. */

    if (!ci.fMove) {

        /* arOutput evaluated for player 0 */

        if (arOutput[OUTPUT_WIN] > 0.0) {
            arG[0] = (arOutput[OUTPUT_WINGAMMON] - arOutput[OUTPUT_WINBACKGAMMON]) / arOutput[OUTPUT_WIN];
            arBG[0] = arOutput[OUTPUT_WINBACKGAMMON] / arOutput[OUTPUT_WIN];
        } else {
            arG[0] = 0.0;
            arBG[0] = 0.0;
        }

        if (arOutput[OUTPUT_WIN] < 1.0) {
            arG[1] = (arOutput[OUTPUT_LOSEGAMMON] - arOutput[OUTPUT_LOSEBACKGAMMON]) / (1.0 - arOutput[OUTPUT_WIN]);
            arBG[1] = arOutput[OUTPUT_LOSEBACKGAMMON] / (1.0 - arOutput[OUTPUT_WIN]);
        } else {
            arG[1] = 0.0;
            arBG[1] = 0.0;
        }

    } else {

        /* arOutput evaluated for player 1 */

        if (arOutput[OUTPUT_WIN] > 0.0) {
            arG[1] = (arOutput[OUTPUT_WINGAMMON] - arOutput[OUTPUT_WINBACKGAMMON]) / arOutput[OUTPUT_WIN];
            arBG[1] = arOutput[OUTPUT_WINBACKGAMMON] / arOutput[OUTPUT_WIN];
        } else {
            arG[1] = 0.0;
            arBG[1] = 0.0;
        }

        if (arOutput[OUTPUT_WIN] < 1.0) {
            arG[0] = (arOutput[OUTPUT_LOSEGAMMON] - arOutput[OUTPUT_LOSEBACKGAMMON]) / (1.0 - arOutput[OUTPUT_WIN]);
            arBG[0] = arOutput[OUTPUT_LOSEBACKGAMMON] / (1.0 - arOutput[OUTPUT_WIN]);
        } else {
            arG[0] = 0.0;
            arBG[0] = 0.0;
        }
    }

    /* Find out what value the cube has when you or your
     * opponent give a dead cube. */

    nDead = nCube;
    nMax = 0;

    while ((i >= 2 * nDead) && (j >= 2 * nDead)) {
        nMax++;
        nDead *= 2;
    }

    for (nCubeValue = nDead, n = nMax; n >= 0; nCubeValue >>= 1, n--) {

        /* Calculate dead and live cube cash points.
         * See notes by me (Joern Thyssen) available from the
         * 'doc' directory.  (FIXME: write notes :-) ) */

        /* Even though it's a dead cube we take account of the opponents
         * automatic redouble. */

        /* Dead cube cash point for player 0 */

        getMEMultiple(ci.anScore[0], ci.anScore[1], ci.nMatchTo, nCubeValue, GetCubePrimeValue(i, j, nCubeValue), /* 0 */
                      GetCubePrimeValue(j, i, nCubeValue),      /* 1 */
                      ci.fCrawford, aafMET, aafMETPostCrawford, aarMETResults[0], aarMETResults[1]);

        for (k = 0; k < 2; k++) {



            /* Live cube cash point for player */

            if ((i < 2 * nCubeValue) || (j < 2 * nCubeValue)) {

                rDTL = (1.0 - arG[!k] - arBG[!k]) * aarMETResults[k][k ? DTLP1 : DTLP0]
                    + arG[!k] * aarMETResults[k][k ? DTLGP1 : DTLGP0]
                    + arBG[!k] * aarMETResults[k][k ? DTLBP1 : DTLBP0];


                rDP = aarMETResults[k][DP];

                rDTW = (1.0 - arG[k] - arBG[k]) * aarMETResults[k][k ? DTWP1 : DTWP0]
                    + arG[k] * aarMETResults[k][k ? DTWGP1 : DTWGP0]
                    + arBG[k] * aarMETResults[k][k ? DTWBP1 : DTWBP0];

                arCPDead[k][n] = (rDTL - rDP) / (rDTL - rDTW);

                /* The doubled cube is going to be dead */
                arCPLive[k][n] = arCPDead[k][n];

            } else {

                /* Doubled cube is alive */

                /* redouble, pass */
                rRDP = aarMETResults[k][DTL];

                /* double, pass */
                rDP = aarMETResults[k][DP];

                /* double, take win */

                rDTW = (1.0 - arG[k] - arBG[k]) * aarMETResults[k][DTW]
                    + arG[k] * aarMETResults[k][DTWG]
                    + arBG[k] * aarMETResults[k][DTWB];

                arCPLive[k][n] = 1.0 - arCPLive[!k][n + 1] * (rDP - rDTW) / (rRDP - rDTW);

            }

        }                       /* loop k */

    }

    /* return cash point for current cube level */

    arCP[0] = arCPLive[0][0];
    arCP[1] = arCPLive[1][0];



    return 0;

}

function PipCount(anBoard, anPips) {

    anPips[0] = 0;
    anPips[1] = 0;

    for (let i = 0; i < 25; i++) {
        anPips[0] += anBoard[0][i] * (i + 1);
        anPips[1] += anBoard[1][i] * (i + 1);
    }
}

function newArray(n, init) {
	const a = new Array(n);

	for (let i = 0; i < n; ++i)
		a[i] = init();

	return a;	
}