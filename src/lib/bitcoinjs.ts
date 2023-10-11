import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory, { type ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import type { Taptree } from 'bitcoinjs-lib/src/types';
import { sortScriptsIntoTree } from './huffman';

export interface UTXO {
	txid: string;
	vout: number;
	value: number;
}

export const ECPair = ECPairFactory(ecc);

bitcoin.initEccLib(ecc);

export const bitcoinjs = bitcoin;

export const NETWORK = bitcoin.networks.testnet;

// Invalid point, there is not priv key to sign this, should be random
export const H = Buffer.from(
	'50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
	'hex'
);

export const combine = <T>(items: Array<T>, size: number): Array<Array<T>> => {
	const intCombine = (acc: Array<T>, rem: Array<T>, curr: number): Array<any> => {
		if (curr === 0) return acc;
		return rem.map((i, idx) => {
			return intCombine([...acc, i], rem.slice(idx + 1), curr - 1);
		});
	};

	return intCombine([], items, size).flat(size - 1);
};

export function createMultisig(
	publicPartsECPairs: ECPairInterface[],
	publicArbitratorsECPairs: ECPairInterface[],
	arbitratorsQuorum: number,
	network: bitcoin.Network
) {
	const eachChildNodeWithArbitratorsQuorum = publicPartsECPairs
		.map((p) => combine(publicArbitratorsECPairs, arbitratorsQuorum).map((a) => [p, ...a]))
		.flat(1);
	const childNodesCombinations = [publicPartsECPairs, ...eachChildNodeWithArbitratorsQuorum];
	const multisigAsms = childNodesCombinations.map(
		(childNodes) =>
			childNodes
				.map((childNode) => toXOnly(childNode.publicKey).toString('hex'))
				.map((pubkey, idx) => pubkey + ' ' + (idx ? 'OP_CHECKSIGADD' : 'OP_CHECKSIG'))
				.join(' ') + ` OP_${childNodes.length} OP_NUMEQUAL`
	);

	const multisigScripts = multisigAsms.map((ma, idx) => {
		return {
			// when building Taptree, prioritize parts agreement script (shortest path), using 1 for parts script and 5 for scripts with arbitrators
			weight: idx ? 1 : 5,
			leaf: { output: bitcoin.script.fromASM(ma) },
			combination: childNodesCombinations[idx]
		};
	});

	const scriptTree: Taptree = sortScriptsIntoTree(multisigScripts)!;

	const multisig = bitcoin.payments.p2tr({
		internalPubkey: toXOnly(H),
		scriptTree,
		network
	});

	return { multisigScripts, multisig };
}

export function startTxSpendingFromMultisig(
	multisig: bitcoin.payments.Payment,
	redeemOutput: string,
	seckey: ECPairInterface,
	network: bitcoin.Network,
	receivingAddresses: {
		address: string;
		amount: number;
	}[],
	utxos: UTXO[]
) {
	const multisigRedeem = {
		output: Buffer.from(redeemOutput, 'hex'),
		redeemVersion: 192
	};

	const multisigP2tr = bitcoin.payments.p2tr({
		internalPubkey: toXOnly(H),
		scriptTree: multisig.scriptTree,
		redeem: multisigRedeem,
		network
	});

	const tapLeafScript = {
		leafVersion: multisigRedeem.redeemVersion,
		script: multisigRedeem.output,
		controlBlock: multisigP2tr.witness![multisigP2tr.witness!.length - 1]
	};

	const psbt = new bitcoin.Psbt({ network });

	utxos.forEach((utxo) => {
		psbt.addInput({
			hash: utxo.txid,
			index: utxo.vout,
			witnessUtxo: { value: utxo.value, script: multisigP2tr.output! },
			tapLeafScript: [tapLeafScript]
		});
	});

	receivingAddresses.forEach(({ address, amount }) => {
		psbt.addOutput({
			address,
			value: amount
		});
	});

	psbt.txInputs.forEach((_, i) => {
		psbt.signInput(i, seckey);
	});

	return psbt;
}

export function continueTxSpendingFromMultisig(psbt: bitcoin.Psbt, seckey: ECPairInterface) {
	psbt.txInputs.forEach((_, i) => psbt.signInput(i, seckey));
}

export function finishTxSpendingFromMultisig(psbt: bitcoin.Psbt, seckeys: ECPairInterface[]) {
	psbt.txInputs.forEach((_, i) => seckeys.forEach((seckey) => psbt.signInput(i, seckey)));

	psbt.finalizeAllInputs();

	const tx = psbt.extractTransaction();

	return tx;
}
