#!/bin/bash

# Create build directory if it doesn't exist
mkdir -p build

echo "Compiling Pool contracts..."
# Factory
ton-compiler --input ./contracts/pool/Factory.fc --output ./build/pool_factory.cell --output-fift ./build/pool_factory.fif

# Router
ton-compiler --input ./contracts/pool/Router.fc --output ./build/pool_router.cell --output-fift ./build/pool_router.fif

# SwapPool
ton-compiler --input ./contracts/pool/SwapPool.fc --output ./build/pool_swap.cell --output-fift ./build/pool_swap.fif

echo "Compiling Bridge contracts..."
# Bridge
ton-compiler --input ./contracts/bridge/Bridge.fc --output ./build/bridge_main.cell --output-fift ./build/bridge_main.fif

# MessageHandler
ton-compiler --input ./contracts/bridge/MessageHandler.fc --output ./build/bridge_handler.cell --output-fift ./build/bridge_handler.fif

# Validator
ton-compiler --input ./contracts/bridge/Validator.fc --output ./build/bridge_validator.cell --output-fift ./build/bridge_validator.fif

echo "Compiling Governance contracts..."
# DAO
ton-compiler --input ./contracts/governance/DAO.fc --output ./build/gov_dao.cell --output-fift ./build/gov_dao.fif

# Staking
ton-compiler --input ./contracts/governance/Staking.fc --output ./build/gov_staking.cell --output-fift ./build/gov_staking.fif

# Treasury
ton-compiler --input ./contracts/governance/Treasury.fc --output ./build/gov_treasury.cell --output-fift ./build/gov_treasury.fif

echo "Compiling Utility contracts..."
# Math
ton-compiler --input ./contracts/utils/Math.fc --output ./build/utils_math.cell --output-fift ./build/utils_math.fif

# Constants
ton-compiler --input ./contracts/utils/Constants.fc --output ./build/utils_constants.cell --output-fift ./build/utils_constants.fif

# Security
ton-compiler --input ./contracts/utils/Security.fc --output ./build/utils_security.cell --output-fift ./build/utils_security.fif

echo "Compilation complete. Built files are in the ./build directory"