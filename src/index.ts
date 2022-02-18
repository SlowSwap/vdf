import * as ethjs from 'ethereumjs-util';
import BigNumber from 'bignumber.js';

function numberToBuffer(n: BigNumber | string | number): Buffer {
    return ethjs.toBuffer(new ethjs.BN(n.toString(10)));
}

export function generateVdf(opts: {
    n: BigNumber;
    t: number;
    origin: string;
    path: string[];
    knownQtyIn: BigNumber;
    knownQtyOut: BigNumber;
    blockHash: string;
    blockNumber: number;
    onProgress?: (progress: number) => void;
}): string {
    const createProgressCallback = (start: number = 0, freq: number = 100) => {
        if (!opts.onProgress) {
            return () => undefined;
        }
        let lastUpdateT = 0;
        let total = 2 * opts.t;
        return (t: number) => {
            if (t === 0 || t === opts.t - 1 || t - lastUpdateT > freq) {
                lastUpdateT = t;
                opts.onProgress!((t + 1 + start) / total);
            }
        };
    };
    const seed = generateSeed(opts.origin, opts.path, opts.knownQtyIn, opts.knownQtyOut);
    const x = generateX(opts.n, seed, opts.blockHash);
    const y = evaluateVdf(x, opts.n, opts.t, createProgressCallback());
    const c = generateChallenge({ x, y, n: opts.n, t: opts.t });
    const pi = generateProof(x, c, opts.n, opts.t, createProgressCallback(opts.t));
    return ethjs.bufferToHex(Buffer.concat([
        ethjs.setLengthLeft(numberToBuffer(pi), 32),
        ethjs.setLengthLeft(numberToBuffer(y), 32),
        ethjs.setLengthLeft(numberToBuffer(opts.blockNumber), 32),
    ]));
}

export function generateChallenge(opts: {
        x: BigNumber;
        y: BigNumber;
        n: BigNumber;
        t: number;
    }): BigNumber {
    let n = new BigNumber(ethjs.bufferToHex(ethjs.keccak256(Buffer.concat([
        ethjs.setLengthLeft(numberToBuffer(opts.x), 32),
        ethjs.setLengthLeft(numberToBuffer(opts.y), 32),
        ethjs.setLengthLeft(numberToBuffer(opts.n), 32),
        ethjs.setLengthLeft(numberToBuffer(opts.t), 32),
    ]))));
    if (n.mod(2).isZero()) {
        n = n.plus(1);
    }
    return n;
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

export function evaluateVdf(
    x: BigNumber,
    N: BigNumber,
    T: number,
    onProgress?: (t: number) => void,
): BigNumber {
    let y = x;
    for (let i = 0; i < T; ++i) {
        y = y.pow(2).modulo(N);
        if (onProgress) {
            onProgress(i);
        }
    }
    return y;
}

export function generateProof(
    x: BigNumber,
    c: BigNumber,
    N: BigNumber,
    T: number,
    onProgress?: (t: number) => void,
): BigNumber {
    let pi = new BigNumber(1);
    let r = new BigNumber(1);
    for (let i = 0; i < T; ++i) {
        const r2 = r.times(2);
        const bit = r2.div(c).integerValue(BigNumber.ROUND_DOWN);
        r = r2.modulo(c);
        pi = pi.pow(2).times(x.pow(bit)).modulo(N);
        if (onProgress) {
            onProgress(i);
        }
    }
    return pi;
}

export function isValidVdf(opts: {
    n: BigNumber;
    t: number;
    origin: string;
    path: string[];
    knownQtyIn: BigNumber;
    knownQtyOut: BigNumber;
    blockHash: string;
    proof: string;
}): boolean {
    const proofBuf = ethjs.toBuffer(opts.proof);
    const pi = new BigNumber(ethjs.bufferToHex(proofBuf.slice(0, 32)));
    const y = new BigNumber(ethjs.bufferToHex(proofBuf.slice(32, 64)));
    // no way to verify this
    // const blockNumber = new BigNumber(ethjs.bufferToHex(proofBuf.slice(32, 64)));
    const seed = generateSeed(opts.origin, opts.path, opts.knownQtyIn, opts.knownQtyOut);
    const x = generateX(opts.n, seed, opts.blockHash);
    const c = generateChallenge({ x, y, n: opts.n, t: opts.t });
    const y_ = pi.pow(c, opts.n).times(x.pow(new BigNumber(2).pow(opts.t, c), opts.n)).mod(opts.n);
    return y.eq(y_);
}
