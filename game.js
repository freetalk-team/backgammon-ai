import './utils.js';

import { IndexDB } from './db.js';
import { init, newState, aiMove, move } from './play.js';


export default class Game {

	#db = new Database;
	#state = newState();

	get turn() { return this.#state.fTurn ? 'AI' : 'HUMAN'; }

	async init() {

		let r;

		try {

			await this.#db.init();

			const { content } = await this.#db.get('data', 'gnubg.wd');
			// const weightsBufferBinary = await this.#db.get('data', 'gnubg.wd');

			console.debug('Content', content);

			const reader = new Reader(content);

			init(reader);

		}
		catch (e) {
			console.error('Failed to load data', e);
		}
	}

	reset(color, board) {
		this.#state = newState(color, board);
	}

	switchTurn() {
		const current = this.#state.fTurn;
		this.#state.fTurn = 1 - current;

		console.debug('AI switch turn', current, '=>', this.turn);
	}

	move(dicesOrMove, ai=false) {

		if (ai) return aiMove(this.#state, dicesOrMove);

		move(this.#state, dicesOrMove);
	}

	reset() {
		this.#state = newState();
	}
}

class Database extends IndexDB {

	get name() { return 'backgammon'; }

	async setup() {

		try {
			// await pull('gnubg.weights');
			await pull(this, 'gnubg.wd');
		}
		catch (e) {
			console.error('Failed to pull data', e);
		}
	}

	onUpgrade(db, txn, ver) {
		switch (ver) {
		
			case 0:
			Database.addTable(db, 'data');
			break;
		}
	}
}


async function pull(db, file) {
	const res = await fetch(`/data/${file}`, {
		// Adding Get request
		method: "GET",

		// Setting headers
		headers: {
			'Content-Type': 'application/octet-stream',
		},
		// Setting response type to arraybuffer 
		responseType: "arraybuffer"
	});

	const buffer = await res.arrayBuffer();
	const data = { id: file, content: buffer };

	console.debug('SETUP', data);

	await db.put('data', data);
}

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