// This file is a direct copy of a file in liquidjs-lib, except for the imports.
// This was done due to a problem with the use of node.js buffers in the library, but copying it over is enough for it to use a polyfill instead of the browser Buffer.
// TODO: try to solve this better, maybe the `patch-package` library could help

import { Confidential, type UnblindOutputResult } from 'liquidjs-lib/src/confidential';
import { type Output, ZERO } from 'liquidjs-lib/src/transaction';
import { ElementsValue } from 'liquidjs-lib/src/value';
import { randomBytes } from 'liquidjs-lib/src/psetv2/utils';
// import type { Slip77Interface } from 'slip77';
type Slip77Interface = any;
import type { RngOpts } from 'liquidjs-lib/src/psetv2/interfaces';
import type { KeysGenerator, Pset } from 'liquidjs-lib/src/psetv2/pset';
import type {
	IssuanceBlindingArgs,
	OutputBlindingArgs,
	OwnedInput
} from 'liquidjs-lib/src/psetv2/blinder';
import { calculateReissuanceToken } from 'liquidjs-lib/src/issuance';
import { AssetHash } from 'liquidjs-lib/src/asset';
import type { Secp256k1Interface as ZKPInterface } from 'liquidjs-lib/src/secp256k1-zkp';

export class ZKPValidator {
	private confidential: Confidential;

	constructor(zkpLib: ZKPInterface) {
		this.confidential = new Confidential(zkpLib);
	}

	verifyValueRangeProof(
		proof: Buffer,
		valueCommitment: Buffer,
		assetCommitment: Buffer,
		script: Buffer
	): boolean {
		try {
			return this.confidential.rangeProofVerify(proof, valueCommitment, assetCommitment, script);
		} catch (ignore) {
			return false;
		}
	}

	verifyAssetSurjectionProof(
		inAssets: Buffer[],
		inAssetBlinders: Buffer[],
		outAsset: Buffer,
		outAssetBlinder: Buffer,
		proof: Buffer
	): boolean {
		try {
			return this.confidential.surjectionProofVerify(
				inAssets,
				inAssetBlinders,
				outAsset,
				outAssetBlinder,
				proof
			);
		} catch (ignore) {
			return false;
		}
	}

	verifyBlindValueProof(proof: Buffer, valueCommitment: Buffer, assetCommitment: Buffer): boolean {
		try {
			return this.confidential.rangeProofVerify(proof, valueCommitment, assetCommitment);
		} catch (ignore) {
			return false;
		}
	}

	verifyBlindAssetProof(asset: Buffer, assetCommit: Buffer, proof: Buffer): boolean {
		try {
			return this.confidential.assetBlindProofVerify(asset, assetCommit, proof);
		} catch (ignore) {
			return false;
		}
	}
}

type ZKPGeneratorOption = (g: ZKPGenerator) => void;
export class ZKPGenerator {
	private ownedInputs?: OwnedInput[];
	private inBlindingKeys?: Buffer[];
	private masterBlindingKey?: Slip77Interface;
	private opts?: RngOpts;
	private confidential: Confidential;

	constructor(private zkp: ZKPInterface, ...options: ZKPGeneratorOption[]) {
		this.confidential = new Confidential(zkp);
		for (const option of options) {
			option(this);
		}
	}

	static WithBlindingKeysOfInputs(inBlindingKeys: Buffer[]): ZKPGeneratorOption {
		return (g: ZKPGenerator): void => {
			g.inBlindingKeys = inBlindingKeys;
		};
	}

	static WithMasterBlindingKey(masterKey: Slip77Interface): ZKPGeneratorOption {
		return (g: ZKPGenerator): void => {
			g.masterBlindingKey = masterKey;
		};
	}

	static WithOwnedInputs(ownedInputs: OwnedInput[]): ZKPGeneratorOption {
		return (g: ZKPGenerator): void => {
			g.ownedInputs = ownedInputs;
		};
	}

	computeAndAddToScalarOffset(
		scalar: Buffer,
		value: string,
		assetBlinder: Buffer,
		valueBlinder: Buffer
	): Buffer {
		// If both asset and value blinders are null, 0 is added to the offset, so nothing actually happens
		if (assetBlinder.equals(ZERO) && valueBlinder.equals(ZERO)) {
			return scalar.slice();
		}

		const scalarOffset = this.calculateScalarOffset(value, assetBlinder, valueBlinder);

		// When we start out, the result (a) is 0, so just set it to the scalar we just computed.
		if (scalar.equals(ZERO)) {
			return scalarOffset;
		}

		const { ecc } = this.zkp;
		const negScalarOffset = scalarOffset.equals(ZERO)
			? scalarOffset
			: Buffer.from(ecc.privateNegate(scalarOffset));

		if (scalar.equals(negScalarOffset)) {
			return ZERO;
		}

		return Buffer.from(ecc.privateAdd(scalar, scalarOffset));
	}

