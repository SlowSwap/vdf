import * as ethjs from 'ethereumjs-util';
import BigNumber from 'bignumber.js';

function numberToBuffer(n: BigNumber | string | number): Buffer {
    return ethjs.toBuffer(new ethjs.BN(BigNumber.isBigNumber(n) ? n.toString(10) : n));
}

export function generateSeed(
    origin: string,
    path: string[],
    knownQtyIn: BigNumber,
    knownQtyOut: BigNumber,
): string {
    return ethjs.bufferToHex(ethjs.keccak256(Buffer.concat([
        ethjs.setLengthLeft(ethjs.toBuffer(origin), 20),
        ethjs.setLengthLeft(ethjs.toBuffer(path.length), 32),
        ...path.map(p => ethjs.setLengthLeft(ethjs.toBuffer(p), 20)),
        ethjs.setLengthLeft(numberToBuffer(knownQtyIn), 32),
        ethjs.setLengthLeft(numberToBuffer(knownQtyOut), 32),
    ])));
}

export function generateX(n: BigNumber, seed: string, blockHash: string): BigNumber {
    return new BigNumber(ethjs.bufferToHex(ethjs.keccak256(Buffer.concat([
        ethjs.setLengthLeft(ethjs.toBuffer(seed), 32),
        ethjs.setLengthLeft(ethjs.toBuffer(blockHash), 32),
    ])))).mod(n);
}

export function evaluateVdf(x: BigNumber, N: BigNumber, T: number): BigNumber {
    let y = new BigNumber(x);
    for (let i = 0; i < T; ++i) {
        y = y.pow(2).modulo(N);
    }
    return y;
}

export function generateProof(
    x: BigNumber,
    c: BigNumber,
    N: BigNumber,
    T: number,
): BigNumber {
    let pi = new BigNumber(1);
    let r = new BigNumber(1);
    for (let i = 0; i < T; ++i) {
        const r2 = r.times(2);
        const bit = r2.div(c).integerValue(BigNumber.ROUND_DOWN);
        r = r2.modulo(c);
        pi = pi.pow(2).times(x.pow(bit)).modulo(N);
    }
    return pi;
}
