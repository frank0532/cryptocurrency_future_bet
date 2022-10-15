const { network } = require("hardhat")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (network.config.chainId == 31337) {
        await deploy("AggregatorV3InterfaceMock", {
            from: deployer,
            log: true,
            args: [8, 150000000000],
        })
        log("AggregatorV3InterfaceMock Deployed!")
        log("----------------------------------------------------------")
        log("You are deploying to a local network, you'll need a local network running to interact")
        log(
            "Please run `yarn hardhat console --network localhost` to interact with the deployed smart contracts!"
        )
        log("----------------------------------------------------------")
    }
}

module.exports.tags = ["all", "AggregatorV3InterfaceMock"]
