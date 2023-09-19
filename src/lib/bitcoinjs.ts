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

export async function createTxSpendingFromMultisig(
	multisig: bitcoin.payments.Payment,
	seckeys: ECPairInterface[],
	network: bitcoin.Network,
	transactionHash: string,
	transactionHex: string,
	receivingAddress: string,
	valueToSend: number
) {
	// const transaction = await (
	// 	await fetch(
	// 		`https://mempool.space/testnet/api/tx/${'transactionHash'}`
	// 	)
	// ).json();

	// console.log(transaction);

	const psbt = new bitcoin.Psbt({
		network: network
	})
		.addInput({
			hash: transactionHash,
			index: 0,
			redeemScript: multisig.redeem!.output,
			nonWitnessUtxo: Buffer.from(transactionHex, 'hex')
		})
		.addOutput({
			address: receivingAddress,
			value: valueToSend
		})
		.signInput(0, seckeys[0])
		.signInput(0, seckeys[1]);

	psbt.finalizeAllInputs();

	const tx = psbt.extractTransaction();

	console.log(tx.toHex());

	return tx.toHex();
}
