export interface PsbtMetadata {
	redeemOutput: string;
	psbtHex: string;
	pubkeys: string[];
}

// also has an '#h' tag, for the contract hash
export interface SpendRequestPayload {
	psbtsMetadata: PsbtMetadata[];
}

// this event is non-standard, I made it up for the purposes of PLS
export const SpendRequestEvent = 26980;