	subtractScalars(inputScalar: Buffer, outputScalar: Buffer): Buffer {
		if (outputScalar.equals(ZERO)) {
			return inputScalar.slice();
		}
		const { ecc } = this.zkp;
		const negOutputScalar = Buffer.from(ecc.privateNegate(outputScalar));
		if (inputScalar.equals(ZERO)) {
			return negOutputScalar;
		}
		return Buffer.from(ecc.privateAdd(inputScalar, negOutputScalar));
	}

	lastValueCommitment(value: string, asset: Buffer, blinder: Buffer): Buffer {
		return this.confidential.valueCommitment(value, asset, blinder);
	}

	lastBlindValueProof(
		value: string,
		valueCommit: Buffer,
		assetCommit: Buffer,
		blinder: Buffer
	): Buffer {
		const nonce = randomBytes(this.opts);
		return this.confidential.blindValueProof(value, valueCommit, assetCommit, blinder, nonce);
	}

	lastValueRangeProof(
		value: string,
		asset: Buffer,
		valueCommitment: Buffer,
		assetCommitment: Buffer,
		valueBlinder: Buffer,
		assetBlinder: Buffer,
		nonce: Buffer,
		script: Buffer
	): Buffer {
		return this.confidential.rangeProof(
			value,
			asset,
			valueCommitment,
			assetCommitment,
			valueBlinder,
			assetBlinder,
			nonce,
			script
		);
	}

	unblindInputs(pset: Pset, inIndexes?: number[]): OwnedInput[] {
		validatePset(pset);
		if (inIndexes) {
			validateInIndexes(pset, inIndexes);
		}

		const inputIndexes = inIndexes || Array.from({ length: pset.globals.inputCount }, (_, i) => i);

		if (this.ownedInputs && this.ownedInputs.length > 0) {
			return this.ownedInputs;
		}

		const revealedInputs = inputIndexes.map((i) => {
			const prevout = pset.inputs[i].getUtxo();
			const revealedInput = this.unblindUtxo(prevout!);
			revealedInput.index = i;
			return revealedInput;
		});
		this.ownedInputs = revealedInputs;
		return revealedInputs;
	}

	blindIssuances(pset: Pset, blindingKeysByIndex: Record<number, Buffer>): IssuanceBlindingArgs[] {
		validatePset(pset);
		validateBlindingKeysByIndex(pset, blindingKeysByIndex);

		return Object.entries(blindingKeysByIndex).map(([i, key]) => {
			const input = pset.inputs[parseInt(i, 10)];

			let blindingArgs = {} as IssuanceBlindingArgs;
			if (input.issuanceValue! > 0) {
				const value = input.issuanceValue!.toString(10);
				const asset = input.getIssuanceAssetHash()!;
				const blinder = randomBytes(this.opts);

				const assetCommitment = this.confidential.assetCommitment(asset, ZERO);
				const valueCommitment = this.confidential.valueCommitment(value, assetCommitment, blinder);
				const nonce = randomBytes(this.opts);
				const blindproof = this.confidential.blindValueProof(
					value,
					valueCommitment,
					assetCommitment,
					blinder,
					nonce
				);
				const rangeproof = this.confidential.rangeProof(
					value,
					asset,
					valueCommitment,
					assetCommitment,
					blinder,
					ZERO,
					key,
					Buffer.from([])
				);

				blindingArgs = {
					...blindingArgs,
					index: parseInt(i, 10),
					issuanceAsset: asset,
					issuanceValueCommitment: valueCommitment,
					issuanceValueRangeProof: rangeproof,
					issuanceValueBlindProof: blindproof,
					issuanceValueBlinder: blinder
				};
			}

			if (input.issuanceInflationKeys! > 0) {
				const token = input.issuanceInflationKeys!.toString(10);
				const entropy = input.getIssuanceEntropy();
				const asset = calculateReissuanceToken(entropy, true);
				if (!asset)
					throw new Error('something went wrong during the inflation token hash computation');
				const blinder = randomBytes(this.opts);
				const assetCommitment = this.confidential.assetCommitment(asset, ZERO);
				const tokenCommitment = this.confidential.valueCommitment(token, assetCommitment, blinder);
				const nonce = randomBytes(this.opts);
				const blindproof = this.confidential.blindValueProof(
					token,
					tokenCommitment,
					assetCommitment,
					blinder,
					nonce
				);
				const rangeproof = this.confidential.rangeProof(
					token,
					asset,
					tokenCommitment,
					assetCommitment,
					blinder,
					ZERO,
					key,
					Buffer.from([])
				);

				blindingArgs = {
					...blindingArgs,
					issuanceToken: asset,
					issuanceTokenCommitment: tokenCommitment,
					issuanceTokenRangeProof: rangeproof,
					issuanceTokenBlindProof: blindproof,
					issuanceTokenBlinder: blinder
				};
			}

			return blindingArgs;
		});
	}

