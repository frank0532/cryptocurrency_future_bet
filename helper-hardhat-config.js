const { ethers } = require("hardhat")

const networkConfig = {
    default: {
        name: "hardhat",
        minBet: ethers.utils.parseEther("0.1"),
    },
    31337: {
        name: "localhost",
        minBet: ethers.utils.parseEther("0.1"),
    },
    5: {
        name: "goerli",
        feedDataAddress: {
            BTCUSD: "0xA39434A63A52E749F02807ae27335515BA4b07F7",
            BTCETH: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
            ETHUSD: "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
            FORTHUSD: "0x7A65Cf6C2ACE993f09231EC1Ea7363fb29C13f2F",
            LINKUSD: "0x48731cF7e84dc94C5f84577882c14Be11a5B7456",
            LINKETH: "0xb4c4a493AB6356497713A78FFA6c60FB53517c63",
        },
        minBet: ethers.utils.parseEther("0.01"),
    },
    1: {
        name: "mainnet",
        minBet: ethers.utils.parseEther("0.01"),
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}
