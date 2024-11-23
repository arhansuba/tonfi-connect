#!/bin/bash

# Create build-dev directory for development builds
mkdir -p build-dev

echo "Compiling Pool contracts (development version)..."
# Factory with debug info
ton-compiler --version "latest" \
    --input ./contracts/pool/Factory.fc \
    --output ./build-dev/pool_factory.cell \
    --output-fift ./build-dev/pool_factory.fif \
    --debug

# Router with custom stdlib
ton-compiler --version "latest" \
    --input ./contracts/pool/Router.fc \
    --output ./build-dev/pool_router.cell \
    --output-fift ./build-dev/pool_router.fif \
    --stdlib-path ./contracts/custom-stdlib.fc

# SwapPool legacy version
ton-compiler --version "legacy" \
    --input ./contracts/pool/SwapPool.fc \
    --output ./build-dev/pool_swap.cell \
    --output-fift ./build-dev/pool_swap.fif

echo "Compiling Bridge contracts (development version)..."
# Bridge with no stdlib
ton-compiler --no-stdlib \
    --input ./contracts/bridge/Bridge.fc \
    --output ./build-dev/bridge_main.cell \
    --output-fift ./build-dev/bridge_main.fif

# MessageHandler with verbose output
ton-compiler --version "latest" \
    --input ./contracts/bridge/MessageHandler.fc \
    --output ./build-dev/bridge_handler.cell \
    --output-fift ./build-dev/bridge_handler.fif \
    --verbose

echo "Compilation complete. Development builds are in ./build-dev directory"