	blindOutputs(
		pset: Pset,
		keysGenerator: KeysGenerator,
		outIndexes?: number[]
	): OutputBlindingArgs[] {
		validatePset(pset);
		if (outIndexes) {
			validateOutIndexes(pset, outIndexes);
		}

		const outputIndexes =
			outIndexes && outIndexes.length > 0
				? outIndexes
				: pset.outputs.reduce(
						(arr: number[], out, i) => (out.needsBlinding() && arr.push(i), arr),
						[]
				  );

		const { assets, assetBlinders } = this.getInputAssetsAndBlinders(pset);

		return outputIndexes.map((i) => {
			const output = pset.outputs[i];
			const assetBlinder = randomBytes(this.opts);
			const valueBlinder = randomBytes(this.opts);
			const seed = randomBytes(this.opts);
			const value = output.value!.toString(10);
			const assetCommitment = this.confidential.assetCommitment(output.asset!, assetBlinder);
			const valueCommitment = this.confidential.valueCommitment(
				value,
				assetCommitment,
				valueBlinder
			);
			const ephemeralKeyPair = keysGenerator();
			const nonceCommitment = ephemeralKeyPair.publicKey;
			const ecdhNonce = this.confidential.nonceHash(
				output.blindingPubkey!,
				ephemeralKeyPair.privateKey
			);
			const script = output.script || Buffer.from([]);
			const rangeproof = this.confidential.rangeProof(
				value,
				output.asset!,
				valueCommitment,
				assetCommitment,
				valueBlinder,
				assetBlinder,
				ecdhNonce,
				script
			);
			const surjectionproof = this.confidential.surjectionProof(
				output.asset!,
				assetBlinder,
				assets,
				assetBlinders,
				seed
			);
			const nonce = randomBytes(this.opts);
			const valueBlindProof = this.confidential.blindValueProof(
				value,
				valueCommitment,
				assetCommitment,
				valueBlinder,
				nonce
			);
			const assetBlindProof = this.confidential.blindAssetProof(
				output.asset!,
				assetCommitment,
				assetBlinder
			);

			return {
				index: i,
				nonce: ecdhNonce,
				nonceCommitment,
				valueCommitment,
				assetCommitment,
				valueRangeProof: rangeproof,
				assetSurjectionProof: surjectionproof,
				valueBlindProof,
				assetBlindProof,
				valueBlinder,
				assetBlinder
			};
		});
	}

	private calculateScalarOffset(value: string, assetBlinder: Buffer, valueBlinder: Buffer): Buffer {
		if (valueBlinder.length === 0) {
			throw new Error('missing value blinder');
		}
		if (assetBlinder.equals(ZERO)) {
			return valueBlinder.slice();
		}
		if (value === '0') {
			return valueBlinder.slice();
		}

		const { ecc } = this.zkp;
		const val = Buffer.alloc(32, 0);
		val.writeBigUInt64BE(BigInt(value), 24);
		const result = Buffer.from(ecc.privateMul(assetBlinder, val));
		const negVb = Buffer.from(ecc.privateNegate(valueBlinder));

		if (negVb.equals(result)) {
			return ZERO;
		}

		return Buffer.from(ecc.privateAdd(result, valueBlinder));
	}

	private unblindUtxo(out: Output): OwnedInput {
		if (out.nonce.length === 1) {
			return {
				index: 0,
				value: ElementsValue.fromBytes(out.value).number.toString(10),
				asset: out.asset.slice(1),
				valueBlindingFactor: ZERO,
				assetBlindingFactor: ZERO
			};
		}

		if (!this.inBlindingKeys && !this.masterBlindingKey) {
			throw new Error('Missing either input private blinding keys or SLIP-77 master blinding key');
		}

		const keys = this.inBlindingKeys
			? this.inBlindingKeys
			: [this.masterBlindingKey!.derive(out.script).privateKey!];

		for (const key of keys) {
			try {
				const revealed = this.confidential.unblindOutputWithKey(out, key);
				return {
					index: 0,
					value: revealed.value,
					asset: revealed.asset,
					valueBlindingFactor: revealed.valueBlindingFactor,
					assetBlindingFactor: revealed.assetBlindingFactor
				};
			} catch (ignore) {}
		}

		throw new Error('Could not unblind output with any blinding key');
	}

