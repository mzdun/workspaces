// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import { Node, PackageCategories } from './model.ts';
import { intersection, union } from './set.ts';
import { Package, safe_filename } from './package.ts';
import {
	declareNodeAttributes,
	declareObject,
	declareObjectFromData,
	DotEdgeStyle,
	DotShape,
	isDark,
	writeAttributes,
} from './graphviz.ts';
import { PackageCategory } from './model.ts';

export async function exec(command: string, { args, cwd, input }: { args: string[]; cwd?: string; input?: string }) {
	const cmd = new Deno.Command(command, {
		args,
		cwd,
		stdin: input === undefined ? undefined : 'piped',
		stdout: 'piped',
	});
	const process = cmd.spawn();
	if (input !== undefined) {
		const writer = process.stdin.getWriter();
		writer.write(new TextEncoder().encode(input));
		await writer.close();
		// await process.stdin.close();
	}
	const stdout = (await process.output()).stdout;
	return new TextDecoder().decode(stdout).trim();
}

function orderLayer(nodes: Record<string, Node>) {
	const freeNodes = Object.values(nodes).filter((node) => node.children.size === 0);
	freeNodes.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

	const result = freeNodes.map((node) => node.id);

	result.forEach((id) => delete nodes[id]);
	Object.values(nodes).forEach((node) => result.forEach((id) => node.children.delete(id)));

	return result;
}

function orderNodes(nodes: Record<string, Node>) {
	const result: string[] = [];
	while (true) {
		const layer = orderLayer(nodes);
		if (layer.length === 0) break;
		result.splice(result.length, 0, ...layer);
	}
	result.splice(result.length, 0, ...Object.keys(nodes));
	return result.reverse();
}

export function splitGraphs(packages: Package[], categories: PackageCategories) {
	const groups: Record<string, Package[]> = {};

	packages.map((pkg): [string, Package] => {
		const category = pkg.matchCategory(categories);
		const group = category?.group ?? false;
		const groupName = typeof group === 'string' ? group : undefined;
		return [(group ? groupName ?? category?.id : undefined) ?? '', pkg];
	}).forEach(([group, pkg]) => {
		if (groups[group] === undefined) groups[group] = [];
		groups[group].push(pkg);
	});

	const ungroupedPackages = groups[''] ?? [];
	delete groups[''];
	ungroupedPackages.forEach((pkg) => pkg.filenameBase = `package__${safe_filename(pkg.name)}`);
	const ungrouped = Object.fromEntries(
		ungroupedPackages.map((pkg) => [pkg.name, pkg.reach()]),
	);
	const grouped = Object.fromEntries(
		Object.entries(groups).map(([group, members]) => {
			members.forEach((pkg) => pkg.filenameBase = `group__${safe_filename(group)}`);
			const group_reach = members.map((pkg) => pkg.reach())
				.reduce(union, new Set());
			return [group, group_reach];
		}),
	);
	const group_filters = Object.fromEntries(
		Object.entries(groups).map(([name, packages]) => [name, new Set(packages.map((pkg) => pkg.name))]),
	);
	return { ungrouped, grouped, group_filters };
}

export function buildGraph(
	filter: Set<string>,
	packages: Record<string, Package>,
	interesting: (id: string) => boolean,
	linkAll: boolean,
) {
	const graphNodes = Array.from(filter)
		.map((name) => packages[name].node)
		.map((node) => {
			const children = intersection(node.children, filter);
			if (interesting(node.id)) {
				node.children = children;
			} else {
				node.children = new Set();
				children.forEach((id) => {
					if (interesting(id)) node.children.add(id);
				});
			}
			return node;
		});
	const graph = Object.fromEntries(graphNodes.map((node) => [node.id, node]));
	const edges = Object.fromEntries(
		graphNodes.map(({ id, children }): [string, Set<string>] => [id, new Set(children)]),
	);
	const order = orderNodes(graph);
	const nodes = order.map((id, index): [string, string] => {
		const str_index = `${index}`.padStart(2, '0');
		return [`pkg_${str_index}`, id];
	});
	const reverseLookup = Object.fromEntries(nodes.map(([x, y]) => [y, x]));
	const decl = nodes
		.map(([id, nodeId]) => {
			const node = packages[nodeId];
			const { label, fill, isPrivate } = node;
			return `  ${
				declareObjectFromData(
					id,
					label,
					fill,
					isPrivate,
					linkAll || !interesting(nodeId) ? `${node.filenameBase}.svg` : undefined,
				)
			}`;
		})
		.join('\n');
	const connectors = nodes
		.map(([id, nodeId]) => {
			const children = edges[nodeId];
			const connections = Array.from(children)
				.map((name) => reverseLookup[name])
				.join(' ');
			if (connections === '') return '';
			return `  ${id} -> { ${connections} }`;
		})
		.filter((line) => line !== '')
		.join('\n');
	const init = `  ${declareNodeAttributes()}\n  rankdir=LR`;
	const graphChunks = [init, decl, connectors].filter((text) => text !== '').join('\n\n');
	return `strict digraph {
${graphChunks}
}`;
}

