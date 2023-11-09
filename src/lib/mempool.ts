import { isMainnet } from './bitcoin';

export interface UTXO {
	txid: string;
	vout: number;
	value: number;
}

const MEMPOOL_API_URL = 'https://mempool.space' + (isMainnet() ? `/api` : `/testnet/api`);

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

export async function getTransactionHexFromId(txid: string) {
	try {
		const res = await fetch(`${MEMPOOL_API_URL}/tx/${txid}/hex`);

		if (!res.ok) {
			console.log(res);
			return null;
		}

		return res.text();
	} catch (error) {
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
