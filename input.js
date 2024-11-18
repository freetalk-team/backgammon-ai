
const inpvec = [
    new Float32Array([0.0, 0.0, 0.0, 0.0]),
    new Float32Array([1.0, 0.0, 0.0, 0.0]),
	new Float32Array([0.0, 1.0, 0.0, 0.0]),
	new Float32Array([0.0, 0.0, 1.0, 0.0]),
	new Float32Array([0.0, 0.0, 1.0, 0.5]),
	new Float32Array([0.0, 0.0, 1.0, 1.0]),
	new Float32Array([0.0, 0.0, 1.0, 1.5]),
	new Float32Array([0.0, 0.0, 1.0, 2.0]),
	new Float32Array([0.0, 0.0, 1.0, 2.5]),
	new Float32Array([0.0, 0.0, 1.0, 3.0]),
	new Float32Array([0.0, 0.0, 1.0, 3.5]),
	new Float32Array([0.0, 0.0, 1.0, 4.0]),
	new Float32Array([0.0, 0.0, 1.0, 4.5]),
	new Float32Array([0.0, 0.0, 1.0, 5.0]),
	new Float32Array([0.0, 0.0, 1.0, 5.5]),
	new Float32Array([0.0, 0.0, 1.0, 6.0])
];

const inpvecb = [
	new Float32Array([0.0, 0.0, 0.0, 0.0]),
	new Float32Array([1.0, 0.0, 0.0, 0.0]),
	new Float32Array([1.0, 1.0, 0.0, 0.0]),
	new Float32Array([1.0, 1.0, 1.0, 0.0]),
	new Float32Array([1.0, 1.0, 1.0, 0.5]),
	new Float32Array([1.0, 1.0, 1.0, 1.0]),
	new Float32Array([1.0, 1.0, 1.0, 1.5]),
	new Float32Array([1.0, 1.0, 1.0, 2.0]),
	new Float32Array([1.0, 1.0, 1.0, 2.5]),
	new Float32Array([1.0, 1.0, 1.0, 3.0]),
	new Float32Array([1.0, 1.0, 1.0, 3.5]),
	new Float32Array([1.0, 1.0, 1.0, 4.0]),
	new Float32Array([1.0, 1.0, 1.0, 4.5]),
	new Float32Array([1.0, 1.0, 1.0, 5.0]),
	new Float32Array([1.0, 1.0, 1.0, 5.5]),
	new Float32Array([1.0, 1.0, 1.0, 6.0])
];

export function baseInputs(anBoard, arInput)
{
    let j, i;

    for (j = 0; j < 2; ++j) {
        let afInput = arInput.subarray(j * 25 * 4);
        const board = anBoard[j];

        /* Points */
        for (i = 0; i < 24; i++) {
            const nc = board[i];

            afInput[i * 4 + 0] = inpvec[nc][0];
            afInput[i * 4 + 1] = inpvec[nc][1];
            afInput[i * 4 + 2] = inpvec[nc][2];
            afInput[i * 4 + 3] = inpvec[nc][3];
        }

        /* Bar */
        {
            const nc = board[24];

            afInput[24 * 4 + 0] = inpvecb[nc][0];
            afInput[24 * 4 + 1] = inpvecb[nc][1];
            afInput[24 * 4 + 2] = inpvecb[nc][2];
            afInput[24 * 4 + 3] = inpvecb[nc][3];
        }
    }
}