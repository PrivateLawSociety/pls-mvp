import type { LayoutLoad } from './$types';

export const ssr = false;

export const load = (async ({ url }) => {
	const { pathname } = url;

	return {
		pathname
	};
}) satisfies LayoutLoad;
