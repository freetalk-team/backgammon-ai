
import fs from 'fs';

import './utils.js';
import { init, newState, aiMove, move } from './play.js';

class Reader {

	static LE = true;

	#buf;
	#p = 0;

	constructor(buffer) {
		this.#buf = new DataView(buffer);
	}

	readInt32() {
		const v = this.#buf.getInt32(this.#p, Reader.LE);
		this.#p += 4;
		return v;
	}

	readUint32() {
		const v = this.#buf.getUint32(this.#p, Reader.LE);
		this.#p += 4;
		return v;
	}

	readFloat32() {
		const v = this.#buf.getFloat32(this.#p, Reader.LE);
		this.#p += 4;
		return v;
	}

	readFloat32Array(n) {


		n *= 4;

		const buffer = this.#buf.buffer.slice(this.#p, this.#p + n);
		const a = new Float32Array(buffer);

		this.#p += n;

		return a;
	}

	skip(n) {
		this.#p += n;
	}
}

const data = fs.readFileSync('data/gnubg.wd');
console.log(data);

const buffer = data.buffer;
const reader = new Reader(buffer);

init(reader);

const state = newState('white', [0, 6, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2, -2, -3, -2, -2, -4, 2, 0]);

// move(state, [[7, 3], [5, 3]]);
aiMove(state, [6, 1]);

// move(state, [[7, 2], [5, 2]]);
// aiMove(state, [6, 1]);

// move(state, [[23, 22], [23, 21]]);
// aiMove(state, [4, 3]);

// console.debug(moves);


