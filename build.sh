#!/bin/bash

# Set working directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUILD_DIR="$SCRIPT_DIR/../build"
mkdir -p "$BUILD_DIR"

# Function to compile FunC contracts using Docker
compile_func() {
    local sources="$1"
    local output="$2"
    echo "Compiling $sources to $output"
    
    docker run --rm -v "$SCRIPT_DIR:/src" -w /src tonlabs/compilers func \
        -o "/src/$output" -SPA $sources
    
    if [ $? -eq 0 ]; then
        echo "✓ Successfully compiled $output"
    else
        echo "✗ Failed to compile $output"
        exit 1
    fi
}

echo "Starting TONFi contract compilation..."

# Clean previous builds
rm -f $BUILD_DIR/*.fif $BUILD_DIR/*.boc

# Compile utilities first
echo "Compiling utilities..."
compile_func "stdlib.fc utils/Math.fc" "$BUILD_DIR/utils-math.fif"
compile_func "stdlib.fc utils/Security.fc" "$BUILD_DIR/utils-security.fif"
compile_func "stdlib.fc utils/Constants.fc" "$BUILD_DIR/utils-constants.fif"

# Compile pool contracts
echo "Compiling pool contracts..."
compile_func "stdlib.fc utils/Constants.fc utils/Math.fc utils/Security.fc pool/Factory.fc" "$BUILD_DIR/pool-factory.fif"
compile_func "stdlib.fc utils/Constants.fc utils/Math.fc utils/Security.fc pool/Router.fc" "$BUILD_DIR/pool-router.fif"
compile_func "stdlib.fc utils/Constants.fc utils/Math.fc utils/Security.fc pool/SwapPool.fc" "$BUILD_DIR/pool-swap.fif"

# Compile bridge contracts
echo "Compiling bridge contracts..."
compile_func "stdlib.fc utils/Constants.fc utils/Security.fc bridge/Bridge.fc" "$BUILD_DIR/bridge-main.fif"
compile_func "stdlib.fc utils/Constants.fc utils/Security.fc bridge/MessageHandler.fc" "$BUILD_DIR/bridge-handler.fif"
compile_func "stdlib.fc utils/Constants.fc utils/Security.fc bridge/Validator.fc" "$BUILD_DIR/bridge-validator.fif"

# Compile governance contracts
echo "Compiling governance contracts..."
compile_func "stdlib.fc utils/Constants.fc utils/Security.fc governance/DAO.fc" "$BUILD_DIR/gov-dao.fif"
compile_func "stdlib.fc utils/Constants.fc utils/Math.fc governance/Staking.fc" "$BUILD_DIR/gov-staking.fif"
compile_func "stdlib.fc utils/Constants.fc utils/Math.fc governance/Treasury.fc" "$BUILD_DIR/gov-treasury.fif"

echo "All contracts compiled. Generating deployment files..."

# Copy Fift script to build directory and run it
cp deploy-gen.fif $BUILD_DIR/
docker run --rm -v "$BUILD_DIR:/build" -w /build tonlabs/compilers fift -s deploy-gen.fif

echo "Build completed. Check $BUILD_DIR for output files."