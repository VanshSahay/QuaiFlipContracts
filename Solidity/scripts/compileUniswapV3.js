/**
 * Script to compile both Uniswap v3-core and v3-periphery contracts
 * This must be run before deployment
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Paths to the v3-core and v3-periphery repositories
const V3_CORE_PATH = path.resolve(__dirname, '../../v3-core')
const V3_PERIPHERY_PATH = path.resolve(__dirname, '../../v3-periphery')

// Function to check if a directory exists
function directoryExists(dirPath) {
    try {
        return fs.statSync(dirPath).isDirectory()
    } catch (err) {
        return false
    }
}

// Function to compile a repository
function compileRepository(repoPath, repoName) {
    console.log(`Compiling ${repoName}...`)

    if (!directoryExists(repoPath)) {
        console.error(`Error: ${repoName} directory not found at ${repoPath}`)
        process.exit(1)
    }

    try {
        // Change directory to the repository
        process.chdir(repoPath)

        // Install dependencies if needed
        if (!directoryExists(path.join(repoPath, 'node_modules'))) {
            console.log(`Installing ${repoName} dependencies...`)
            execSync('npm install', { stdio: 'inherit' })
        }

        // Compile contracts
        console.log(`Compiling ${repoName} contracts...`)
        execSync('npx hardhat compile', { stdio: 'inherit' })

        console.log(`${repoName} compilation complete!`)
    } catch (error) {
        console.error(`Error compiling ${repoName}:`, error.message)
        process.exit(1)
    }
}

// Main function
async function main() {
    const originalDir = process.cwd()

    try {
        // Compile v3-core
        compileRepository(V3_CORE_PATH, 'Uniswap v3-core')

        // Go back to original directory
        process.chdir(originalDir)

        // Compile v3-periphery
        compileRepository(V3_PERIPHERY_PATH, 'Uniswap v3-periphery')

        // Go back to original directory
        process.chdir(originalDir)

        console.log('All Uniswap v3 contracts compiled successfully!')

        // Remind user about the deployment steps
        console.log('\nNext steps:')
        console.log('1. Run the deployUniswapV3Full.js script:')
        console.log('   npx hardhat run scripts/deployUniswapV3Full.js --network cyprus1')
        console.log('\nOr deploy each contract separately:')
        console.log('1. npx hardhat run scripts/deployWETH9.js --network cyprus1')
        console.log('2. npx hardhat run scripts/deployUniswapV3Core.js --network cyprus1')
        console.log('3. npx hardhat run scripts/deployUniswapV3Periphery.js --network cyprus1')
    } catch (error) {
        console.error('Error:', error.message)

        // Always go back to original directory
        process.chdir(originalDir)
        process.exit(1)
    }
}

// Run the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    }) 