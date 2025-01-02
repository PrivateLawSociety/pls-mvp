export interface UTXO {
	txid: string;
	vout: number;
	value: number;
}

// const MEMPOOL_API_URL = getMempoolAPIUrl();

export function createMempoolApi(network: { isLiquid: boolean; isTestnet: boolean }) {
	const start = network.isLiquid ? 'https://blockstream.info' : 'https://mempool.space';

	const end = network.isTestnet
		? network.isLiquid
			? `/liquidtestnet/api`
			: `/testnet/api`
		: network.isLiquid
		? `/liquid/api`
		: `/api`;

	const url = start + end;

	return {
		async getTransactionHexFromId(txId: string) {
			try {
				const res = await fetch(`${url}/tx/${txId}/hex`);

				if (!res.ok) {
					const text = await res.text();
					console.log(text);
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
		},

		async getAddressUtxos(address: string) {
			try {
				const res = await fetch(`${url}/address/${address}/utxo`);

				if (!res.ok) {
					const text = await res.text();
					console.log(text);
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
		},

		async getAddressUnconfirmedTxs(address: string) {
			try {
				const res = await fetch(`${url}/address/${address}/txs/mempool`);

				if (!res.ok) {
					const text = await res.text();
					console.log(text);
					return null;
				}

				return (await res.json()) as {
					txid: string;
					vin: {
						txid: string;
						vout: number;
						prevout: {
							scriptpubkey_address: string;
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
		},
		async publishTransaction(transactionHex: string) {
			try {
				const res = await fetch(`${url}/tx`, {
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
	};
}
