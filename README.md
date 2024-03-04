# Workspaces

Visualization for Node workspaces dependencies

## Prerequisites

- [Deno](https://deno.com) runtime (see [manual](https://docs.deno.com/runtime/manual) for installation instructions)
- [Graphviz](https://graphviz.org/) visualization engine (see [Download](https://graphviz.org/download/) for installation instructions)

## Running

The `workspaces.sh` script wraps call to `deno` runtime with all the permissions this tools needs (reading `package.json` files, writing the `index.html` and calling into Graphviz).
With the wrapper copied over next to `graph.json` config and the output directory for `dependencies` the call would be

```sh
./workspaces.sh --categories graph.json --output dependencies
```

## Config

Coloring the graph is done with a category JSON file modelling the `PackageCategories` interface:

```ts
interface PackageCategory {
  id: string;
  matches?: string;
  private?: boolean;
  reach?: boolean | number;
  legend?: string;
  fill?: string;
  group?: boolean | string;
}

type CategoryMatchKeys = "matches" | "private" | "reach";

interface PackageCategories {
  rules: PackageCategory[];
  matcher?: CategoryMatchKeys[];
}
```

- **id**: Unique identifier, used in filenames and to group packages.
- **matches**: Will match a RegExp against `"name"`.
- **private**: Will match against `"private"`.
- **reach**: Will match against number of packages in this project either in `"dependencies"` or `"devDependencies"`.
- **legend**: Label for the color tile in the Legend.
- **fill**: Color of the tile. Can only be a hash, followed by six hex digits, so a `"#ffffff"`, and not `"white"`.
- **group**: If present and `true` or non-empty, will render a single graph for all packages in this category. If `true`, will use the `id` to name the group, otherwise will take this property.

Any of the `matches`, `private` and `reach` properties of the `PackageCategory`, if present, will be used to check if a package matches given category. The matching is done in order the rules are placed and first matching one will be taken as resulting category.

The `matches` property will accept packages, whose `"name"` in `package.json` matches the RegExp. The `private` will match packages, whose `"private"` in `package.json` equals to the matcher's truthy/falsy value. Finally, the `reach` matches the number of other packages that are connected to given package through either `"dependencies"` or `"devDependencies"`, with `false` being equal to 0 and `true` being equal to "more, than 0".

If the `matcher` top-level property is missing, it is assumed to be `["matches", "private", "reach"]`.
