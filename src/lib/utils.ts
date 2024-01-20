import { createHash } from 'crypto';

/**
 * @description Sorts an object's properties
 */
function sortObjectProperties<T>(obj: Record<string, T>): Record<string, T> {
	const sortedObj: Record<string, any> = {};

	const sortedKeys = Object.keys(obj).sort();

	for (const key of sortedKeys) {
		const value = obj[key];

		if (typeof value == 'object') {
			sortedObj[key] = sortObjectProperties(value as any);
		} else {
			sortedObj[key] = obj[key];
		}
	}

	return sortedObj;
}

/**
 * @description hashes an Object deterministically
 */
export function hashFromJSON(obj: Record<string, any>) {
	const json = JSON.stringify(sortObjectProperties(obj));

	return createHash('sha256')
		.update(new Uint8Array(Buffer.from(json)))
		.digest();
}

function hashFromArrayBuffer(arrayBuffer: ArrayBuffer) {
	return createHash('sha256').update(new Uint8Array(arrayBuffer)).digest();
}

export async function hashFromFile(file: File) {
	return hashFromArrayBuffer(await file.arrayBuffer());
}

export function formatDateTime(date: Date) {
	const hourTime = new Intl.DateTimeFormat('default', {
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	}).format(date);

	const dateTime = new Intl.DateTimeFormat('default', {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric'
	}).format(date);

	return `${dateTime} - ${hourTime}`;
}

export function downloadBlob(blob: Blob, filename: string) {
	const a = document.createElement('a');
	const url = window.URL.createObjectURL(blob);
	a.href = url;
	a.download = filename;

	a.click();
	window.URL.revokeObjectURL(url);
}
