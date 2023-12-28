import {
	Transaction,
	address as Address,
	networks,
	payments,
	confidential,
	script,
	crypto,
	bip341
} from 'liquidjs-lib';
import { ECPair } from './bitcoin';

import {
	Creator as PsetCreator,
	Updater as PsetUpdater,
	CreatorOutput,
	Signer as PsetSigner,
	Finalizer as PsetFinalizer,
	Extractor as PsetExtractor,
	Blinder as PsetBlinder,
	Pset,
	witnessStackToScriptWitness
} from 'liquidjs-lib/src/psetv2';

import { ZKPGenerator, ZKPValidator } from './myZKP';

import * as ecc from 'tiny-secp256k1';

import secp256k1 from '@vulpemventures/secp256k1-zkp';

import { combine } from './pls/multisig';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import type { HashTree } from 'liquidjs-lib/src/bip341';
import { script as bitcoinscript } from 'bitcoinjs-lib';

const zkpLib = await secp256k1();

export const Confidential = new confidential.Confidential(zkpLib);

// super secret blinding key lol
const blindingKeypair = ECPair.fromPrivateKey(
	Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
);

export function createLiquidMultisig(
	parts: string[],
	arbitrators: string[],
	arbitratorsQuorum: number,
	network: networks.Network,
	internalPublicKey = H
) {
	const eachChildNodeWithArbitratorsQuorum = parts
		.map((p) => combine(arbitrators, arbitratorsQuorum).map((a) => [p, ...a]))
		.flat(1);
	const childNodesCombinations = [parts, ...eachChildNodeWithArbitratorsQuorum];
	const multisigAsms = childNodesCombinations.map(
		(childNodes) =>
			childNodes
				.map((childNode) => toXOnly(Buffer.from(childNode, 'hex')).toString('hex'))
				.map((pubkey, idx) => pubkey + ' ' + (idx ? 'OP_CHECKSIGADD' : 'OP_CHECKSIG'))
				.join(' ') + ` OP_${childNodes.length} OP_NUMEQUAL`
	);

	const multisigScripts = multisigAsms.map((ma, idx) => {
		return {
			// when building Taptree, prioritize parts agreement script (shortest path), using 1 for parts script and 5 for scripts with arbitrators
			weight: idx ? 1 : 5,
			leaf: { output: bitcoinscript.fromASM(ma) },
			combination: childNodesCombinations[idx]
		};
	});

	const hashTree = bip341.toHashTree(
		multisigScripts.map(({ leaf }) => ({
			scriptHex: leaf.output.toString('hex')
		})),
		true
	);

	const scriptPubKey = taprootOutputScript(internalPublicKey, hashTree);

	const address = Address.fromOutputScript(scriptPubKey, network);

	return {
		address,
		confidentialAddress: Address.toConfidential(address, blindingKeypair.publicKey),
		multisigScripts,
		hashTree,
		leaves: multisigScripts.map((script) => ({
			scriptHex: script.leaf.output.toString('hex')
		}))
	};
}

export async function startSpendFromLiquidMultisig(
	hashTree: HashTree,
	redeemOutput: string,
	utxos: {
		txid: string;
		hex: string;
		vout: number;
		value: number | undefined;
	}[],
	network: networks.Network,
	signer: {
		publicKey: Buffer;
		signSchnorr(hash: Buffer): Promise<Buffer> | Buffer;
	},
	receivingAddresses: {
		address: string;
		value: number;
	}[]
) {
	const bip341API = bip341.BIP341Factory(zkpLib.ecc);

	const pset = PsetCreator.newPset();
	const updater = new PsetUpdater(pset);

	const asset = network.assetHash;

	let usedUtxos = utxos.map((utxo) => ({
		txid: utxo.txid,
		txIndex: utxo.vout,
		witnessUtxo: Transaction.fromHex(utxo.hex).outs[utxo.vout],
		sighashType: Transaction.SIGHASH_ALL,
		value: utxo.value
	}));

	const unblindedUtxos = usedUtxos;

	const balance = getUnblindedUtxoValues(utxos).reduce(
		(acc: number, value) => acc + (value ?? 0),
		0
	);

	const sentAmount = receivingAddresses.reduce((acc, { value }) => acc + value, 0);

	const fees = balance - sentAmount;

	console.log('balance:', balance);
	console.log('fees:', fees);

	if (fees < 0) {
		return alert('negative fees');
	}

	updater.addInputs(unblindedUtxos);

	updater.addOutputs([
		...receivingAddresses.map(
			({ address, value }) =>
				new CreatorOutput(
					asset,
					value,
					Address.toOutputScript(address, network),
					Address.fromConfidential(address).blindingKey,
					0
				)
		),
		new CreatorOutput(asset, fees)
	]);

	const leafHash = bip341.tapLeafHash({
		scriptHex: redeemOutput
	});
	const pathToBobLeaf = bip341.findScriptPath(hashTree, leafHash);
	const [tapscript, controlBlock] = bip341API.taprootSignScriptStack(
		H,
		{ scriptHex: redeemOutput },
		hashTree.hash,
		pathToBobLeaf
	);

	unblindedUtxos.forEach((utxo, i) => {
		updater.addInUtxoRangeProof(i, utxo.witnessUtxo.rangeProof!);

		updater.addInTapLeafScript(i, {
			controlBlock,
			leafVersion: bip341.LEAF_VERSION_TAPSCRIPT,
			script: tapscript
		});
	});

	const zkpValidator = new ZKPValidator(zkpLib);
	const zkpGenerator = new ZKPGenerator(
		zkpLib,
		ZKPGenerator.WithBlindingKeysOfInputs(unblindedUtxos.map(() => blindingKeypair.privateKey!))
	);

	const ownedInputs = zkpGenerator.unblindInputs(pset);
	const outputBlindingArgs = zkpGenerator.blindOutputs(pset, Pset.ECCKeysGenerator(ecc));
	// @ts-expect-error see ./myZKP.ts for more info
	const blinder = new PsetBlinder(pset, ownedInputs, zkpValidator, zkpGenerator);
	blinder.blindLast({ outputBlindingArgs });

	await signTaprootTransaction(pset, signer, leafHash, network);

	return pset;
}

