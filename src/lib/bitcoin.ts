import * as bitcoin from 'bitcoinjs-lib';

import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';

export const ECPair = ECPairFactory(ecc);

bitcoin.initEccLib(ecc);

export function isMainnet() {
	return sessionStorage.getItem('network') === 'mainnet';
}

export const NETWORK = isMainnet() ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
