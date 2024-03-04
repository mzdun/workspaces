#!/bin/bash

VERSION="v0.2.0"
SCRIPT="https://raw.githubusercontent.com/mzdun/workspaces/$VERSION/src/main.ts"
PERMISSIONS="--allow-read --allow-run --allow-write"

deno run $PERMISSIONS "$SCRIPT" "$@"
