import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory, { type ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

export const ECPair = ECPairFactory(ecc);

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
	transactionHash: string,
	transactionHex: string,
	receivingAddress: string,
	amountToSend: number
) {
	const psbt = new bitcoin.Psbt({
		network: network
	})
		.addInput({
			hash: transactionHash,
			index: 0,
			redeemScript: Buffer.from(redeemOutput, 'hex'),
			nonWitnessUtxo: Buffer.from(transactionHex, 'hex')
		})
		.addOutput({
			address: receivingAddress,
			value: amountToSend
		})
		.signInput(0, seckey);

	return psbt.toHex();
}

export async function finishTxSpendingFromMultisig(psbtHex: string, seckey: ECPairInterface) {
	const psbt = bitcoin.Psbt.fromHex(psbtHex);

	psbt.signInput(0, seckey);

	psbt.finalizeAllInputs();

	const tx = psbt.extractTransaction();

	console.log(tx.toHex());

	return tx.toHex();
}
