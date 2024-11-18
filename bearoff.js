import { PositionIndex } from "./position.js";

const BearoffType = {
    BEAROFF_INVALID: 0,
    BEAROFF_ONESIDED: 1,
    BEAROFF_TWOSIDED: 2,
    BEAROFF_HYPERGAMMON: 3
};

export function BearoffDist(bc, nPosID, arProb, arGammonProb, ar, ausProb, ausGammonProb) {

	if (!bc) return -1;
	if (!(bc.bt == BearoffType.BEAROFF_ONESIDED)) -1;

	if (bc.fND)
		return ReadBearoffOneSidedND(bc, nPosID, arProb, arGammonProb, ar, ausProb, ausGammonProb);

	return ReadBearoffOneSidedExact(bc, nPosID, arProb, arGammonProb, ar, ausProb, ausGammonProb);
}

export function isBearoff(bc, anBoard)
{
    let i, nOppBack, nBack;
    let n = 0, nOpp = 0;

    if (!bc)
        return false;

    for (nOppBack = 24; nOppBack > 0; nOppBack--) {
        if (anBoard[0][nOppBack])
            break;
    }
    for (nBack = 24; nBack > 0; nBack--) {
        if (anBoard[1][nBack])
            break;
    }
    if (!anBoard[0][nOppBack] || !anBoard[1][nBack])
        /* the game is over */
        return false;

    if ((nBack + nOppBack > 22) && !(bc.bt == BearoffType.BEAROFF_HYPERGAMMON))
        /* contact position */
        return false;

    for (i = 0; i <= nOppBack; ++i)
        nOpp += anBoard[0][i];

    for (i = 0; i <= nBack; ++i)
        n += anBoard[1][i];

    return (n <= bc.nChequers && nOpp <= bc.nChequers && nBack < bc.nPoints && nOppBack < bc.nPoints);
}

const ya1 = [
    new Int32Array([36, 0, 0, 0, 0]),
    new Int32Array([36, 0, 0, 0, 0]),
    new Int32Array([6, 1080, 0, 0, 0]),
    new Int32Array([6, 1080, 0, 0, 0]),
    new Int32Array([0, 396, 32400, 0, 0]),
    new Int32Array([0, 396, 32400, 0, 0]),
];

const ya2 = [
    new Int32Array([36, 0, 0, 0, 0]),
    new Int32Array([26, 360, 0, 0, 0]),
    new Int32Array([5, 1116, 0, 0, 0]),
    new Int32Array([5, 596, 18720, 0, 0]),
    new Int32Array([0, 335, 33596, 36000, 0]),
    new Int32Array([0, 235, 17666, 739080, 0]),
];

const ya3 = [
    new Int32Array([36, 0, 0, 0, 0]),
    new Int32Array([6, 1080, 0, 0, 0]),
    new Int32Array([5, 1116, 0, 0, 0]),
    new Int32Array([5, 1116, 0, 0, 0]),
    new Int32Array([5, 1116, 0, 0, 0]),
    new Int32Array([5, 1016, 3600, 0, 0]),
    new Int32Array([0, 396, 32400, 0, 0]),
    new Int32Array([0, 396, 32400, 0, 0]),
    new Int32Array([0, 376, 33120, 0, 0]),
    new Int32Array([0, 335, 34596, 0, 0]),
    new Int32Array([0, 396, 32400, 0, 0]),
    new Int32Array([0, 376, 33120, 0, 0]),
    new Int32Array([0, 335, 34596, 0, 0]),
    new Int32Array([0, 335, 33596, 36000, 0]),
    new Int32Array([0, 335, 27296, 262800, 0]),
];

const ya4 = [
    new Int32Array([36, 0, 0, 0, 0]),
    new Int32Array([17, 684, 0, 0, 0]),
    new Int32Array([4, 999, 5508, 0, 0]),
    new Int32Array([4, 297, 30082, 25128, 0]),
    new Int32Array([0, 272, 24281, 450484, 90144]),
    new Int32Array([0, 120, 11765, 983521, 4213260]),
];

