/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require('@nomicfoundation/hardhat-toolbox')
require('@quai/quais-upgrades');
require("@quai/hardhat-deploy-metadata");
const { task } = require("hardhat/config");

const dotenv = require('dotenv')
dotenv.config({ path: '../.env' })

// Tasks for running Uniswap examples
task("uniswap-workflow", "Run the complete Uniswap v3 workflow")
  .setAction(async (taskArgs, hre) => {
    const examples = require("./scripts/uniswapExamples");
    await examples.runCompleteWorkflow();
  });

task("uniswap-two-tokens", "Run the Uniswap v3 workflow with two custom tokens")
  .setAction(async (taskArgs, hre) => {
    const examples = require("./scripts/uniswapExamples");
    await examples.runCompleteWorkflowWithTwoTokens();
  });

module.exports = {
  defaultNetwork: 'cyprus1',
  networks: {
    cyprus1: {
      url: process.env.RPC_URL,
      accounts: [process.env.CYPRUS1_PK],
      chainId: Number(process.env.CHAIN_ID),
    },
    cyprus1_fullpath: {
      url: "https://orchard.rpc.quai.network/cyprus1",
      accounts: [process.env.CYPRUS1_PK],
      chainId: Number(process.env.CHAIN_ID),
    },
  },

  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          metadata: {
            bytecodeHash: 'ipfs',
            useLiteralContent: true, // Include the source code in the metadata
          },
          evmVersion: 'london',
        },
      },
      {
        version: '0.8.19',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          metadata: {
            bytecodeHash: 'ipfs',
            useLiteralContent: true, // Include the source code in the metadata
          },
          evmVersion: 'london',
        },
      },
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          metadata: {
            bytecodeHash: 'ipfs',
            useLiteralContent: true, // Include the source code in the metadata
          },
          evmVersion: 'london',
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 50, // Reduced from 1000 to 50 for smaller bytecode
            details: {
              yul: true, // Enable Yul optimizer
              deduplicate: true,
              cse: true,
              constantOptimizer: true,
            }
          },
          metadata: {
            bytecodeHash: 'none', // Don't include metadata hash in the bytecode
          },
          // Enable output selection to exclude unnecessary information
          outputSelection: {
            "*": {
              "*": [
                "abi",
                "evm.bytecode",
                "evm.deployedBytecode"
              ],
            },
          },
        },
      }
    ]
  },

  // etherscan: {
  //   apiKey: {
  //     cyprus1: 'abc',
  //   },
  //   customChains: [
  //     {
  //       network: 'cyprus1',
  //       chainId: Number(process.env.CHAINID),
  //       urls: {
  //         apiURL: 'https://quaiscan.io/api/v2',
  //         browserURL: 'https://quaiscan.io/',
  //       },
  //     },
  //   ],
  // },

  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 20000,
  },
}
