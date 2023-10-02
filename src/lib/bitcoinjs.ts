import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory, { type ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

export interface UTXO {
	txid: string;
	vout: number;
	status: {
		confirmed: boolean;
		block_height: number;
		block_hash: string;
		block_time: number;
	};
	value: number;
}

export const ECPair = ECPairFactory(ecc);

bitcoin.initEccLib(ecc);

export const bitcoinjs = bitcoin;

export const NETWORK = bitcoin.networks.testnet;

export function createMultisig(
	threshold: number,
	publicECPairs: ECPairInterface[],
	network: bitcoin.Network
) {
	const pubkeys = publicECPairs.map((hex) => hex.publicKey).sort((a, b) => a.compare(b));

	const multisig = bitcoin.payments.p2sh({
		redeem: bitcoin.payments.p2ms({ m: threshold, pubkeys, network }),
		network
	});

	return multisig;
}

export async function startTxSpendingFromMultisig(
	redeemOutput: string,
	seckey: ECPairInterface,
	network: bitcoin.Network,
	receivingAddresses: {
		address: string;
		amount: number;
	}[],
	utxos: UTXO[],
	transactionsHex: string[]
) {
	const psbt = new bitcoin.Psbt({
		network: network
	});

	utxos.forEach((utxo, i) => {
		psbt.addInput({
			hash: utxo.txid,
			index: utxo.vout,
			redeemScript: Buffer.from(redeemOutput, 'hex'),
			nonWitnessUtxo: Buffer.from(transactionsHex[i], 'hex')
		});
	});

	receivingAddresses.forEach(({ address, amount }) => {
		psbt.addOutput({
			address,
			value: amount
		});
	});

	receivingAddresses.forEach((_, i) => {
		psbt.signInput(i, seckey);
	});

	return psbt.toHex();
}

export async function finishTxSpendingFromMultisig(psbt: bitcoin.Psbt, seckey: ECPairInterface) {
	psbt.txInputs.forEach((_, i) => psbt.signInput(i, seckey));

	psbt.finalizeAllInputs();

	const tx = psbt.extractTransaction();

	return tx.toHex();
}