const ya5 = [
    new Int32Array([34, 72, 0, 0, 0]),
    new Int32Array([5, 1116, 0, 0, 0]),
    new Int32Array([4, 1148, 144, 0, 0]),
    new Int32Array([4, 1148, 144, 0, 0]),
    new Int32Array([4, 1080, 2592, 0, 0]),
    new Int32Array([4, 739, 14860, 288, 0]),
    new Int32Array([0, 396, 32400, 0, 0]),
    new Int32Array([0, 371, 33292, 288, 0]),
    new Int32Array([0, 298, 35716, 7632, 0]),
    new Int32Array([0, 272, 34033, 101900, 576]),
    new Int32Array([0, 388, 32680, 288, 0]),
    new Int32Array([0, 322, 34856, 7488, 0]),
    new Int32Array([0, 272, 34794, 74504, 576]),
    new Int32Array([0, 272, 27197, 346480, 55152]),
    new Int32Array([0, 256, 15488, 772640, 634752]),
];

const ya6 = [
    new Int32Array([25, 396, 0, 0, 0]),
    new Int32Array([5, 1112, 144, 0, 0]),
    new Int32Array([4, 1112, 1440, 0, 0]),
    new Int32Array([4, 631, 18756, 0, 0]),
    new Int32Array([4, 615, 19324, 288, 0]),
    new Int32Array([4, 523, 22528, 4176, 0]),
    new Int32Array([0, 333, 33656, 36432, 0]),
    new Int32Array([0, 322, 33854, 43560, 0]),
    new Int32Array([0, 297, 33393, 92540, 576]),
    new Int32Array([0, 272, 30181, 240284, 10944]),
    new Int32Array([0, 233, 17737, 739100, 576]),
    new Int32Array([0, 217, 18281, 739964, 10944]),
    new Int32Array([0, 192, 18895, 747036, 127008]),
    new Int32Array([0, 192, 17551, 782404, 595584]),
    new Int32Array([0, 184, 14192, 886751, 1565604]),
];

const ya7 = [
    new Int32Array([5, 1116, 0, 0, 0]),
    new Int32Array([4, 1148, 144, 0, 0]),
    new Int32Array([4, 1048, 3744, 0, 0]),
    new Int32Array([4, 999, 5508, 0, 0]),
    new Int32Array([0, 392, 32544, 0, 0]),
    new Int32Array([0, 375, 33156, 0, 0]),
    new Int32Array([0, 355, 33868, 288, 0]),
    new Int32Array([0, 335, 34588, 288, 0]),
    new Int32Array([0, 331, 34624, 4176, 0]),
    new Int32Array([0, 297, 35266, 25128, 0]),
    new Int32Array([0, 371, 33292, 288, 0]),
    new Int32Array([0, 331, 34732, 288, 0]),
    new Int32Array([0, 298, 35716, 7632, 0]),
    new Int32Array([0, 331, 33728, 36432, 0]),
    new Int32Array([0, 297, 34754, 43560, 0]),
    new Int32Array([0, 272, 34033, 101900, 576]),
    new Int32Array([0, 330, 27470, 263016, 0]),
    new Int32Array([0, 297, 28537, 267356, 576]),
    new Int32Array([0, 272, 28421, 303644, 10944]),
    new Int32Array([0, 272, 24281, 450484, 90144]),
];

const ya8 = [
    new Int32Array([34, 72, 0, 0, 0]),
    new Int32Array([11, 880, 720, 0, 0]),
    new Int32Array([3, 751, 15482, 9000, 0]),
    new Int32Array([3, 163, 30547, 225808, 104400]),
    new Int32Array([0, 195, 14249, 822591, 3288276]),
    new Int32Array([0, 57, 8951, 767859, 18563364]),
];

const ya9 = [
    new Int32Array([29, 252, 0, 0, 0]),
    new Int32Array([5, 1116, 0, 0, 0]),
    new Int32Array([3, 1115, 2628, 0, 0]),
    new Int32Array([3, 1146, 1512, 0, 0]),
    new Int32Array([3, 899, 10284, 4320, 0]),
    new Int32Array([3, 452, 25549, 34076, 576]),
    new Int32Array([0, 392, 32544, 0, 0]),
    new Int32Array([0, 333, 34408, 9360, 0]),
    new Int32Array([0, 236, 35179, 106580, 26496]),
    new Int32Array([0, 207, 27064, 426011, 397044]),
    new Int32Array([0, 357, 33552, 9072, 0]),
    new Int32Array([0, 249, 35142, 91080, 25920]),
    new Int32Array([0, 207, 28985, 359990, 284184]),
    new Int32Array([0, 207, 16674, 753203, 2083572]),
    new Int32Array([0, 165, 8770, 941530, 7506936]),
];

