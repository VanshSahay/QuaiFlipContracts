/**
 * This script runs the complete Uniswap V3 workflow
 * It's provided as a convenience to avoid parameter passing issues with Hardhat
 */

const { runCompleteWorkflow } = require('./uniswapExamples');

async function main() {
    console.log('Running complete Uniswap V3 workflow...');
    await runCompleteWorkflow();
}

// Execute the function
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error in runCompleteWorkflow script:', error);
        process.exit(1);
    }); 