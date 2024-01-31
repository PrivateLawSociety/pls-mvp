import { goto } from '$app/navigation';
import { NETWORK } from '$lib/bitcoin';
import type { ECPairInterface } from 'ecpair';
import { hashFromJSON } from 'pls-core';

import {
	contractSchema,
	type Contract,
	type UnsignedContract,
	unsignedContractSchema
} from 'pls-full';

export function tryParseFinishedContract(stringifiedContract: string) {
	const json = JSON.parse(stringifiedContract);
	const parsed = contractSchema.safeParse(json);

	if (parsed.success) {
		if (NETWORK.name !== parsed.data.collateral.network) {
			alert(
				`This contract is on the ${parsed.data.collateral.network} network, please switch to it`
			);
			goto('/');
			return null;
		}

		return parsed.data;
	} else {
		alert('Error validating contract');
		console.log(parsed.error);
		return null;
	}
}

/**
 * @description This ensures that other fields are excluded, so that they don't affect the final hash
 */
function getMinimalUnsignedContract(unsignedContract: UnsignedContract): UnsignedContract {
	return unsignedContractSchema.strip().parse(unsignedContract);
}

export async function signContract(
	signer: {
		signSchnorr(hash: Buffer): Promise<Buffer> | Buffer;
	},
	unsignedContract: UnsignedContract
) {
	const signature = await signer.signSchnorr(
		hashFromJSON(getMinimalUnsignedContract(unsignedContract))
	);

	return signature;
}

export function verifyContract(keypair: ECPairInterface, contract: Contract, signature: Buffer) {
	return keypair.verifySchnorr(hashFromJSON(getMinimalUnsignedContract(contract)), signature);
}