const ya10 = [
    new Int32Array([23, 468, 0, 0, 0]),
    new Int32Array([5, 1086, 1080, 0, 0]),
    new Int32Array([3, 1043, 5212, 288, 0]),
    new Int32Array([3, 659, 19036, 288, 0]),
    new Int32Array([3, 583, 21510, 9720, 0]),
    new Int32Array([3, 368, 27767, 62980, 4608]),
    new Int32Array([0, 325, 33734, 43992, 0]),
    new Int32Array([0, 289, 33359, 103644, 18144]),
    new Int32Array([0, 235, 30691, 266808, 121392]),
    new Int32Array([0, 207, 23831, 532351, 758772]),
    new Int32Array([0, 223, 18071, 739532, 18720]),
    new Int32Array([0, 175, 19349, 750336, 212976]),
    new Int32Array([0, 147, 18301, 802935, 983988]),
    new Int32Array([0, 147, 13709, 895395, 3606660]),
    new Int32Array([0, 129, 9184, 920983, 9389700]),
];

const ya11 = [
    new Int32Array([5, 1112, 144, 0, 0]),
    new Int32Array([3, 1144, 1584, 0, 0]),
    new Int32Array([3, 1055, 4788, 0, 0]),
    new Int32Array([3, 857, 11792, 4464, 0]),
    new Int32Array([0, 385, 32796, 0, 0]),
    new Int32Array([0, 371, 33292, 288, 0]),
    new Int32Array([0, 321, 34738, 13032, 0]),
    new Int32Array([0, 335, 34472, 4464, 0]),
    new Int32Array([0, 308, 34657, 32780, 576]),
    new Int32Array([0, 235, 34181, 143452, 39168]),
    new Int32Array([0, 345, 33984, 9072, 0]),
    new Int32Array([0, 309, 35268, 9504, 0]),
    new Int32Array([0, 236, 35555, 93060, 25920]),
    new Int32Array([0, 309, 34282, 45000, 0]),
    new Int32Array([0, 235, 34783, 122124, 26784]),
    new Int32Array([0, 207, 28547, 375536, 292176]),
    new Int32Array([0, 307, 28169, 267628, 1152]),
    new Int32Array([0, 235, 29373, 316128, 54000]),
    new Int32Array([0, 207, 25276, 488623, 460260]),
    new Int32Array([0, 207, 15791, 778381, 2321532]),
];

const ya12 = [
    new Int32Array([17, 680, 144, 0, 0]),
    new Int32Array([4, 983, 6076, 288, 0]),
    new Int32Array([3, 923, 9488, 1872, 0]),
    new Int32Array([3, 333, 29949, 29900, 576]),
    new Int32Array([3, 331, 29167, 60532, 4608]),
    new Int32Array([3, 283, 29081, 125244, 25920]),
    new Int32Array([0, 263, 24605, 449718, 117720]),
    new Int32Array([0, 245, 24912, 457129, 292860]),
    new Int32Array([0, 222, 23475, 526367, 735732]),
    new Int32Array([0, 207, 19394, 669443, 1573812]),
    new Int32Array([0, 120, 11720, 984849, 4223772]),
    new Int32Array([0, 108, 11969, 985331, 4443588]),
    new Int32Array([0, 93, 12122, 963477, 5731884]),
    new Int32Array([0, 93, 11334, 906514, 8803800]),
    new Int32Array([0, 93, 9540, 858470, 12858408]),
];

const ya13 = [
    new Int32Array([4, 1132, 720, 0, 0]),
    new Int32Array([3, 1091, 3484, 288, 0]),
    new Int32Array([3, 775, 14808, 2160, 0]),
    new Int32Array([3, 715, 16754, 9864, 0]),
    new Int32Array([0, 367, 33436, 288, 0]),
    new Int32Array([0, 296, 35680, 11504, 576]),
    new Int32Array([0, 284, 35649, 28172, 576]),
    new Int32Array([0, 268, 34079, 105284, 5760]),
    new Int32Array([0, 252, 33761, 136812, 29376]),
    new Int32Array([0, 222, 32167, 230992, 104400]),
    new Int32Array([0, 309, 35114, 15032, 576]),
    new Int32Array([0, 259, 35139, 78796, 5472]),
    new Int32Array([0, 223, 34893, 133328, 40752]),
    new Int32Array([0, 258, 27701, 345954, 74088]),
    new Int32Array([0, 222, 28523, 359568, 198288]),
    new Int32Array([0, 207, 25658, 472035, 562356]),
    new Int32Array([0, 246, 15840, 772067, 665748]),
    new Int32Array([0, 210, 17074, 766333, 952524]),
    new Int32Array([0, 195, 16968, 761467, 1964916]),
    new Int32Array([0, 195, 13487, 839379, 3671460]),
];

