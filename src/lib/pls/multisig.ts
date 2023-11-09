import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import type { Taptree } from 'bitcoinjs-lib/src/types';
import { sortScriptsIntoTree } from '../huffman';
import type { UTXO } from '$lib/mempool';
import type { ECPairInterface } from 'ecpair';
import { script, type Network, payments, type SignerAsync, type Signer, Psbt } from 'bitcoinjs-lib';

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
	network: Network
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
			leaf: { output: script.fromASM(ma) },
			combination: childNodesCombinations[idx]
		};
	});

	const scriptTree: Taptree = sortScriptsIntoTree(multisigScripts)!;

	const multisig = payments.p2tr({
		internalPubkey: toXOnly(H),
		scriptTree,
		network
	});

	return { multisigScripts, multisig };
}

export async function startTxSpendingFromMultisig(
	multisig: payments.Payment,
	redeemOutput: string,
	signer: Signer | SignerAsync,
	network: Network,
	receivingAddresses: {
		address: string;
		value: number;
	}[],
	utxos: UTXO[]
) {
	const multisigRedeem = {
		output: Buffer.from(redeemOutput, 'hex'),
		redeemVersion: 192
	};

	const multisigP2tr = payments.p2tr({
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

	const psbt = new Psbt({ network });

	psbt.addInputs(
		utxos.map((utxo) => ({
			hash: utxo.txid,
			index: utxo.vout,
			witnessUtxo: { value: utxo.value, script: multisigP2tr.output! },
			tapLeafScript: [tapLeafScript]
		}))
	);

	psbt.addOutputs(receivingAddresses);

	await psbt.signAllInputsAsync(signer);

	return psbt;
}
