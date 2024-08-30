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
    11155111: {
        name: "sepolia",
        feedDataAddress: {
            BTCUSD: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
            BTCETH: "0x5fb1616F78dA7aFC9FF79e0371741a747D2a7F22",
            ETHUSD: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
            FORTHUSD: "0x070bF128E88A4520b3EfA65AB1e4Eb6F0F9E6632",
            LINKUSD: "0xc59E3633BAAC79493d908e63626716e204A45EdF",
            LINKETH: "0x42585eD362B3f1BCa95c640FdFf35Ef899212734",
            EURUSD: "0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910",
            GBPUSD: "0x91FAB41F5f3bE955963a986366edAcff1aaeaa83",
            XAUUSD: "0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea",
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
