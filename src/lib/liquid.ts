import {
	Transaction,
	address as Address,
	networks,
	payments,
	confidential,
	script,
	crypto
} from 'liquidjs-lib';
import { ECPair } from './bitcoin';
import type { Signer, SignerAsync } from 'ecpair';

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

import { testnet } from 'liquidjs-lib/src/networks';

import { ZKPGenerator, ZKPValidator } from './myZKP';

import * as ecc from 'tiny-secp256k1';

import secp256k1 from '@vulpemventures/secp256k1-zkp';

import { bip341 } from 'liquidjs-lib';
import { OPS } from 'liquidjs-lib/src/ops';

const zkpLib = await secp256k1();

export const Confidential = new confidential.Confidential(zkpLib);

// super secret blinding key lol
const blindingKeypair = ECPair.fromPrivateKey(
	Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
);

export function createLiquidMultisig(
	parts: string[],
	arbitrators: string[],
	// this supports only 1 arbitrator for now
	// TODO: change that
	arbitratorsQuorum: number,
	network: networks.Network,
	internalPublicKey = H
) {
	const lockingScript = script.fromASM(
		`${parts[0].slice(-64)}
		OP_CHECKSIG
		OP_TOALTSTACK
		${parts[1].slice(-64)}
		OP_CHECKSIG
		OP_FROMALTSTACK
		OP_ADD
		OP_DUP
		OP_2
		OP_EQUAL
		OP_IF
		
		OP_ELSE
			OP_1
			OP_EQUAL
			OP_IF
				OP_1
				${arbitrators[0].slice(-64)}
				OP_1
				OP_CHECKMULTISIGVERIFY
				OP_1
			OP_ELSE
				OP_RETURN
			OP_ENDIF
		OP_ENDIF`
			.trim()
			.replace(/\s+/g, ' ')
	);

	const leaves = [
		{
			scriptHex: lockingScript.toString('hex')
		}
	];

	// const bip341API = bip341.BIP341Factory(zkpLib.ecc);
	const hashTree = bip341.toHashTree(leaves);

	const scriptPubKey = taprootOutputScript(internalPublicKey, hashTree);

	const address = Address.fromOutputScript(scriptPubKey, network);

	return {
		address,
		confidentialAddress: Address.toConfidential(address, blindingKeypair.publicKey),
		tapleafHash: hashTree.hash,
		leaves
	};
}

export async function startSpendFromLiquidMultisig(
	multisig: {
		leaves: {
			scriptHex: string;
		}[];
		tapleafHash: Buffer;
	},
	utxos: {
		txid: string;
		hex: string;
		vout: number;
		value: number | undefined;
	}[],
	network: networks.Network,
	signer: (Signer | SignerAsync) & { privateKey?: Buffer },
	receivingAddresses: {
		address: string;
		value: number;
	}[]
) {
	const bip341API = bip341.BIP341Factory(zkpLib.ecc);

	const pset = PsetCreator.newPset();
	const updater = new PsetUpdater(pset);

	const asset = testnet.assetHash;

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
					blindingKeypair.publicKey!,
					0
				)
		),
		new CreatorOutput(asset, fees)
	]);

	const hashTree = bip341.toHashTree(multisig.leaves);

	const leafHash = bip341.tapLeafHash(multisig.leaves[0]);
	const pathToBobLeaf = bip341.findScriptPath(hashTree, leafHash);
	const [tapscript, controlBlock] = bip341API.taprootSignScriptStack(
		H,
		multisig.leaves[0],
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
							arbitratorSigs[0]!,
							clientSigs[1] ?? OPS.OP_0,
							clientSigs[0] ?? OPS.OP_0
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
	keypair: (Signer | SignerAsync) & { privateKey?: Buffer },
	leafHash: Buffer,
	network: networks.Network = networks.testnet,
	sighashType: number = Transaction.SIGHASH_ALL
) {
	const signer = new PsetSigner(pset);

	await Promise.all(
		pset.inputs.map(async (_, i) => {
			const hashType = pset.inputs[i].sighashType || sighashType;

			const sighashmsg = pset.getInputPreimage(i, hashType, network.genesisBlockHash, leafHash);

			// TODO TODO TODO
			const sig = zkpLib.ecc.signSchnorr(sighashmsg, keypair.privateKey!, Buffer.alloc(32));

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
