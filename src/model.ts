// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

export const PACKAGE = 'package.json';

export interface PackageCategory<T = RegExp> {
	id: string;
	matches?: T;
	private?: boolean;
	reach?: boolean | number;
	legend?: string;
	fill?: string;
	group?: boolean | string;
}

export type CategoryMatchKeys = 'matches' | 'private' | 'reach';

export type CategoryMatchFunction = (pkg: unknown, category: PackageCategory) => boolean | undefined;

export interface PackageCategories<T = RegExp, Matcher = CategoryMatchFunction> {
	rules: PackageCategory<T>[];
	matcher: Matcher;
}

export interface Node {
	id: string;
	sortKey: string;
	children: Set<string>;
}

function matcherFunction(pkg: unknown, category: PackageCategory, order: CategoryMatchFunction[]) {
	for (const matcher of order) {
		const result = matcher(pkg, category);
		if (result !== undefined) {
			return result;
		}
	}
	return true;
}

export async function readPackageCategories(
	fileName: string | undefined,
	generators: Record<CategoryMatchKeys, CategoryMatchFunction>,
): Promise<PackageCategories> {
	if (fileName !== undefined && fileName !== '') {
		const text = await Deno.readTextFile(fileName);
		const data = JSON.parse(text) as PackageCategories<
			string,
			CategoryMatchKeys[] | undefined
		>;

		const matcher = (data.matcher ?? ['matches', 'private', 'reach']).map((pos) => {
			return generators[pos];
		}).filter((matcher) => matcher !== undefined);

		return {
			rules: data.rules.map((cat): PackageCategory => ({
				...cat,
				matches: cat.matches === undefined ? undefined : new RegExp(cat.matches),
			})),
			matcher: (pkg, category) => matcherFunction(pkg, category, matcher),
		};
	}
	return { rules: [], matcher: () => true };
}
