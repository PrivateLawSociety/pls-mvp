import { createHash } from 'crypto';

// this should probably be replaced by something safer later
export function tryParseJSON<T>(json: string) {
	try {
		return JSON.parse(json) as T;
	} catch (error) {
		return null;
	}
}

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