const ya14 = [
    new Int32Array([4, 1089, 2268, 0, 0]),
    new Int32Array([3, 647, 19404, 2592, 0]),
    new Int32Array([3, 559, 22396, 8928, 0]),
    new Int32Array([3, 527, 23025, 27740, 576]),
    new Int32Array([0, 313, 34013, 49484, 576]),
    new Int32Array([0, 293, 33443, 95796, 5184]),
    new Int32Array([0, 277, 32921, 134556, 32832]),
    new Int32Array([0, 267, 30329, 241000, 26640]),
    new Int32Array([0, 252, 30183, 263560, 103536]),
    new Int32Array([0, 222, 28408, 360893, 299628]),
    new Int32Array([0, 211, 18473, 740252, 31680]),
    new Int32Array([0, 186, 19069, 747694, 157752]),
    new Int32Array([0, 162, 19534, 758017, 303228]),
    new Int32Array([0, 185, 17752, 783317, 628812]),
    new Int32Array([0, 162, 18254, 788219, 874836]),
    new Int32Array([0, 147, 17470, 814155, 1657044]),
    new Int32Array([0, 180, 14314, 886931, 1587636]),
    new Int32Array([0, 155, 15088, 882887, 1896516]),
    new Int32Array([0, 141, 14977, 868919, 3196404]),
    new Int32Array([0, 141, 12630, 886913, 5590332]),
];

const ya15 = [
    new Int32Array([3, 1019, 6076, 288, 0]),
    new Int32Array([0, 355, 33824, 1872, 0]),
    new Int32Array([0, 331, 34492, 8928, 0]),
    new Int32Array([0, 297, 35133, 29900, 576]),
    new Int32Array([0, 284, 34771, 59668, 4608]),
    new Int32Array([0, 285, 35948, 16112, 576]),
    new Int32Array([0, 284, 35025, 50636, 576]),
    new Int32Array([0, 259, 34403, 105284, 5760]),
    new Int32Array([0, 222, 34305, 155740, 42624]),
    new Int32Array([0, 283, 28939, 270876, 6048]),
    new Int32Array([0, 258, 28885, 304624, 27504]),
    new Int32Array([0, 222, 29275, 334920, 111024]),
    new Int32Array([0, 258, 24785, 449718, 117720]),
    new Int32Array([0, 221, 25756, 457849, 292860]),
    new Int32Array([0, 207, 23447, 546031, 763956]),
];

const ya16 = [
    new Int32Array([31, 180, 0, 0, 0]),
    new Int32Array([6, 975, 3772, 288, 0]),
    new Int32Array([2, 466, 25089, 78660, 18144]),
    new Int32Array([2, 84, 23554, 584297, 1627164]),
    new Int32Array([0, 116, 6951, 880249, 14356620]),
    new Int32Array([0, 18, 6042, 425561, 36475740]),
];

const ya17 = [
    new Int32Array([23, 468, 0, 0, 0]),
    new Int32Array([4, 1148, 144, 0, 0]),
    new Int32Array([2, 995, 8200, 1584, 0]),
    new Int32Array([2, 1066, 5688, 0, 0]),
    new Int32Array([2, 603, 22062, 10568, 576]),
    new Int32Array([2, 205, 32081, 163840, 67248]),
    new Int32Array([0, 383, 32860, 288, 0]),
    new Int32Array([0, 254, 35419, 75284, 2304]),
    new Int32Array([0, 154, 29734, 402111, 269892]),
    new Int32Array([0, 140, 15913, 828583, 3482100]),
    new Int32Array([0, 296, 34104, 68256, 0]),
    new Int32Array([0, 164, 30562, 363296, 127584]),
    new Int32Array([0, 136, 17946, 801264, 2017440]),
    new Int32Array([0, 120, 7889, 1002899, 8538948]),
    new Int32Array([0, 70, 5652, 775017, 21974652]),
];

