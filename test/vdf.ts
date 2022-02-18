import BigNumber from 'bignumber.js';
import chai, { expect } from 'chai';
import crypto from 'crypto';
import { generateVdf } from '../src';

describe('vdf tests', () => {
    const N = new BigNumber('44771746775035800231893057667067514385523709770528832291415080542575843241867');
    const T = 1e3;
    const origin = randomHash(20);
    const blockHash = randomHash();
    const blockNumber = Math.floor(Math.random() * 4e6);
    const knownQtyIn = randomQuantity();
    const knownQtyOut = randomQuantity();
    const path = [...new Array(3)].map(i => randomHash(20));

    it('generateVdf()', () => {
        const vdf = generateVdf({
            n: N,
            t: T,
            blockHash,
            blockNumber,
            knownQtyIn,
            knownQtyOut,
            origin,
            path,
        });
        expect(vdf).to.length(96 * 2 + 2);
    });
});

function randomHash(len: number = 32): string {
    return '0x' + crypto.randomBytes(len).toString('hex');
}

function randomQuantity(decimals: number = 18): BigNumber {
    const n = new BigNumber(10).pow(decimals);
    return new BigNumber('0x' + crypto.randomBytes(32).toString('hex')).mod(n);
}