	private getInputAssetsAndBlinders(pset: Pset): {
		assets: Buffer[];
		assetBlinders: Buffer[];
	} {
		const assets: Buffer[] = [];
		const assetBlinders: Buffer[] = [];

		const unblindedIns = this.maybeUnblindInUtxos(pset);

		for (const unblindedIn of unblindedIns) {
			assets.push(unblindedIn.asset);
			assetBlinders.push(unblindedIn.assetBlindingFactor);
		}

		pset.inputs.forEach((input, i) => {
			if (input.hasIssuance() || input.hasReissuance()) {
				const issAssetHash = input.getIssuanceAssetHash();
				if (!issAssetHash)
					throw new Error(
						`something went wrong while getting the issuance asset hash on input #${i}`
					);

				assets.push(issAssetHash);
				assetBlinders.push(ZERO);

				if (!input.hasReissuance() && input.issuanceInflationKeys! > 0) {
					const entropy = input.getIssuanceEntropy();

					const inflationTokenAssetHash = calculateReissuanceToken(
						entropy,
						input.blindedIssuance ?? true
					);
					if (!inflationTokenAssetHash)
						throw new Error(
							`something went wrong computing the issuance inflation keys hash on input #${i}`
						);

					assets.push(inflationTokenAssetHash);
					assetBlinders.push(ZERO);
				}
			}
		});

		return { assets, assetBlinders };
	}

	private maybeUnblindInUtxos(pset: Pset): UnblindOutputResult[] {
		if (this.ownedInputs && this.ownedInputs.length > 0) {
			return pset.inputs.map((input, i) => {
				const ownedInput = this.ownedInputs?.find(({ index }) => index === i);
				if (ownedInput) {
					return {
						value: '',
						valueBlindingFactor: Buffer.from([]),
						asset: ownedInput.asset,
						assetBlindingFactor: ownedInput.assetBlindingFactor
					};
				}

				const utxo: Output | undefined = input.getUtxo();
				if (!utxo) {
					throw new Error(`Missing utxo for input #${i}`);
				}

				return {
					value: '',
					valueBlindingFactor: Buffer.from([]),
					asset: AssetHash.fromBytes(utxo.asset).bytesWithoutPrefix,
					assetBlindingFactor: ZERO
				};
			});
		}

		if (!this.inBlindingKeys && !this.masterBlindingKey) {
			throw new Error('Missing either input private blinding keys or SLIP-77 master blinding key');
		}

		return pset.inputs.map((input) => {
			const prevout = input.getUtxo()!;
			try {
				const revealed = this.unblindUtxo(prevout);
				return {
					value: revealed.value,
					asset: revealed.asset,
					valueBlindingFactor: revealed.valueBlindingFactor,
					assetBlindingFactor: revealed.assetBlindingFactor
				};
			} catch (ignore) {
				return {
					value: '',
					asset: prevout.asset,
					valueBlindingFactor: Buffer.from([]),
					assetBlindingFactor: ZERO
				};
			}
		});
	}
}

function validatePset(pset: Pset): void {
	pset.sanityCheck();

	pset.inputs.forEach((input, i) => {
		if (!input.getUtxo()) {
			throw new Error('Missing (non-)witness utxo for input ' + i);
		}
	});
}

function validateInIndexes(pset: Pset, inIndexes: number[]): void {
	if (inIndexes.length > 0) {
		inIndexes.forEach((i) => {
			if (i < 0 || i >= pset.globals.inputCount) {
				throw new Error('Input index out of range');
			}
		});
	}
}

function validateOutIndexes(pset: Pset, outIndexes: number[]): void {
	if (outIndexes.length > 0) {
		outIndexes.forEach((i) => {
			if (i < 0 || i >= pset.globals.outputCount) {
				throw new Error('Output index out of range');
			}
		});
	}
}

function validateBlindingKeysByIndex(pset: Pset, keys: Record<number, Buffer>): void {
	Object.entries(keys).forEach(([k, v]) => {
		const i = parseInt(k, 10);
		if (i < 0 || i >= pset.globals.inputCount) {
			throw new Error('Input index out of range');
		}
		if (!pset.inputs[i].hasIssuance() && !pset.inputs[i].hasReissuance()) {
			throw new Error('Input does not have any issuance or reissuance to blind');
		}
		if (v.length !== 32) {
			throw new Error('Invalid private blinding key length for input ' + i);
		}
	});
}
