// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

export function union<T>(a: Set<T>, b: Set<T>) {
	const result: Set<T> = new Set();
	a.forEach((item) => result.add(item));
	b.forEach((item) => result.add(item));
	return result;
}

export function intersection<T>(a: Set<T>, b: Set<T>) {
	const result: Set<T> = new Set();
	a.forEach((item) => {
		if (b.has(item)) result.add(item);
	});
	return result;
}
