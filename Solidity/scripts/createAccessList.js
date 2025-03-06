const quais = require('quais')
const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

const deploymentData = JSON.parse(fs.readFileSync(path.join(__dirname, '../deployments/uniswap-v3-cyprus1.json'), 'utf8'))

const POSITION_MANAGER_ADDRESS = deploymentData.positionManagerAddress
const WETH_ADDRESS = "0x003E54295721fAcE51a1f8746AB6CcB4Bb30B572"

const WETH9_ABI = [
    "function deposit() external payable",
    "function withdraw(uint256) external",
    "function transfer(address to, uint256 value) external returns (bool)"
];

const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)
const wethContract = new quais.Contract(WETH_ADDRESS, WETH9_ABI, wallet)

async function main() {
    try {
        console.log('Depositing ETH to WETH...')

        // First deposit ETH to get WETH
        const depositTx = await wethContract.deposit({
            value: quais.parseQuai('0.1'),
            gasLimit: 20000000
        })
        await depositTx.wait()
        console.log('Deposited ETH to WETH')

        // Then transfer WETH to the position manager
        console.log('Transferring WETH to Position Manager...')
        const transferTx = await wethContract.transfer(
            POSITION_MANAGER_ADDRESS,
            quais.parseQuai('0.1'),
            {
                gasLimit: 20000000
            }
        )

        console.log('Transaction sent. Hash:', transferTx.hash)

        const receipt = await transferTx.wait()
        console.log('Transaction receipt:', receipt)
        return receipt
    } catch (error) {
        console.error('Error:', error)
        throw error
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