const ya18 = [
    new Int32Array([19, 608, 144, 0, 0]),
    new Int32Array([4, 1065, 3132, 0, 0]),
    new Int32Array([2, 884, 12012, 8208, 0]),
    new Int32Array([2, 655, 20336, 5328, 0]),
    new Int32Array([2, 444, 26523, 55852, 7200]),
    new Int32Array([2, 189, 30326, 243663, 214596]),
    new Int32Array([0, 304, 33253, 88380, 5184]),
    new Int32Array([0, 224, 30938, 271784, 135360]),
    new Int32Array([0, 153, 24544, 564925, 1181484]),
    new Int32Array([0, 140, 14007, 849405, 5202684]),
    new Int32Array([0, 193, 18775, 748820, 171648]),
    new Int32Array([0, 117, 18938, 811339, 1255572]),
    new Int32Array([0, 100, 13699, 913601, 5157036]),
    new Int32Array([0, 92, 7775, 917424, 13070160]),
    new Int32Array([0, 62, 5739, 706619, 24697476]),
];

const ya19 = [
    new Int32Array([4, 1130, 792, 0, 0]),
    new Int32Array([2, 1063, 5796, 0, 0]),
    new Int32Array([2, 991, 8364, 864, 0]),
    new Int32Array([2, 587, 22351, 20884, 1152]),
    new Int32Array([0, 371, 33292, 288, 0]),
    new Int32Array([0, 357, 33712, 3312, 0]),
    new Int32Array([0, 246, 35383, 86828, 6624]),
    new Int32Array([0, 327, 34262, 22392, 0]),
    new Int32Array([0, 237, 34453, 131064, 39312]),
    new Int32Array([0, 152, 28396, 445719, 527364]),
    new Int32Array([0, 288, 34388, 68400, 0]),
    new Int32Array([0, 260, 35352, 69984, 0]),
    new Int32Array([0, 158, 30668, 367220, 128880]),
    new Int32Array([0, 259, 34481, 102492, 5184]),
    new Int32Array([0, 157, 30147, 385270, 200952]),
    new Int32Array([0, 140, 17532, 803268, 2295216]),
    new Int32Array([0, 257, 28879, 305844, 38016]),
    new Int32Array([0, 155, 26546, 508717, 517068]),
    new Int32Array([0, 140, 16334, 823115, 3133332]),
    new Int32Array([0, 124, 7589, 978016, 9636912]),
];

const ya20 = [
    new Int32Array([14, 776, 576, 0, 0]),
    new Int32Array([4, 913, 8552, 1872, 0]),
    new Int32Array([2, 767, 15983, 16868, 576]),
    new Int32Array([2, 360, 29605, 53820, 5184]),
    new Int32Array([2, 300, 28857, 156860, 64512]),
    new Int32Array([2, 176, 27944, 340841, 409788]),
    new Int32Array([0, 243, 24528, 474225, 268380]),
    new Int32Array([0, 198, 22633, 576764, 1132416]),
    new Int32Array([0, 150, 18321, 737255, 3182580]),
    new Int32Array([0, 140, 12063, 859951, 7342452]),
    new Int32Array([0, 108, 11969, 977637, 4720572]),
    new Int32Array([0, 76, 12092, 946693, 7168140]),
    new Int32Array([0, 64, 10674, 863340, 12566448]),
    new Int32Array([0, 64, 7844, 761133, 19913580]),
    new Int32Array([0, 52, 6032, 616407, 28031940]),
];

const ya21 = [
    new Int32Array([4, 1099, 1908, 0, 0]),
    new Int32Array([2, 1019, 7348, 1152, 0]),
    new Int32Array([2, 751, 16778, 9000, 0]),
    new Int32Array([2, 520, 23769, 56524, 6336]),
    new Int32Array([0, 342, 34202, 5112, 0]),
    new Int32Array([0, 292, 35133, 36292, 3744]),
    new Int32Array([0, 225, 34874, 131282, 45720]),
    new Int32Array([0, 268, 32812, 150088, 34848]),
    new Int32Array([0, 220, 30222, 298601, 284508]),
    new Int32Array([0, 150, 25691, 530366, 1079064]),
    new Int32Array([0, 262, 35170, 73880, 2304]),
    new Int32Array([0, 222, 34976, 132004, 27504]),
    new Int32Array([0, 154, 30031, 392356, 236160]),
    new Int32Array([0, 220, 28078, 378260, 195408]),
    new Int32Array([0, 151, 25786, 529760, 931104]),
    new Int32Array([0, 140, 16413, 821065, 3104748]),
    new Int32Array([0, 210, 16875, 771659, 1018692]),
    new Int32Array([0, 140, 17488, 793184, 2715264]),
    new Int32Array([0, 132, 12957, 858233, 6618924]),
    new Int32Array([0, 128, 6962, 908191, 12776580]),
];