export function finalizeTxSpendingFromLiquidMultisig(
	pset: Pset,
	clientSigs: (Buffer | null)[],
	arbitratorSigs: (Buffer | null)[]
) {
	const finalizer = new PsetFinalizer(pset);

	pset.inputs.forEach((_, index) => {
		finalizer.finalizeInput(index, (_) => {
			const input = pset.inputs[index];

			const unlockingScript =
				clientSigs[0] && clientSigs[1]
					? script.compile([clientSigs[1], clientSigs[0]])
					: // this is not working yet
					  script.compile([
							...arbitratorSigs.toReversed().reduce((acc: Buffer[], sig) => {
								if (sig) acc.push(sig);
								return acc;
							}, []),
							...clientSigs.toReversed().reduce((acc: Buffer[], sig) => {
								if (sig) acc.push(sig);
								return acc;
							}, [])
					  ]);

			console.log('unlocking', unlockingScript.toString('hex'));

			const redeemPayment = payments.p2wsh({
				redeem: {
					input: unlockingScript,
					output: input.witnessScript
				}
			});

			const finalScriptWitness = witnessStackToScriptWitness(redeemPayment.witness ?? []);

			return {
				finalScriptSig: Buffer.from(''),
				finalScriptWitness
			};
		});
	});

	finalizer.finalize();
	return PsetExtractor.extract(pset);
}

export function getUnblindedUtxoValues(utxos: { value?: number; vout: number; hex: string }[]) {
	return utxos.map(getUnblindedUtxoValue);
}

export function getUnblindedUtxoValue(
	utxo: { value?: number; vout: number; hex: string },
	index = 0
) {
	if (utxo.value) {
		return utxo.value;
	} else {
		try {
			const unblinded = Confidential.unblindOutputWithKey(
				Transaction.fromHex(utxo.hex).outs[utxo.vout],
				blindingKeypair.privateKey!
			);

			return Number(unblinded.value);
		} catch (error) {
			console.log(`couldn't unblind UTXO ${index}`);

			return null;
		}
	}
}

// @ionio-lang/ionio
export const H: Buffer = Buffer.from(
	'0250929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
	'hex'
);

export function tweakPublicKey(
	publicKey: Buffer,
	hash: Buffer,
	ecc = zkpLib.ecc
): bip341.XOnlyPointAddTweakResult {
	const XOnlyPubKey = publicKey.slice(1, 33);
	const toTweak = Buffer.concat([XOnlyPubKey, hash]);
	const tweakHash = crypto.taggedHash('TapTweak/elements', toTweak);
	const tweaked = ecc.xOnlyPointAddTweak(XOnlyPubKey, tweakHash);
	if (!tweaked) throw new Error('Invalid tweaked key');
	return tweaked;
}

// bip341API.taprootOutputScript
function taprootOutputScript(internalPublicKey: Buffer, tree?: bip341.HashTree | undefined) {
	let treeHash = Buffer.alloc(0);
	if (tree) {
		treeHash = tree.hash;
	}
	const { xOnlyPubkey } = tweakPublicKey(internalPublicKey, treeHash);
	return Buffer.concat([Buffer.from([0x51, 0x20]), xOnlyPubkey]);
}

export async function signTaprootTransaction(
	pset: Pset,
	keypair: {
		publicKey: Buffer;
		signSchnorr(hash: Buffer): Promise<Buffer> | Buffer;
	},
	leafHash: Buffer,
	network: networks.Network,
	sighashType: number = Transaction.SIGHASH_ALL
) {
	const signer = new PsetSigner(pset);

	await Promise.all(
		pset.inputs.map(async (_, i) => {
			const hashType = pset.inputs[i].sighashType || sighashType;

			const sighashmsg = pset.getInputPreimage(i, hashType, network.genesisBlockHash, leafHash);

			const sig = await keypair.signSchnorr(sighashmsg);

			const taprootData = {
				tapScriptSigs: [
					{
						signature: serializeSchnnorrSig(Buffer.from(sig), hashType),
						pubkey: keypair.publicKey.slice(1),
						leafHash
					}
				],
				genesisBlockHash: network.genesisBlockHash
			};

			signer.addSignature(i, taprootData, Pset.SchnorrSigValidator(zkpLib.ecc));
		})
	);
}

const serializeSchnnorrSig = (sig: Buffer, hashtype: number) =>
	Buffer.concat([sig, hashtype !== 0x00 ? Buffer.of(hashtype) : Buffer.alloc(0)]);

export function getTapscriptSigsOrdered(
	pset: Pset,
	clientPubkeys: string[],
	arbitratorPubkeys: string[]
) {
	const clientSigs = clientPubkeys.map(
		(pubkey) =>
			pset.inputs[0].tapScriptSig!.find((sig) => sig.pubkey.toString('hex') === pubkey)
				?.signature ?? null
	);

	const arbitratorSigs = arbitratorPubkeys.map(
		(pubkey) =>
			pset.inputs[0].tapScriptSig!.find((sig) => sig.pubkey.toString('hex') === pubkey)
				?.signature ?? null
	);

	return {
		clientSigs,
		arbitratorSigs
	};
}
