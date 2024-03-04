// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

export enum DotEdgeStyle {
	dashed = 'dashed',
	dotted = 'dotted',
	solid = 'solid',
	invis = 'invis',
	bold = 'bold',
	tapered = 'tapered',
}

export enum DotNodeStyle {
	dashed = 'dashed',
	dotted = 'dotted',
	solid = 'solid',
	invis = 'invis',
	bold = 'bold',
	filled = 'filled',
	striped = 'striped',
	wedged = 'wedged',
	diagonals = 'diagonals',
	rounded = 'rounded',
}

export enum DotClusterStyle {
	filled = 'filled',
	striped = 'striped',
	rounded = 'rounded',
}

export type DotStyle = DotEdgeStyle | DotNodeStyle | DotClusterStyle;

export enum DotShape {
	box = 'box',
	polygon = 'polygon',
	ellipse = 'ellipse',
	oval = 'oval',
	circle = 'circle',
	point = 'point',
	egg = 'egg',
	triangle = 'triangle',
	plaintext = 'plaintext',
	plain = 'plain',
	diamond = 'diamond',
	trapezium = 'trapezium',
	parallelogram = 'parallelogram',
	house = 'house',
	pentagon = 'pentagon',
	hexagon = 'hexagon',
	septagon = 'septagon',
	octagon = 'octagon',
	doublecircle = 'doublecircle',
	doubleoctagon = 'doubleoctagon',
	tripleoctagon = 'tripleoctagon',
	invtriangle = 'invtriangle',
	invtrapezium = 'invtrapezium',
	invhouse = 'invhouse',
	Mdiamond = 'Mdiamond',
	Msquare = 'Msquare',
	Mcircle = 'Mcircle',
	rect = 'rect',
	rectangle = 'rectangle',
	square = 'square',
	star = 'star',
	none = 'none',
	underline = 'underline',
	cylinder = 'cylinder',
	note = 'note',
	tab = 'tab',
	folder = 'folder',
	box3d = 'box3d',
	component = 'component',
	promoter = 'promoter',
	cds = 'cds',
	terminator = 'terminator',
	utr = 'utr',
	primersite = 'primersite',
	restrictionsite = 'restrictionsite',
	fivepoverhang = 'fivepoverhang',
	threepoverhang = 'threepoverhang',
	noverhang = 'noverhang',
	assembly = 'assembly',
	signature = 'signature',
	insulator = 'insulator',
	ribosite = 'ribosite',
	rnastab = 'rnastab',
	proteasesite = 'proteasesite',
	proteinstab = 'proteinstab',
	rpromoter = 'rpromoter',
	rarrow = 'rarrow',
	larrow = 'larrow',
	lpromoter = 'lpromoter',
}

interface DotAttributes {
	// ${nodeURL}
	label?: string;
	fontname?: string;
	fontsize?: string | number;
	color?: string;
	fillcolor?: string;
	fontcolor?: string;
	style?: DotStyle | DotStyle[];
	shape?: DotShape;
	URL?: string;
}

function DotString(attr: string) {
	return `"${attr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function DotColor(color: string) {
	return `"${color}"`;
}

function DotEnum<T extends string>(e: T): string {
	return e;
}

function DotUrl(url: string) {
	return DotString(encodeURI(url));
}

const attributes: Record<string, (val: any) => string> = {
	fontsize: (val: string | number) => (typeof val === 'string' ? DotString(val) : `${val}`),
	color: DotColor,
	fillcolor: DotColor,
	fontcolor: DotColor,
	style: DotEnum<DotStyle>,
	shape: DotEnum<DotShape>,
	URL: DotUrl,
};

export function writeAttributes(attr: DotAttributes, sep = ', ') {
	return Object.entries(attr)
		.map(([name, value]) => {
			if (value === undefined) return null;
			const writer = attributes[name] ?? DotString;
			return `${name} = ${writer(value)}`;
		})
		.filter((attr) => attr !== null)
		.join(sep);
}

export function declareObject(id: string, attr: DotAttributes) {
	return `${id} [ ${writeAttributes(attr)} ];`;
}

function isDark(color: string) {
	const rgb = parseInt(color.substring(1), 16);
	const r = (rgb >> 16) & 0xff;
	const g = (rgb >> 8) & 0xff;
	const b = (rgb >> 0) & 0xff;
	const brightness = (r * 299 + g * 587 + b * 114) / 1000;
	return brightness < 128;
}

export function declareObjectFromData(
	id: string,
	label: string,
	fill: string | undefined,
	isPrivate: boolean,
	URL: string | undefined,
) {
	return declareObject(id, {
		label,
		fillcolor: fill,
		fontcolor: fill !== undefined && isDark(fill) ? '#ffffff' : '#000000',
		shape: isPrivate ? DotShape.doubleoctagon : DotShape.octagon,
		URL,
	});
}

export function declareNodeAttributes() {
	return declareObject('node', {
		style: DotNodeStyle.filled,
		fontname: 'Monospace',
		fontsize: '12',
	});
}
