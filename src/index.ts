import * as ethjs from 'ethereumjs-util';
import BigNumber from 'bignumber.js';

type Numberish = string | number | bigint | { toString(b?: number): string; };

function toBigInt(n: Numberish): bigint {
    if (typeof n === 'bigint') {
        return n;
    }
    if (typeof n === 'number') {
        return BigInt(n);
    }
    if (typeof n === 'string') {
        return BigInt(n);
    }
    return BigInt(n.toString(10));
}

function numberToBuffer(n: Numberish): Buffer {
    return ethjs.toBuffer(new ethjs.BN(toBigInt(n).toString(10)));
}

export function generateVdf(opts: {
    n: Numberish;
    t: number;
    origin: string;
    path: string[];
    knownQtyIn: Numberish;
    knownQtyOut: Numberish;
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
        x: Numberish;
        y: Numberish;
        n: Numberish;
        t: number;
    }): bigint {
    let n = BigInt(ethjs.bufferToHex(ethjs.keccak256(Buffer.concat([
        ethjs.setLengthLeft(numberToBuffer(opts.x), 32),
        ethjs.setLengthLeft(numberToBuffer(opts.y), 32),
        ethjs.setLengthLeft(numberToBuffer(opts.n), 32),
        ethjs.setLengthLeft(numberToBuffer(opts.t), 32),
    ])))) | 1n;
    return n;
}

export function generateSeed(
    origin: string,
    path: string[],
    knownQtyIn: Numberish,
    knownQtyOut: Numberish,
): string {
    return ethjs.bufferToHex(ethjs.keccak256(Buffer.concat([
        ethjs.setLengthLeft(ethjs.toBuffer(origin), 32),
        ethjs.setLengthLeft(numberToBuffer(path.length), 32),
        ...path.map(p => ethjs.setLengthLeft(ethjs.toBuffer(p), 32)),
        ethjs.setLengthLeft(numberToBuffer(knownQtyIn), 32),
        ethjs.setLengthLeft(numberToBuffer(knownQtyOut), 32),
    ])));
}

export function generateX(n: Numberish, seed: string, blockHash: string): bigint {
    return BigInt(ethjs.bufferToHex(ethjs.keccak256(Buffer.concat([
        ethjs.setLengthLeft(ethjs.toBuffer(seed), 32),
        ethjs.setLengthLeft(ethjs.toBuffer(blockHash), 32),
    ])))) % toBigInt(n);
}

export function evaluateVdf(
    x: Numberish,
    N: Numberish,
    T: number,
    onProgress?: (t: number) => void,
): bigint {
    let y = toBigInt(x);
    const N_ = toBigInt(N);
    for (let i = 0; i < T; ++i) {
        y = (y ** 2n) % N_;
        if (onProgress) {
            onProgress(i);
        }
    }
    return y;
}

export function generateProof(
    x: Numberish,
    c: Numberish,
    N: Numberish,
    T: number,
    onProgress?: (t: number) => void,
): bigint {
    const x_ = toBigInt(x);
    const c_ = toBigInt(c);
    const N_ = toBigInt(N);
    let pi = BigInt(1);
    let r = BigInt(1);
    for (let i = 0; i < T; ++i) {
        const r2 = r * 2n;
        const bit = r2 / c_;
        r = r2 % c_;
        pi = ((pi * pi) * (x_ ** bit)) % N_;
        if (onProgress) {
            onProgress(i);
        }
    }
    return pi;
}

export function isValidVdf(opts: {
    n: Numberish;
    t: number;
    origin: string;
    path: string[];
    knownQtyIn: Numberish;
    knownQtyOut: Numberish;
    blockHash: string;
    proof: string;
}): boolean {
    const n = new BigNumber(opts.n.toString(10));
    const proofBuf = ethjs.toBuffer(opts.proof);
    const pi = new BigNumber(ethjs.bufferToHex(proofBuf.slice(0, 32)));
    const y = BigInt(ethjs.bufferToHex(proofBuf.slice(32, 64)));
    // no way to verify this
    // const blockNumber = new BigNumber(ethjs.bufferToHex(proofBuf.slice(32, 64)));
    const seed = generateSeed(opts.origin, opts.path, opts.knownQtyIn, opts.knownQtyOut);
    const x = generateX(opts.n, seed, opts.blockHash);
    // BigInt gives up with p ** c so use BigNumber here.
    const c = new BigNumber(generateChallenge({ x, y, n: opts.n, t: opts.t }).toString(10));
    const x_ = new BigNumber(x.toString(10));
    const y_ = pi.pow(c, n).times(x_.pow(new BigNumber(2).pow(opts.t, c), n)).mod(n);
    return y == BigInt(y_.toString(10));
}
