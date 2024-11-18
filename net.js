
export const NNEVAL_NONE = 0
    , NNEVAL_SAVE = 1
    , NNEVAL_FROMBASE = 2

    , NNSTATE_NONE = -1
    , NNSTATE_INCREMENTAL = 0
    , NNSTATE_DONE = 1
	;


function NNevalAction(nState) {
    if (!nState)
        return NNEVAL_NONE;

    switch (nState.state) {
    case NNSTATE_NONE:
        {
            /* incremental evaluation not useful */
            return NNEVAL_NONE;
        }
    case NNSTATE_INCREMENTAL:
        {
            /* next call should return FROMBASE */
            nState.state = NNSTATE_DONE;

            /* starting a new context; save base in the hope it will be useful */
            return NNEVAL_SAVE;
        }
    case NNSTATE_DONE:
        {
            /* context hit!  use the previously computed base */
            return NNEVAL_FROMBASE;
        }
    }
    /* never reached */
    return NNEVAL_NONE;         /* for the picky compiler */
}

function Evaluate(nn, arInput, ar, arOutput, saveAr)
{
    const cHidden = nn.cHidden;
    let i, j, k, n;
    let prWeight;

    /* Calculate activity at hidden nodes */
    for (i = 0; i < cHidden; i++)
        ar[i] = nn.arHiddenThreshold[i];

    prWeight = nn.arHiddenWeight;

    for (i = 0; i < nn.cInput; i++) {
        const ari = arInput[i];

        if (ari == 0.0) {
			prWeight = prWeight.subarray(cHidden);
		}
        else {

			n = 0;
			k = 0;

            if (ari == 1.0)
                for (j = cHidden; j; j--)
                    ar[n++] += prWeight[k++];
            else
                for (j = cHidden; j; j--)
                    ar[n++] += prWeight[k++] * ari;

			prWeight = prWeight.subarray(k);
        }
    }

    if (saveAr)
        //memcpy(saveAr, ar, cHidden * sizeof(*saveAr));
		saveAr.set(ar.subarray(0, cHidden));

    for (i = 0; i < cHidden; i++)
        ar[i] = sigmoid(-nn.rBetaHidden * ar[i]);

    /* Calculate activity at output nodes */
    prWeight = nn.arOutputWeight;

    for (i = 0, k = 0; i < nn.cOutput; i++) {
        let r = nn.arOutputThreshold[i];

        for (j = 0; j < cHidden; j++)
            r += ar[j] * prWeight[k++];

        arOutput[i] = sigmoid(-nn.rBetaOutput * r);
    }
}

function EvaluateFromBase(nn, arInputDif, ar, arOutput) {
    let i, j, k, n;
    let prWeight;

    /* Calculate activity at hidden nodes */
    /*    for( i = 0; i < nn.cHidden; i++ )
     * ar[ i ] = nn.arHiddenThreshold[ i ]; */

    prWeight = nn.arHiddenWeight;

    for (i = 0; i < nn.cInput; ++i) {
        const ari = arInputDif[i];

        if (ari == 0.0) {
			prWeight = prWeight.subarray(nn.cHidden);
		}
        else {

			n = 0;
			k = 0;

            if (ari == 1.0)
                for (j = nn.cHidden; j; j--)
                    ar[n++] += prWeight[k++];
            else if (ari == -1.0)
                for (j = nn.cHidden; j; j--)
					ar[n++] -= prWeight[k++];
            else
                for (j = nn.cHidden; j; j--)
					ar[n++] += prWeight[k++] * ari;

			prWeight = prWeight.subarray(k);
        }
    }

    for (i = 0; i < nn.cHidden; i++)
        ar[i] = sigmoid(-nn.rBetaHidden * ar[i]);

    /* Calculate activity at output nodes */
    prWeight = nn.arOutputWeight;

    for (i = 0, k = 0; i < nn.cOutput; i++) {
        let r = nn.arOutputThreshold[i];

        for (j = 0; j < nn.cHidden; j++)
            r += ar[j] * prWeight[k++];

        arOutput[i] = sigmoid(-nn.rBetaOutput * r);
    }
}


export function NeuralNetEvaluate(nn, arInput, arOutput, nState) {
	const ar = new Float32Array(nn.cHidden);
   
    switch (NNevalAction(nState)) {
    case NNEVAL_NONE:
        {
            Evaluate(nn, arInput, ar, arOutput, 0);
            break;
        }
    case NNEVAL_SAVE:
        {
            nState.cSavedIBase = nn.cInput;
            // memcpy(nState.savedIBase, arInput, nn.cInput * sizeof(*ar));
			nState.savedIBase = new Float32Array(arInput);

			if (!nState.savedBase)
				nState.savedBase = new Float32Array(nn.cHidden);

            Evaluate(nn, arInput, ar, arOutput, nState.savedBase);
            break;
        }
    case NNEVAL_FROMBASE:
        {
            if (nState.cSavedIBase != nn.cInput) {
                Evaluate(pnn, arInput, ar, arOutput, 0);
                break;
            }
            // memcpy(ar, nState.savedBase, nn.cHidden * sizeof(*ar));
			ar.set(nState.savedBase.subarray(0, nn.cHidden));

            {

                for (let i = 0; i < nn.cInput; ++i) {
                    if (arInput[i] != nState.savedIBase[i] /*lint --e(777) */ ) {
                        arInput[i] -= nState.savedIBase[i];
                    } else {
                        arInput[i] = 0.0;
                    }
                }
            }
            EvaluateFromBase(nn, arInput, ar, arOutput);
            break;
        }
    }
    return 0;
}