const ya22 = [
    new Int32Array([4, 1035, 4204, 288, 0]),
    new Int32Array([2, 642, 20738, 7704, 0]),
    new Int32Array([2, 555, 23523, 20180, 576]),
    new Int32Array([2, 410, 27049, 80676, 18144]),
    new Int32Array([0, 290, 33665, 91628, 7488]),
    new Int32Array([0, 275, 33057, 132372, 28512]),
    new Int32Array([0, 212, 30778, 291535, 191556]),
    new Int32Array([0, 253, 29938, 271332, 94608]),
    new Int32Array([0, 208, 27684, 401077, 444492]),
    new Int32Array([0, 151, 23054, 608233, 1646748]),
    new Int32Array([0, 184, 19038, 750756, 181008]),
    new Int32Array([0, 164, 19390, 761061, 286956]),
    new Int32Array([0, 113, 18750, 820147, 1368756]),
    new Int32Array([0, 164, 17961, 797571, 824580]),
    new Int32Array([0, 111, 17708, 838828, 2139984]),
    new Int32Array([0, 100, 13209, 915715, 5715972]),
    new Int32Array([0, 158, 14796, 886873, 1991484]),
    new Int32Array([0, 106, 15120, 886295, 4018500]),
    new Int32Array([0, 96, 12026, 896601, 8123868]),
    new Int32Array([0, 92, 7533, 877093, 14835708]),
];

const ya23 = [
    new Int32Array([2, 963, 9344, 1872, 0]),
    new Int32Array([0, 331, 34550, 6840, 0]),
    new Int32Array([0, 311, 34757, 25292, 576]),
    new Int32Array([0, 292, 34669, 52956, 5184]),
    new Int32Array([0, 225, 34049, 160400, 66672]),
    new Int32Array([0, 242, 35841, 75644, 2304]),
    new Int32Array([0, 242, 34959, 107252, 7488]),
    new Int32Array([0, 222, 34300, 156216, 31968]),
    new Int32Array([0, 153, 29610, 407273, 291420]),
    new Int32Array([0, 240, 29401, 308924, 43776]),
    new Int32Array([0, 220, 29234, 339556, 90576]),
    new Int32Array([0, 151, 26258, 521963, 600084]),
    new Int32Array([0, 220, 25312, 475809, 268380]),
    new Int32Array([0, 149, 23843, 596484, 1140480]),
    new Int32Array([0, 140, 15529, 836357, 3699900]),
];

const ya24 = [
    new Int32Array([10, 887, 1764, 0, 0]),
    new Int32Array([3, 719, 16407, 17156, 576]),
    new Int32Array([2, 641, 19951, 37220, 4032]),
    new Int32Array([2, 194, 30182, 243319, 180324]),
    new Int32Array([2, 185, 28264, 318235, 388980]),
    new Int32Array([2, 143, 26206, 434497, 830268]),
    new Int32Array([0, 183, 14564, 820763, 3505716]),
    new Int32Array([0, 160, 14565, 819849, 4610412]),
    new Int32Array([0, 136, 13405, 831119, 6827796]),
    new Int32Array([0, 132, 10367, 861740, 9849312]),
    new Int32Array([0, 55, 8811, 772043, 18687492]),
    new Int32Array([0, 47, 8633, 762062, 19650744]),
    new Int32Array([0, 40, 8204, 717461, 22138956]),
    new Int32Array([0, 40, 7232, 643295, 26068644]),
    new Int32Array([0, 36, 6082, 562587, 30651156]),
];

