#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import { parseArgs } from '@std/cli/parse_args.ts';
import * as path from '@std/path/mod.ts';
import { open } from 'https://deno.land/x/open/index.ts';
import { Package, safe_filename } from './package.ts';
import { PACKAGE, readPackageCategories } from './model.ts';
import { createGraph, createLegendFromCategories, exec, splitGraphs } from './graph.ts';

async function main() {
	const args = parseArgs(Deno.args, {
		boolean: ['help', 'verbose'],
		string: ['categories', 'output'],
		default: {},
		stopEarly: true,
	});

	if (args.help) {
		console.log('workspaces [--help] [--verbose] [--categories <json-file>] [--output <dirname>]');
		return;
	}

	const outDir = args.output ?? './out';

	const categories = await readPackageCategories(args.categories, Package.matcherGen());

	if (args.verbose) {
		categories.rules.forEach(({ id, matches, legend, fill, 'private': isPrivate, reach }) =>
			console.log(legend, id, fill, matches, isPrivate, reach)
		);
	}

	const rootDir = await exec('git', { args: ['rev-parse', '--show-toplevel'] });
	console.log(`Parsing package.json files inside \x1b[0;32m${rootDir}\x1b[m`);
	const root = await Package.load(path.join(rootDir, PACKAGE), rootDir, {}, false);
	if (root === undefined) return;
	root.paintPackages(categories);
	console.log(`- found ${root.packages.length} package${root.packages.length === 1 ? '' : 's'}`);

	console.log('Building graphs');
	const { ungrouped, grouped } = splitGraphs(root.packages, categories);
	const packages = Object.fromEntries(root.packages.map((pkg) => [pkg.name, pkg]));

	console.log('Drawing');

	const takeEverything = () => true;
	const take = (name: string) =>
		function takeOne(id: string) {
			return id === name;
		};
	const graphs: {
		name: string;
		filenameBase: string;
		filters: Set<string>;
		interesting: (id: string) => boolean;
		linkAll?: boolean;
	}[] = [
		{
			name: 'Monorepo',
			filenameBase: 'group__ALL',
			filters: new Set(Object.keys(packages)),
			interesting: takeEverything,
			linkAll: true,
		},
		...Object.entries(grouped).map(([group, filters]) => ({
			name: `${group} (grouped)`,
			filenameBase: `group__${safe_filename(group)}`,
			filters,
			interesting: (id: string) => filters.has(id),
		})),
		...Object.entries(ungrouped).map(([name, filters]) => ({
			name,
			filenameBase: `package__${safe_filename(name)}`,
			filters,
			interesting: take(name),
		})),
	];

	await Deno.mkdir(outDir, { recursive: true });

	const html: string[] = [
		await createLegendFromCategories(categories, outDir),
	];
	for (const { name, filenameBase, filters, interesting, linkAll } of graphs) {
		html.push(await createGraph(name, filenameBase, outDir, filters, packages, interesting, linkAll));
	}

	const htmlPath = path.join(outDir, 'index.html');
	await Deno.writeFile(htmlPath, new TextEncoder().encode(html.join('\n\n')));
	console.log(`- index.html\n\nWrote to: \x1b[0;32m${path.resolve(htmlPath)}\x1b[m`);

	open(htmlPath);
}

// Learn more at https://deno.land/manual/examples/module_metadata#concepts
if (import.meta.main) {
	await main();
}
