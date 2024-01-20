import * as bitcoin from 'bitcoinjs-lib';
import * as liquid from 'liquidjs-lib';

import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';

export const ECPair = ECPairFactory(ecc);

bitcoin.initEccLib(ecc);

export function getNetworkName() {
	const network = sessionStorage.getItem('network');

	if (!network) {
		return 'bitcoin_testnet';
	} else if (
		network === 'bitcoin' ||
		network === 'bitcoin_testnet' ||
		network === 'liquid' ||
		network === 'liquid_testnet'
	) {
		return network;
	} else {
		alert('Inexistent network name, contact the developers');
		throw new Error('Inexistent network name');
	}
}

export function getNetworkData(): { isTestnet: boolean } & (
	| {
			isLiquid: false;
			network: bitcoin.networks.Network;
			name: 'bitcoin' | 'bitcoin_testnet';
	  }
	| {
			isLiquid: true;
			network: liquid.networks.Network;
			name: 'liquid' | 'liquid_testnet';
	  }
) {
	const networkName = getNetworkName();

	if (networkName === 'bitcoin')
		return {
			isLiquid: false,
			isTestnet: false,
			network: bitcoin.networks.bitcoin,
			name: networkName
		};
	else if (networkName === 'bitcoin_testnet')
		return {
			isLiquid: false,
			isTestnet: true,
			network: bitcoin.networks.testnet,
			name: networkName
		};
	else if (networkName === 'liquid')
		return {
			isLiquid: true,
			isTestnet: false,
			network: liquid.networks.liquid,
			name: networkName
		};
	else if (networkName === 'liquid_testnet')
		return {
			isLiquid: true,
			isTestnet: true,
			network: liquid.networks.testnet,
			name: networkName
		};

	throw new Error('It should be impossible to get here');
}

export const NETWORK = getNetworkData();
