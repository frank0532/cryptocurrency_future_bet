const { network, ethers } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config.js")


module.exports = async function({ getNamedAccounts, deployments}){
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    const arguments = [
        networkConfig[network.config.chainId]["minBet"]
    ]

    const cryptocurrencyFutureBet = await deploy("CryptocurrencyFutureBet", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })
}

module.exports.tags = ["all", "CryptocurrencyFutureBet"]

// deployed at 0xf5D0746B1be2812F4C8952d921D1d506503B200C on goerli testnet.