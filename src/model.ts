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
	group?: boolean;
}

export type CategoryMatchKeys = 'matches' | 'private' | 'reach';
export type CategoryMatchFunction = (pkg: unknown, category: PackageCategory) => boolean | undefined;
export type CategoryMatchFunctionGenerator = (strength: string) => CategoryMatchFunction;

export interface PackageCategories<T = RegExp, Matcher = CategoryMatchFunction> {
	rules: PackageCategory<T>[];
	order: Matcher;
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
	generators: Record<CategoryMatchKeys, CategoryMatchFunctionGenerator>,
): Promise<PackageCategories> {
	if (fileName != undefined) {
		const text = await Deno.readTextFile(fileName);
		const data = JSON.parse(text) as PackageCategories<string, (string | [string, string])[] | undefined>;

		const order = (data.order ?? ['matches', 'private']).map((pos) => {
			if (Array.isArray(pos)) {
				const [name, strength] = pos;
				return generators[name as CategoryMatchKeys](strength);
			}
			return generators[pos as CategoryMatchKeys]('');
		}).filter((matcher) => matcher !== undefined);

		return {
			rules: data.rules.map((cat): PackageCategory => ({
				...cat,
				matches: cat.matches === undefined ? undefined : new RegExp(cat.matches),
			})),
			order: (pkg, category) => matcherFunction(pkg, category, order),
		};
	}
	return { rules: [], order: () => true };
}