export function NeuralNetLoadBinary(nn, r) {

	// r.skip(8); // ????

	nn.cInput = r.readUint32();
	nn.cHidden = r.readUint32();
	nn.cOutput = r.readUint32();

	r.readInt32(); // dummy

	nn.rBetaHidden = r.readFloat32();
	nn.rBetaOutput = r.readFloat32();

    if (nn.cInput < 1 || nn.cHidden < 1 || nn.cOutput < 1 || nn.rBetaHidden <= 0.0 || nn.rBetaOutput <= 0.0) {
        console.error('Failed to load Neaural net from binary');
        return -1;
    }

    nn.nTrained = 1;

	console.debug(nn);

	// r.skip(8); // ????

	nn.arHiddenWeight = r.readFloat32Array(nn.cInput * nn.cHidden);
	nn.arOutputWeight = r.readFloat32Array(nn.cHidden * nn.cOutput);
	nn.arHiddenThreshold = r.readFloat32Array(nn.cHidden);
	nn.arOutputThreshold = r.readFloat32Array(nn.cOutput);

	dump(nn.arHiddenWeight);
	dump(nn.arOutputWeight);
	dump(nn.arHiddenThreshold);
	dump(nn.arOutputThreshold);

    return 0;
}

const e = new Float32Array([
    0.10000000000000001,
    0.11051709180756478,
    0.12214027581601698,
    0.13498588075760032,
    0.14918246976412702,
    0.16487212707001281,
    0.18221188003905089,
    0.20137527074704767,
    0.22255409284924679,
    0.245960311115695,
    0.27182818284590454,
    0.30041660239464335,
    0.33201169227365473,
    0.36692966676192446,
    0.40551999668446748,
    0.44816890703380646,
    0.49530324243951152,
    0.54739473917271997,
    0.60496474644129461,
    0.66858944422792688,
    0.73890560989306509,
    0.81661699125676512,
    0.90250134994341225,
    0.99741824548147184,
    1.1023176380641602,
    1.2182493960703473,
    1.3463738035001691,
    1.4879731724872838,
    1.6444646771097049,
    1.817414536944306,
    2.0085536923187668,
    2.2197951281441637,
    2.4532530197109352,
    2.7112638920657881,
    2.9964100047397011,
    3.3115451958692312,
    3.6598234443677988,
    4.0447304360067395,
    4.4701184493300818,
    4.9402449105530168,
    5.4598150033144233,
    6.034028759736195,
    6.6686331040925158,
    7.3699793699595784,
    8.1450868664968148,
    9.0017131300521811,
    9.9484315641933776,
    10.994717245212353,
    12.151041751873485,
    13.428977968493552,
    14.841315910257659,
    16.402190729990171,
    18.127224187515122,
    20.033680997479166,
    22.140641620418716,
    24.469193226422039,
    27.042640742615255,
    29.886740096706028,
    33.029955990964865,
    36.503746786532886,
    40.34287934927351,
    44.585777008251675,
    49.274904109325632,
    54.457191012592901,
    60.184503787208222,
    66.514163304436181,
    73.509518924197266,
    81.24058251675433,
    89.784729165041753,
    99.227471560502622,
    109.66331584284585,
    121.19670744925763,
    133.9430764394418,
    148.02999275845451,
    163.59844299959269,
    180.80424144560632,
    199.81958951041173,
    220.83479918872089,
    244.06019776244983,
    269.72823282685101,
    298.09579870417281,
    329.44680752838406,
    364.09503073323521,
    402.38723938223131,
    444.7066747699858,
    491.47688402991344,
    543.16595913629783,
    600.29122172610175,
    663.42440062778894,
    733.19735391559948,
    810.3083927575384,
    895.52927034825075,
    989.71290587439091,
    1093.8019208165192,
    1208.8380730216988,
    1335.9726829661872,
    1476.4781565577266,
    1631.7607198015421,
    1803.3744927828525,
    1993.0370438230298,
    1993.0370438230298         /* one extra :-) */
]);

/* Calculate an approximation to the sigmoid function 1 / ( 1 + e^x ).
 * This is executed very frequently during neural net evaluation, so
 * careful optimisation here pays off.
 * 
 * Statistics on sigmoid(x) calls:
 * * >99% of the time, x is positive.
 * *  82% of the time, 3 < abs(x) < 8.
 * 
 * 02/2017: The numbers above are 10+ years old
 * (old neural nets, possibly pruning nets not yet in use).
 * Current stats :
 * * 85% of the time, x is positive, comprising 80% < 10 and 20% > 10
 * * 15% of the time, x is negative with 99%+ > -10
 */

function sigmoid(xin) {
    if (xin >= 0.0) { 
        /* xin is almost always positive; we place this branch of the `if'
         * first, in the hope that the compiler/processor will predict the
         * conditional branch will not be taken. */
        if (xin < 10.0) {
            /* again, predict the branch not to be taken */
            const x1 = 10.0 * xin;
            const i = parseInt(x1);

            return 1.0 / (1.0 + e[i] * (10 - i + x1));
        } else
            return 1.0 / 19931.370438230298;
    } else {
        if (xin > -10.0) {
            const x1 = -10.0 * xin;
            const i = parseInt(x1);

            return 1.0 - 1.0 / (1 + e[i] * (10 - i + x1));
        } else
            return 19930.370438230298 / 19931.370438230298;
    }
}

function dump(a) {
	console.debug('#', a[0], a[a.length - 1]);
}
