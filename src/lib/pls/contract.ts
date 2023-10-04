import type { ECPairInterface } from 'ecpair';
import { hashFromJSON, tryParseJSON } from '../utils';

export interface PartialContract {
	fileHash: string;
	pubkeys: string[];
}

export interface FinishedContractData {
	fileHash: string;
	multisigAddress: string;
	pubkeys: string[];
	redeemOutput: string;
	signatures: Record<string, string>;
}

export function tryParseFinishedContract(stringifiedContract: string) {
	const maybecontractData = tryParseJSON<FinishedContractData>(stringifiedContract);

	if (
		!maybecontractData ||
		!maybecontractData.fileHash ||
		!maybecontractData.multisigAddress ||
		!maybecontractData.pubkeys ||
		!maybecontractData.redeemOutput ||
		!maybecontractData.signatures
	)
		return null;

	return maybecontractData;
}

/**
 * @description This ensures that other fields are excluded, so that they don't affect the final hash
 */
function getMinimalPartialContract(partialContract: PartialContract) {
	return {
		fileHash: partialContract.fileHash,
		pubkeys: partialContract.pubkeys
	};
}

export function signPartialContract(keypair: ECPairInterface, partialContract: PartialContract) {
	const signature = keypair.sign(hashFromJSON(getMinimalPartialContract(partialContract)));

	return signature;
}

export function verifyPartialContract(
	keypair: ECPairInterface,
	partialContract: PartialContract,
	signature: Buffer
) {
	return keypair.verify(hashFromJSON(getMinimalPartialContract(partialContract)), signature);
}
