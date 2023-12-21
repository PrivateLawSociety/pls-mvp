import { NETWORK } from './bitcoin';

export interface UTXO {
	txid: string;
	vout: number;
	value: number;
}

const MEMPOOL_API_URL = getMempoolAPIUrl();

function getMempoolAPIUrl() {
	const start = NETWORK.isLiquid ? 'https://blockstream.info' : 'https://mempool.space';

	const end = NETWORK.isTestnet
		? NETWORK.isLiquid
			? `/liquidtestnet/api`
			: `/testnet/api`
		: `/api`;

	return start + end;
}

export async function getTransactionHexFromId(txId: string) {
	try {
		const res = await fetch(`${MEMPOOL_API_URL}/tx/${txId}/hex`);

		if (!res.ok) {
			console.log(res);
			const text = await res.text();
			if (text == 'Address on invalid network') {
				alert('Contract is on the wrong network (testnet vs mainnet)');
			}
			return null;
		}

		return await res.text();
	} catch (error) {
		alert(
			`Couldn't connect to mempool.space. Try disabling your adblocker or try using another browser`
		);
		console.log(error);
		return null;
	}
}

export async function getAddressUtxos(address: string) {
	try {
		const res = await fetch(`${MEMPOOL_API_URL}/address/${address}/utxo`);

		if (!res.ok) {
			console.log(res);
			const text = await res.text();
			if (text == 'Address on invalid network') {
				alert('Contract is on the wrong network (testnet vs mainnet)');
			}
			return null;
		}

		return (await res.json()) as UTXO[];
	} catch (error) {
		alert(
			`Couldn't connect to mempool.space. Try disabling your adblocker or try using another browser`
		);
		console.log(error);
		return null;
	}
}

export async function getAddressUnconfirmedTxs(address: string) {
	try {
		const res = await fetch(`${MEMPOOL_API_URL}/address/${address}/txs/mempool`);

		if (!res.ok) {
			console.log(res);
			const text = await res.text();
			if (text == 'Address on invalid network') {
				alert('Contract is on the wrong network (testnet vs mainnet)');
			}
			return null;
		}

		return (await res.json()) as {
			txid: string;
			vin: {
				txid: string;
				vout: number;
				prevout: {
					value: number;
				};
				sequence: number;
			}[];
		}[];
	} catch (error) {
		alert(
			`Couldn't connect to mempool.space. Try disabling your adblocker or try using another browser`
		);
		console.log(error);
		return null;
	}
}

export async function publishTransaction(transactionHex: string) {
	try {
		const res = await fetch(`${MEMPOOL_API_URL}/tx`, {
			method: 'POST',
			body: transactionHex
		});

		const text = await res.text();

		if (res.ok) {
			alert(`Transaction published! TxId: ${text}`);
			return text;
		} else {
			alert(`Error: ${text}`);
			return null;
		}
	} catch (error) {
		alert('Error while publishing! Try disabling your adblocker or try using another browser');
		return null;
	}
}