async function writeGraphs(filename: string, cwd: string, name: string | undefined, graph: string) {
	if (name !== undefined) console.log(`- ${name}`);

	const pathSvg = `${filename}.svg`;
	const pathPng = `${filename}.png`;

	await exec('dot', { args: ['-Tsvg', '-o', pathSvg], cwd, input: graph });
	await exec('dot', { args: ['-Tpng', '-o', pathPng], cwd, input: graph });

	const encoded = encodeURIComponent(filename);
	const header = name === undefined ? '' : `<h3><i>${name}</i>:</h3>\n`;
	return `${header}<p><a href="${encoded}.svg"><img src="${encoded}.png" style="max-width: 100vw; max-height: 100vh"/></a></p>`;
}

export function createGraph(
	name: string,
	filenameBase: string,
	cwd: string,
	filters: Set<string>,
	packages: Record<string, Package>,
	interesting: (id: string) => boolean,
	linkAll: boolean = false,
): Promise<string> {
	const graph = buildGraph(filters, packages, interesting, linkAll);

	return writeGraphs(filenameBase, cwd, name, graph);
}

function declareObjectFromCategory(id: string, category: PackageCategory) {
	const { id: name, legend, fill } = category;
	return declareObject(id, {
		label: legend ?? name,
		fillcolor: fill,
		fontcolor: fill !== undefined && isDark(fill) ? '#ffffff' : '#000000',
		shape: DotShape.oval,
	});
}

export function createLegendFromCategories(categories: PackageCategories, cwd: string) {
	const shorterSize = Math.max(Math.round(Math.sqrt(categories.rules.length)), 1);
	const size = Math.max(Math.round(categories.rules.length / shorterSize), 1);

	const init = [
		'label = "Legend";',
		declareNodeAttributes(),
		declareObject('edge', { style: DotEdgeStyle.invis, fontname: 'Monospace' }),
	].join('\n');

	const decl = categories.rules.map((category, index) => {
		const strIndex = `${index}`.padStart(2, '0');
		return declareObjectFromCategory(`legend_${strIndex}`, category);
	}).join('\n');

	const declPublPriv = [
		declareObjectFromData('legend_published', 'Published', undefined, false, undefined),
		declareObjectFromData('legend_private', 'Private', undefined, true, undefined),
	].join('\n');

	const connectors = categories.rules.map((_, index, rules) => {
		const nextIndex = index + size;
		if (nextIndex >= rules.length) return '';

		const strIndex = `${index}`.padStart(2, '0');
		const strNextIndex = `${nextIndex}`.padStart(2, '0');

		return `legend_${strIndex} -> legend_${strNextIndex};`;
	}).filter((conn) => conn !== '').join('\n');

	const graphChunks = [
		init,
		decl,
		declPublPriv,
		connectors,
		`legend_private -> legend_published  [ ${
			writeAttributes({ style: DotEdgeStyle.solid, label: 'Depends on' })
		} ]`,
	].filter((text) => text !== '').join('\n\n');
	const graph = `digraph {
fontname = "Monospace";
color = black;
rankdir = "LR";

subgraph clusterColors {
${graphChunks}
}
}`;

	return writeGraphs('legend', cwd, undefined, graph);
}