const ya25 = [
    new Int32Array([3, 1079, 3916, 288, 0]),
    new Int32Array([2, 887, 11834, 10728, 0]),
    new Int32Array([2, 476, 25507, 51044, 4032]),
    new Int32Array([2, 402, 27073, 90180, 18144]),
    new Int32Array([0, 318, 34810, 14312, 576]),
    new Int32Array([0, 232, 34908, 121056, 43200]),
    new Int32Array([0, 200, 34336, 181552, 99648]),
    new Int32Array([0, 200, 26978, 434919, 514404]),
    new Int32Array([0, 176, 26107, 485813, 930780]),
    new Int32Array([0, 147, 23378, 600873, 1678428]),
    new Int32Array([0, 221, 35079, 128568, 64368]),
    new Int32Array([0, 182, 29423, 372592, 429264]),
    new Int32Array([0, 148, 27194, 487861, 754668]),
    new Int32Array([0, 176, 17571, 762085, 2047644]),
    new Int32Array([0, 139, 17798, 786039, 2617380]),
    new Int32Array([0, 132, 14067, 884661, 4228956]),
    new Int32Array([0, 152, 9103, 939942, 7739064]),
    new Int32Array([0, 113, 10135, 926300, 8712288]),
    new Int32Array([0, 100, 9481, 906351, 10884564]),
    new Int32Array([0, 100, 6941, 887101, 14869404]),
];

const ya26 = [
    new Int32Array([3, 985, 7264, 1584, 0]),
    new Int32Array([2, 595, 21997, 23276, 576]),
    new Int32Array([2, 395, 27547, 82204, 17568]),
    new Int32Array([2, 340, 27770, 144132, 65232]),
    new Int32Array([0, 269, 33277, 131568, 52272]),
    new Int32Array([0, 226, 30426, 285363, 216756]),
    new Int32Array([0, 195, 28399, 389959, 524628]),
    new Int32Array([0, 196, 23900, 538799, 950436]),
    new Int32Array([0, 173, 22617, 594924, 1665792]),
    new Int32Array([0, 146, 19382, 710497, 2957436]),
    new Int32Array([0, 159, 19533, 759847, 378612]),
    new Int32Array([0, 133, 18457, 807913, 1255788]),
    new Int32Array([0, 107, 17761, 834132, 2426976]),
    new Int32Array([0, 133, 14018, 894693, 3884652]),
    new Int32Array([0, 105, 14160, 885933, 5322348]),
    new Int32Array([0, 100, 11603, 903632, 8232336]),
    new Int32Array([0, 120, 9386, 919460, 9602640]),
    new Int32Array([0, 92, 9959, 897073, 10972332]),
    new Int32Array([0, 88, 9081, 845101, 14167836]),
    new Int32Array([0, 88, 6944, 797786, 18640728]),
];

const ya27 = [
    new Int32Array([2, 850, 13146, 11448, 0]),
    new Int32Array([0, 310, 34855, 23044, 1152]),
    new Int32Array([0, 296, 34455, 55420, 7200]),
    new Int32Array([0, 232, 33661, 164996, 77472]),
    new Int32Array([0, 200, 32377, 248703, 221076]),
    new Int32Array([0, 209, 35429, 131512, 64656]),
    new Int32Array([0, 208, 34703, 158780, 70560]),
    new Int32Array([0, 182, 29012, 387017, 442620]),
    new Int32Array([0, 147, 26918, 497879, 798372]),
    new Int32Array([0, 207, 29618, 341130, 142776]),
    new Int32Array([0, 181, 25868, 495979, 641268]),
    new Int32Array([0, 146, 24254, 583029, 1232172]),
    new Int32Array([0, 180, 16617, 776622, 2574072]),
    new Int32Array([0, 142, 16946, 792561, 3346812]),
    new Int32Array([0, 136, 13415, 872781, 5315004]),
];

