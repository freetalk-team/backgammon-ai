import { EqualKeys } from './position.js';
import { initKey } from './init.js';

export const CACHEHIT = 0xffffffff;

/* MurmurHash3  https://code.google.com/p/smhasher/wiki/MurmurHash */
export function GetHashKey(hashMask, e) {
    let hash = e.nEvalContext;

    hash *= 0xcc9e2d51;
    hash = (hash << 15) | (hash >> (32 - 15));
    hash *= 0x1b873593;

    hash = (hash << 13) | (hash >> (32 - 13));
    hash = hash * 5 + 0xe6546b64;

    for (let i = 0; i < 7; i++) {
        let k = e.key[i];

        k *= 0xcc9e2d51;
        k = (k << 15) | (k >> (32 - 15));
        k *= 0x1b873593;

        hash ^= k;
        hash = (hash << 13) | (hash >> (32 - 13));
        hash = hash * 5 + 0xe6546b64;
    }

    /* Real MurmurHash3 has a "hash ^= len" here,
     * but for us len is constant. Skip it */

    hash ^= hash >> 16;
    hash *= 0x85ebca6b;
    hash ^= hash >> 13;
    hash *= 0xc2b2ae35;
    hash ^= hash >> 16;

    return (hash & hashMask);
}

export function CacheCreate(c, s) {
	// if (s > 1 << 31)
    //     return -1;

    c.size = s;
    /* adjust size to smallest power of 2 GE to s */
    while ((s & (s - 1)) != 0)
        s &= (s - 1);

    c.size = (s < c.size) ? 2 * s : s;
    c.hashMask = (c.size >> 1) - 1;

	// c.entries = new Array(c.size / 2);
	c.entries = []
}

export function CacheLookup(pc, e, arOut, arCubeful) {
    const l = GetHashKey(pc.hashMask, e);

	let i = pc.entries[l];

	if (!i) {
		i = initCacheNode();
		pc.entries[l] = i;
	}

    if (!EqualKeys(i.nd_primary.key, e.key) || i.nd_primary.nEvalContext != e.nEvalContext) {       /* Not in primary slot */
        if (!EqualKeys(i.nd_secondary.key, e.key) || i.nd_secondary.nEvalContext != e.nEvalContext) {       /* Cache miss */
            return l;
        } else {                /* Found in second slot, promote "hot" entry */
            let tmp = i.nd_primary;

            i.nd_primary = i.nd_secondary;
            i.nd_secondary = tmp;
        }
    }

    /* Cache hit */
	arOut.set(i.nd_primary.ar.subarray(0, arOut.length));
	//arOut.splice(0, arOut.length, ...e.nd_primary.ar);

    // memcpy(arOut, pc.entries[l].nd_primary.ar, sizeof(float) * 5 /*NUM_OUTPUTS */ );
    //if (arCubeful)
     //   arCubeful = pc.entries[l].nd_primary.ar[5];   /* Cubeful equity stored in slot 5 */



    return CACHEHIT;
}

export function CacheAdd(pc, e, l) {

	let i = pc.entries[l];

	if (!i) {
		i = initCacheNode();
		pc.entries[l] = i;
	}

    i.nd_secondary = i.nd_primary;
    i.nd_primary = e;

}

function initCacheNode() {
	return {
		nd_primary: newCacheNode(),
		nd_secondary: newCacheNode()
	}
}

export function newCacheNode() {
	return {
		key: initKey(),
		nEvalContext: 0,
		ar: new Float32Array(6)
	};
}
