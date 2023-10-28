import type { ECPairInterface } from 'ecpair';
import { hashFromJSON, tryParseJSON } from '../utils';

export interface PartialContract {
	arbitratorPubkeys: string[];
	arbitratorsQuorum: number;
	clientPubkeys: string[];
	fileHash: string;
}

export interface FinishedContractData {
	arbitratorPubkeys: string[];
	arbitratorsQuorum: number;
	clientPubkeys: string[];
	fileHash: string;
	multisigAddress: string;
	signatures: Record<string, string>;
}

export function tryParseFinishedContract(stringifiedContract: string) {
	const maybecontractData = tryParseJSON<FinishedContractData>(stringifiedContract);

	if (
		!maybecontractData ||
		!maybecontractData.arbitratorPubkeys ||
		!maybecontractData.arbitratorsQuorum ||
		!maybecontractData.clientPubkeys ||
		!maybecontractData.fileHash ||
		!maybecontractData.multisigAddress ||
		!maybecontractData.signatures
	)
		return null;

	return maybecontractData;
}

/**
 * @description This ensures that other fields are excluded, so that they don't affect the final hash
 */
function getMinimalPartialContract(partialContract: PartialContract): PartialContract {
	return {
		arbitratorPubkeys: partialContract.arbitratorPubkeys,
		arbitratorsQuorum: partialContract.arbitratorsQuorum,
		clientPubkeys: partialContract.clientPubkeys,
		fileHash: partialContract.fileHash
	};
}

export async function signPartialContract(
	signer: {
		signSchnorr(hash: Buffer): Promise<Buffer> | Buffer;
	},
	partialContract: PartialContract
) {
	const signature = await signer.signSchnorr(
		hashFromJSON(getMinimalPartialContract(partialContract))
	);

	return signature;
}

export function verifyPartialContract(
	keypair: ECPairInterface,
	partialContract: PartialContract,
	signature: Buffer
) {
	return keypair.verifySchnorr(hashFromJSON(getMinimalPartialContract(partialContract)), signature);
}