const ya28 = [
    new Int32Array([3, 876, 11070, 5832, 0]),
    new Int32Array([2, 355, 29081, 78820, 17568]),
    new Int32Array([2, 312, 28766, 144712, 59904]),
    new Int32Array([2, 268, 28254, 217343, 161604]),
    new Int32Array([0, 227, 24896, 477159, 432324]),
    new Int32Array([0, 209, 23554, 535275, 919188]),
    new Int32Array([0, 185, 22006, 601857, 1648188]),
    new Int32Array([0, 194, 19630, 671532, 1799280]),
    new Int32Array([0, 172, 18904, 699721, 2751804]),
    new Int32Array([0, 145, 16482, 774441, 4460508]),
    new Int32Array([0, 100, 12078, 980097, 4863996]),
    new Int32Array([0, 87, 12104, 965251, 5971284]),
    new Int32Array([0, 71, 11891, 942537, 7811532]),
    new Int32Array([0, 87, 11301, 910749, 8974044]),
    new Int32Array([0, 70, 11128, 900933, 10344780]),
    new Int32Array([0, 64, 10008, 845763, 14062356]),
    new Int32Array([0, 87, 9602, 858987, 13039380]),
    new Int32Array([0, 70, 9669, 843115, 14317092]),
    new Int32Array([0, 64, 8948, 788345, 17503164]),
    new Int32Array([0, 64, 7347, 721049, 22000716]),
];

const ya29 = [
    new Int32Array([2, 711, 17893, 20684, 576]),
    new Int32Array([0, 277, 35301, 49644, 5184]),
    new Int32Array([0, 250, 32889, 169600, 72432]),
    new Int32Array([0, 216, 31766, 251079, 180900]),
    new Int32Array([0, 191, 29823, 346777, 420300]),
    new Int32Array([0, 196, 34817, 169610, 92808]),
    new Int32Array([0, 195, 28619, 387703, 320724]),
    new Int32Array([0, 180, 26178, 483327, 741636]),
    new Int32Array([0, 147, 24325, 575456, 1366128]),
    new Int32Array([0, 185, 17665, 769685, 1232316]),
    new Int32Array([0, 172, 17499, 767034, 2149416]),
    new Int32Array([0, 137, 17091, 792659, 3388644]),
    new Int32Array([0, 172, 14184, 836845, 3932460]),
    new Int32Array([0, 137, 14526, 834307, 5213556]),
    new Int32Array([0, 132, 11813, 863857, 7899084]),
];

const ya30 = [
    new Int32Array([2, 537, 23595, 40820, 4032]),
    new Int32Array([0, 260, 32786, 160172, 78768]),
    new Int32Array([0, 239, 29984, 285233, 187740]),
    new Int32Array([0, 215, 28156, 375495, 427140]),
    new Int32Array([0, 191, 26442, 456345, 857628]),
    new Int32Array([0, 147, 19675, 767435, 481284]),
    new Int32Array([0, 147, 18377, 798257, 1053900]),
    new Int32Array([0, 133, 17615, 821824, 1846224]),
    new Int32Array([0, 106, 17096, 842747, 3025332]),
    new Int32Array([0, 141, 15264, 885864, 2214432]),
    new Int32Array([0, 128, 15090, 876847, 3371076]),
    new Int32Array([0, 101, 14852, 877549, 4913964]),
    new Int32Array([0, 128, 12865, 889903, 5784660]),
    new Int32Array([0, 100, 13053, 881311, 7156692]),
    new Int32Array([0, 96, 11075, 873594, 10184616]),
];

const ya31 = [
    new Int32Array([0, 278, 34449, 78676, 17568]),
    new Int32Array([0, 196, 34220, 190904, 99936]),
    new Int32Array([0, 195, 29493, 359469, 204444]),
    new Int32Array([0, 195, 25955, 480507, 432324]),
    new Int32Array([0, 180, 24042, 554123, 961236]),
    new Int32Array([0, 146, 22638, 628265, 1698012]),
];

const y = [ya1, ya2, ya3, ya4, ya5, ya6, ya7, ya8, ya9, ya10, ya11, ya12, ya13, ya14, ya15, ya16,
    ya17, ya18, ya19, ya20, ya21, ya22, ya23, ya24, ya25, ya26, ya27, ya28, ya29, ya30, ya31];

export function getRaceBGprobs(board)
{
    let tot = 0, i, group = 0;
    // g_assert(board[5] == 0);

    for (i = 4; i >= 0; --i) {
        if (board[i])
            group += (0x1 << i);
        tot += board[i];
    }

    // g_assert(group < 32);

    if (tot > 6)
        return 0;

    {
        let grpSize = 0
			, b1 = new Uint32Array(6).fill(0)
			, k;

        for (k = 0; k < 5; ++k) {
            if ((group & (0x1 << k))) {
                //g_assert(board[k] > 0);
                b1[grpSize] = board[k] - 1;
                ++grpSize;
            }
        }

        return y[group - 1][PositionIndex(grpSize, b1)];
    }
}