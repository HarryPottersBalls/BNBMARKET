#!/bin/bash
set -e

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null
then
    echo "wasm-pack could not be found. Please install it."
    exit 1
fi

# Build WebAssembly package
wasm-pack build --target web

# Move generated files to a dist directory
mkdir -p ../dist/wasm
cp -r pkg/* ../dist/wasm/

echo "WebAssembly package built successfully!"