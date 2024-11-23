#!/bin/bash

echo "Setting up TON development environment..."

# Update system
sudo apt update
sudo apt install -y build-essential git make cmake pkg-config libssl-dev zlib1g-dev curl

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo "Docker installed successfully"
else
    echo "Docker already installed"
fi

# Pull TON compiler image
echo "Pulling TON compiler image..."
sudo docker pull tonlabs/compilers

# Install Fift
echo "Installing Fift..."
cd ~
git clone --recurse-submodules https://github.com/ton-blockchain/ton.git
cd ton
mkdir build
cd build
cmake ..
make -j4 fift
sudo cp crypto/fift /usr/local/bin/

# Setup Fift libraries
echo "Setting up Fift libraries..."
sudo mkdir -p /usr/local/lib/fift
sudo cp -r ~/ton/crypto/fift/lib/* /usr/local/lib/fift/

# Create project structure
echo "Creating project structure..."
PROJECT_DIR=~/tonfi-connect
if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p $PROJECT_DIR/{contracts/{pool,bridge,governance,utils},build}
fi

echo "Setup complete! Please log out and log back in for Docker permissions to take effect."
echo "You can then run the build script from your project directory."