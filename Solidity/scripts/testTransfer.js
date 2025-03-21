const quais = require('quais');

const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true });
const wallet = new quais.Wallet(hre.network.config.accounts[0], provider);

const tokenAbi = ["function allowance(address owner, address spender) external view returns (uint256)", "function transferFrom(address from, address to, uint256 amount) external returns (bool)", "function approve(address spender, uint256 amount) external returns (bool)"];

const token0 = new quais.Contract("0x003010921715009b44864324e6dB9BAa236bb7d4", tokenAbi, wallet);


async function testTransferFrom() {
    const ipfsHash = await deployMetadata.pushMetadataToIPFS("TestTransfer");

    const testTransferArtifact = require('../artifacts/contracts/TestTransfer.sol/TestTransfer.json');
    const testTransferFactory = new quais.ContractFactory(testTransferArtifact.abi, testTransferArtifact.bytecode, wallet, ipfsHash);
    const testTransfer = await testTransferFactory.deploy();
    await testTransfer.waitForDeployment();
    const testTransferAddress = await testTransfer.getAddress();
    console.log(testTransferAddress);

    const amount = quais.parseQuai("10");

    const allowanceBefore = await token0.allowance("0x001edD34e1255447fEFA24766c555B9d0D0c4cf1", testTransferAddress);
    console.log(allowanceBefore.toString());

    await token0.approve(testTransferAddress, amount);

    const allowanceAfter = await token0.allowance("0x001edD34e1255447fEFA24766c555B9d0D0c4cf1", testTransferAddress);
    console.log(allowanceAfter.toString());

    const tx0 = await testTransfer.testTransferFrom(
        "0x003010921715009b44864324e6dB9BAa236bb7d4",
        "0x001edD34e1255447fEFA24766c555B9d0D0c4cf1",
        "0x0067d72f14cF8452a1841Ac2E55F3036E377c7a1",
        amount
    );

    console.log(tx0);
}

testTransferFrom();