// coordinator <-- clients
export interface FirstEventPayload {
	pubkey: string;
	isArbitrator: boolean;
	fileHash: string;
}

// coordinator --> clients
export interface SecondEventPayload {
	arbitratorPubkeys: string[];
	arbitratorsQuorum: number;
	clientPubkeys: string[];
}

// coordinator <-- clients
export interface ThirdEventPayload {
	signature: string;
}

// these events are non-standard, I made them up for the purposes of PLS
export const FirstEvent = 26969;
export const SecondEvent = 26970;
export const ThirdEvent = 26971;

export function BitcoinToNostrPubkey(bitcoinPubkey: string) {
	// Bitcoin pubkeys have a prefix, nostr pubkeys don't
	return bitcoinPubkey.slice(-64);
}
