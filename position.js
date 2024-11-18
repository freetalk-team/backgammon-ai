
export function PositionBearoff(anBoard, nPoints, nChequers) {
    let i, fBits, j;

    for (j = nPoints - 1, i = 0; i < nPoints; i++)
        j += anBoard[i];

    fBits = 1 << j;

    for (i = 0; i < nPoints - 1; i++) {
        j -= anBoard[i] + 1;
        fBits |= (1 << j);
    }

    return PositionF(fBits, nChequers + nPoints, nPoints);
}

export function PositionKey(anBoard, anpBoard) {


	for (let i = 0, j = 0; i < 3; i++, j += 8) {
		anpBoard[i] = anBoard[1][j] + (anBoard[1][j + 1] << 4)
			+ (anBoard[1][j + 2] << 8) + (anBoard[1][j + 3] << 12)
			+ (anBoard[1][j + 4] << 16) + (anBoard[1][j + 5] << 20)
			+ (anBoard[1][j + 6] << 24) + (anBoard[1][j + 7] << 28);
		anpBoard[i + 3] = anBoard[0][j] + (anBoard[0][j + 1] << 4)
			+ (anBoard[0][j + 2] << 8) + (anBoard[0][j + 3] << 12)
			+ (anBoard[0][j + 4] << 16) + (anBoard[0][j + 5] << 20)
			+ (anBoard[0][j + 6] << 24) + (anBoard[0][j + 7] << 28);
	}
	anpBoard[6] = anBoard[0][24] + (anBoard[1][24] << 4);

}

export function PositionFromKey(anBoard, anpBoard) {

	for (let i = 0, j = 0; i < 3; i++, j += 8) {
		anBoard[1][j] = anpBoard[i] & 0x0f;
		anBoard[1][j + 1] = (anpBoard[i] >> 4) & 0x0f;
		anBoard[1][j + 2] = (anpBoard[i] >> 8) & 0x0f;
		anBoard[1][j + 3] = (anpBoard[i] >> 12) & 0x0f;
		anBoard[1][j + 4] = (anpBoard[i] >> 16) & 0x0f;
		anBoard[1][j + 5] = (anpBoard[i] >> 20) & 0x0f;
		anBoard[1][j + 6] = (anpBoard[i] >> 24) & 0x0f;
		anBoard[1][j + 7] = (anpBoard[i] >> 28) & 0x0f;

		anBoard[0][j] = anpBoard[i + 3] & 0x0f;
		anBoard[0][j + 1] = (anpBoard[i + 3] >> 4) & 0x0f;
		anBoard[0][j + 2] = (anpBoard[i + 3] >> 8) & 0x0f;
		anBoard[0][j + 3] = (anpBoard[i + 3] >> 12) & 0x0f;
		anBoard[0][j + 4] = (anpBoard[i + 3] >> 16) & 0x0f;
		anBoard[0][j + 5] = (anpBoard[i + 3] >> 20) & 0x0f;
		anBoard[0][j + 6] = (anpBoard[i + 3] >> 24) & 0x0f;
		anBoard[0][j + 7] = (anpBoard[i + 3] >> 28) & 0x0f;
	}
	anBoard[0][24] = anpBoard[6] & 0x0f;
	anBoard[1][24] = (anpBoard[6] >> 4) & 0x0f;
}


export function PositionFromKeySwapped(anBoard, key) {
	const anpBoard = key;

	for (let i = 0, j = 0; i < 3; i++, j += 8) {
		anBoard[0][j] = anpBoard[i] & 0x0f;
		anBoard[0][j + 1] = (anpBoard[i] >> 4) & 0x0f;
		anBoard[0][j + 2] = (anpBoard[i] >> 8) & 0x0f;
		anBoard[0][j + 3] = (anpBoard[i] >> 12) & 0x0f;
		anBoard[0][j + 4] = (anpBoard[i] >> 16) & 0x0f;
		anBoard[0][j + 5] = (anpBoard[i] >> 20) & 0x0f;
		anBoard[0][j + 6] = (anpBoard[i] >> 24) & 0x0f;
		anBoard[0][j + 7] = (anpBoard[i] >> 28) & 0x0f;

		anBoard[1][j] = anpBoard[i + 3] & 0x0f;
		anBoard[1][j + 1] = (anpBoard[i + 3] >> 4) & 0x0f;
		anBoard[1][j + 2] = (anpBoard[i + 3] >> 8) & 0x0f;
		anBoard[1][j + 3] = (anpBoard[i + 3] >> 12) & 0x0f;
		anBoard[1][j + 4] = (anpBoard[i + 3] >> 16) & 0x0f;
		anBoard[1][j + 5] = (anpBoard[i + 3] >> 20) & 0x0f;
		anBoard[1][j + 6] = (anpBoard[i + 3] >> 24) & 0x0f;
		anBoard[1][j + 7] = (anpBoard[i + 3] >> 28) & 0x0f;
	}
	anBoard[1][24] = anpBoard[6] & 0x0f;
	anBoard[0][24] = (anpBoard[6] >> 4) & 0x0f;
}

export function EqualKeys(k1, k2) {
	return (k1[0]==k2[0]&&k1[1]==k2[1]&&k1[2]==k2[2]&&k1[3]==k2[3]&&k1[4]==k2[4]&&k1[5]==k2[5]&&k1[6]==k2[6]);
}

const MAX_N = 40;
const MAX_R = 2;

const anCombination = new Array(MAX_N);

let fCalculated = false;

function InitCombination() {
    let i, j;

    for (i = 0; i < MAX_N; i++) {
		anCombination[i] = new Uint32Array(MAX_R);
        anCombination[i][0] = i + 1;
	}

    for (j = 1; j < MAX_R; j++)
        anCombination[0][j] = 0;

    for (i = 1; i < MAX_N; i++)
        for (j = 1; j < MAX_R; j++)
            anCombination[i][j] = anCombination[i - 1][j - 1] + anCombination[i - 1][j];

    fCalculated = true;
}

function Combination(n, r) {
    // g_assert(n <= MAX_N && r <= MAX_R);

    if (!fCalculated)
        InitCombination();

    return anCombination[n - 1][r - 1];
}

function PositionF(fBits, n, r) {
    if (n == r)
        return 0;

    return (fBits & (1 << (n - 1))) ? Combination(n - 1, r) +
        PositionF(fBits, n - 1, r - 1) : PositionF(fBits, n - 1, r);
}

export function PositionIndex(g, anBoard) {
    let i, fBits;
    let j = g - 1;

    for (i = 0; i < g; i++)
        j += anBoard[i];

    fBits = 1 << j;

    for (i = 0; i < g - 1; i++) {
        j -= anBoard[i] + 1;
        fBits |= (1 << j);
    }

    /* FIXME: 15 should be replaced by nChequers, but the function is
     * only called from bearoffgammon, so this should be fine. */
    return PositionF(fBits, 15, g);
}