// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import * as fs from 'https://deno.land/std@0.218.0/fs/mod.ts';
import { CategoryMatchFunction, PackageCategories, PackageCategory } from './model.ts';
import { PACKAGE } from './model.ts';
import { Node } from './model.ts';
import { intersection, union } from './set.ts';
import { CategoryMatchFunctionGenerator, CategoryMatchKeys } from './model.ts';

export function safe_filename(name: string) {
	return name.replace(/[\/ ]/g, '__').replace(/@/g, '[at]_');
}

export class Package {
	location: string;
	name: string;
	version?: string;
	isPrivate: boolean;
	requires: Set<string>;
	neededBy: Set<string> = new Set();
	packages: Package[] = [];
	filenameBase = '';
	fill: string | undefined = undefined;

	constructor(
		location: string,
		name: string,
		version: string | undefined,
		isPrivate: boolean,
		requires: Set<string>,
	) {
		this.location = location;
		this.name = name;
		this.version = version;
		this.isPrivate = isPrivate;
		this.requires = requires;
	}

	get label() {
		const version = this.version === undefined ? '' : `\nv${this.version}`;
		return `${this.name}${version}\n${this.location}`;
	}

	get node(): Node {
		return { id: this.name, sortKey: this.location, children: new Set(this.requires) };
	}

	reach() {
		return union(union(new Set([this.name]), this.requires), this.neededBy);
	}

	matches(category: PackageCategory, matcher: CategoryMatchFunction) {
		return matcher(this, category);
	}

	matchCategory(categories: PackageCategories) {
		for (const category of categories.rules) {
			if (this.matches(category, categories.order)) return category;
		}
		return undefined;
	}

	paintPackages(categories: PackageCategories) {
		this.packages.forEach((pkg) => {
			const cat = pkg.matchCategory(categories);
			if (cat === undefined) return;
			pkg.fill = cat.fill;
		});
	}

	static async load(packagePath: string, rootPath: string, cache: Record<string, Package>, shallow = true) {
		const absPath = path.resolve(packagePath);
		const cached = cache[absPath];
		if (cached !== undefined) return cached;

		const absDir = path.dirname(absPath);

		const text = await Deno.readTextFile(absPath);
		const data: Record<string, unknown> = JSON.parse(text);

		const location = path.relative(rootPath, absDir);
		const name = data['name'] as string | undefined;
		const version = data['version'] as string | undefined;
		const isPrivate = (data['private'] as boolean | undefined) ?? false;
		const workspaces = (data['workspaces'] as Record<string, unknown> | undefined) ?? {};
		const pkgReferences = shallow ? [] : (workspaces['packages'] as string[]) ?? [];
		const devDependencies = shallow
			? Object.keys((data['devDependencies'] as Record<string, string> | undefined) ?? {})
			: [];
		const dependencies = shallow
			? Object.keys((data['dependencies'] as Record<string, string> | undefined) ?? {})
			: [];

		if (name === undefined) return undefined;

		const result = new Package(location, name, version, isPrivate, new Set([...devDependencies, ...dependencies]));
		cache[absPath] = result;

		if (pkgReferences.length === 0) return result;

		const packageFutures = (() => {
			const match = pkgReferences.filter((pkg) => !pkg.startsWith('!')).map((pkg) =>
				path.globToRegExp(path.join(absDir, pkg, PACKAGE))
			);
			const skip = pkgReferences
				.filter((pkg) => pkg.startsWith('!'))
				.map((pkg) => path.globToRegExp(path.join(absDir, pkg.substring(1), PACKAGE)));

			return Array.fromAsync(
				fs.walk(absDir, { match, skip, includeFiles: true }),
				(entry) => Package.load(entry.path, absDir, cache),
			);
		})();
		const packages = (await packageFutures).filter((pkg) => pkg !== undefined) as Package[];

		const lookup = Object.fromEntries(Object.values(cache).map((pkg): [string, Package] => [pkg.name, pkg]));
		const knownNames = new Set(Object.keys(lookup));
		knownNames.delete(result.name);
		packages.forEach((pkg) => {
			pkg.requires = intersection(pkg.requires, knownNames);

			pkg.requires.forEach((req) => {
				const target = lookup[req];
				if (target === undefined) return;
				target.neededBy.add(pkg.name);
			});
		});
		result.packages = packages;

		return result;
	}

	static matcherGen = matcherGen;
}

function matcherGen(): Record<CategoryMatchKeys, CategoryMatchFunctionGenerator> {
	return {
		matches: (strength) =>
			function matches(pkg, category) {
				if (category.matches !== undefined) {
					if (!(pkg as Package).name.match(category.matches)) return false;
					return strength == '' ? undefined : true;
				}
				return undefined;
			},
		'private': (strength) =>
			function isPrivate(pkg, category) {
				if (category.private !== undefined) {
					if ((pkg as Package).isPrivate !== category.private) return false;
					return strength == '' ? undefined : true;
				}
				return undefined;
			},
		reach: (strength) =>
			function reach(pkg, category) {
				if (category.reach !== undefined) {
					const reach = (pkg as Package).reach().size - 1;
					if (category.reach === true) {
						if (reach === 0) return false;
					} else if (category.reach === false) {
						if (reach > 0) return false;
					} else if (category.reach !== reach) return false;
					return strength == '' ? undefined : true;
				}
				return undefined;
			},
	};
}
