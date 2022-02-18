import chai, { expect } from 'chai';
import crypto from 'crypto';
import { generateVdf, isValidVdf } from '../src';

describe('vdf tests', () => {
    const N = '44771746775035800231893057667067514385523709770528832291415080542575843241867';
    const T = 5e6;
    const origin = randomHash(20);
    const blockHash = randomHash();
    const blockNumber = Math.floor(Math.random() * 4e6);
    const knownQtyIn = randomQuantity();
    const knownQtyOut = randomQuantity();
    const path = [...new Array(3)].map(_ => randomHash(20));

    describe('generateVdf()', () => {
        it('works', () => {
            const opts = {
                n: N,
                t: T,
                blockHash,
                blockNumber,
                knownQtyIn,
                knownQtyOut,
                origin,
                path,
            }
            const vdf = generateVdf(opts);
            expect(vdf).to.length(96 * 2 + 2);
            expect(isValidVdf({ ...opts, proof: vdf })).to.be.true;
        });
    });
});

function randomHash(len: number = 32): string {
    return '0x' + crypto.randomBytes(len).toString('hex');
}

function randomQuantity(decimals: number = 18): bigint {
    const n = 10n ** BigInt(decimals);
    return BigInt('0x' + crypto.randomBytes(32).toString('hex')) % n;
}
