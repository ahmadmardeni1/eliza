#!/bin/bash



# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Source NVM to make it available in the current shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js version 23
nvm install 23

# Change directory to 'eliza'
cd eliza || exit

# Install pnpm globally
npm install -g pnpm

# Install Node.js version 23.3.0
nvm install 23.3.0

# Use Node.js version 23.3.0
nvm use 23.3.0

# Install @pnpm/exe globally
npm install -g @pnpm/exe

# Install project dependencies using pnpm
pnpm i
