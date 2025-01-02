import { type NetworkNames } from '$lib/bitcoin';

// maker ---> takers
export interface ContractRequestPayload {
	arbitratorPubkeys: string[];
	arbitratorsQuorum: number;
	clientPubkeys: string[];
	fileHash: string;
	network: NetworkNames;
}

// // taker ---> maker + other takers
export interface ContractApprovalPayload {
	signature: string;
	fileHash: string;
}

// these events are non-standard, I made them up for the purposes of PLS
export const ContractRequestEvent = 26970;
export const ContractApprovalEvent = 26971;
