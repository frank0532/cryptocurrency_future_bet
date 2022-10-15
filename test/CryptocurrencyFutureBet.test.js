const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config.js")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("CryptocurrencyFutureBet Tests", function () {
          let accounts,
              deployer,
              player,
              fdmContract,
              cfbContract,
              cfbContractPlayer,
              cfbContractDeployer,
              minBet,
              symbol = "ETHUSD",
              priceMultiple = 100000000,
              targetPrice1 = "2000.3",
              targetPrice2 = "3000.2",
              targetPrice3 = "4000.5",
              offsetDays1 = 10,
              offsetDays2 = 20,
              offsetDays3 = 30

          function getTargetTime(offsetDays) {
              return Math.round(Date.now() / 1000) + offsetDays * 86400
          }

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["all"])
              fdmContract = await ethers.getContract("AggregatorV3InterfaceMock")
              cfbContract = await ethers.getContract("CryptocurrencyFutureBet")
              await cfbContract.createBet(
                  symbol,
                  getTargetTime(offsetDays1),
                  targetPrice1.split(".")[0],
                  targetPrice1.split(".")[1],
                  fdmContract.address
              )
              await cfbContract.createBet(
                  symbol,
                  getTargetTime(offsetDays2),
                  targetPrice2.split(".")[0],
                  targetPrice2.split(".")[1],
                  fdmContract.address
              )
              cfbContractDeployer = await cfbContract.connect(deployer)
              cfbContractPlayer = await cfbContract.connect(player)
              minBet = await cfbContract.getMinBet()
          })

          describe("constructor", function () {
              it("initializes contract(cfb) correctly", async () => {
                  assert.equal(
                      minBet.toString(),
                      networkConfig[network.config.chainId]["minBet"].toString()
                  )
                  betsLinesNum = await cfbContract.getBetsLinesNum()
                  assert.equal(betsLinesNum.toString(), "2")
                  priceRound = await cfbContract.getPrice(symbol)
                  assert.equal(priceRound[0].toString(), "150000000000")
                  allBetsLines = await cfbContract.getAllBetsLines()
                  bet0 = allBetsLines[0].toString().split(",")
                  bet1 = allBetsLines[1].toString().split(",")
                  assert.equal(bet0[4], targetPrice1)
                  assert.equal(bet1[4], targetPrice2)
                  assert(
                      parseInt(bet0[3]) - parseInt(bet0[1]) > 86400 * offsetDays1 &&
                          parseInt(bet0[3]) - parseInt(bet0[1]) < 86400 * offsetDays1 + 50
                  )
                  assert(
                      parseInt(bet1[3]) - parseInt(bet1[1]) > 86400 * offsetDays2 &&
                          parseInt(bet1[3]) - parseInt(bet1[1]) < 86400 * offsetDays2 + 50
                  )
              })
          })

          describe("Bet", function () {
              it("players bet on different lines correctly", async () => {
                  upsMap = new Map()
                  downsMap = new Map()
                  await cfbContractPlayer.createBet(
                      symbol,
                      getTargetTime(offsetDays3),
                      targetPrice3.split(".")[0],
                      targetPrice3.split(".")[1],
                      fdmContract.address
                  )

                  await expect(cfbContract.payFromWallet(0, 1, { value: 0 })).to.be.revertedWith(
                      "CryptocurrencyFutureBet__NotEnoughETHEntered()"
                  )
                  await expect(cfbContract.payFromMargin(0, 1, minBet)).to.be.revertedWith(
                      "CryptocurrencyFutureBet__NotEnoughMargin(0)"
                  )
                  for (let i = 0; i < 3; i++) {
                      await cfbContractDeployer.payFromWallet(i, 1, { value: minBet })
                      await cfbContractDeployer.payFromWallet(i, 1, { value: minBet })
                      await cfbContractDeployer.payFromWallet(i, -1, { value: minBet })

                      await cfbContractPlayer.payFromWallet(i, 1, { value: minBet })
                      await cfbContractPlayer.payFromWallet(i, -1, { value: minBet })
                      await cfbContractPlayer.payFromWallet(i, -1, { value: minBet })

                      idUpsDowns = await cfbContract.getABetDetails(0)
                      ids = idUpsDowns[0].toString().split(",")
                      ups = idUpsDowns[1].toString().split(",")
                      downs = idUpsDowns[2].toString().split(",")
                      for (let i2 = 0; i2 < ids.length; i2++) {
                          upsMap[ids[i2]] = ups[i2]
                          downsMap[ids[i2]] = downs[i2]
                      }
                      assert.equal(
                          parseInt(upsMap[deployer.address]),
                          parseInt(minBet.toString()) * 2
                      )
                      assert.equal(downsMap[deployer.address], minBet.toString())
                      assert.equal(
                          parseInt(downsMap[player.address]),
                          parseInt(minBet.toString()) * 2
                      )
                      assert.equal(upsMap[player.address], minBet.toString())
                  }
              })
              it("emit event correctly when bet", async () => {
                  await expect(cfbContract.payFromWallet(0, 1, { value: minBet })).to.emit(
                      cfbContract,
                      "BetEnter"
                  )

                  beti = await cfbContract.payFromWallet(0, 1, { value: minBet })
                  receiptBeti = await beti.wait(1)
                  betiInfo = receiptBeti.events?.filter((x) => {
                      return x.event == "BetEnter"
                  })

                  assert.equal(betiInfo[0]["args"][0], deployer.address)
                  assert.equal(betiInfo[0]["args"][1], symbol)
                  assert.equal(
                      betiInfo[0]["args"][2],
                      (parseFloat(targetPrice1) * priceMultiple).toString()
                  )
                  targetTime1 = getTargetTime(offsetDays1)
                  assert(
                      betiInfo[0]["args"][3] <= targetTime1 &&
                          targetTime1 < betiInfo[0]["args"][3] + 60 * 10
                  )
              })
          })

          describe("performUpkeep", async () => {
              it("'performUpkeep' works correctly", async () => {
                  await cfbContract.payFromWallet(0, 1, { value: minBet })
                  await network.provider.send("evm_increaseTime", [offsetDays1 * 86400 + 50])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  tx = await cfbContract.performUpkeep("0x")
                  assert(tx)
              })
              it("'performUpkeep' works to trigger 'settlement' correctly", async () => {
                  await cfbContract.payFromWallet(0, 1, { value: minBet })
                  await cfbContract.payFromWallet(1, 1, { value: minBet })
                  await network.provider.send("evm_increaseTime", [offsetDays1 * 86400 + 50])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  tx = await cfbContract.performUpkeep("0x")
                  txReceipt = await tx.wait(1)
                  lineDesc = await cfbContract.getAllBetsLines()
                  betLine0Status = await cfbContract.getABetStatus(0)
                  betLine1Status = await cfbContract.getABetStatus(1)
                  assert.equal(txReceipt.events[0].args.indexId.toString(), "0")
                  assert.equal(txReceipt.events[0].args.desc, lineDesc[0])
                  assert.equal(betLine0Status, true)
                  assert.equal(betLine1Status, false)
              })
          })
          describe("aBetSettlement", async () => {
              it("'aBetSettlement' works correctly when all bets on one side", async () => {
                  await cfbContractDeployer.payFromWallet(0, 1, { value: minBet })
                  await cfbContractPlayer.payFromWallet(0, 1, { value: minBet })
                  deployerMargin0 = await cfbContractDeployer.getAvailableMargin()
                  playerMargin0 = await cfbContractPlayer.getAvailableMargin()
                  await network.provider.send("evm_increaseTime", [offsetDays1 * 86400 + 50])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  tx = await cfbContract.performUpkeep("0x")
                  txReceipt = await tx.wait(1)
                  deployerMargin1 = await cfbContractDeployer.getAvailableMargin()
                  playerMargin1 = await cfbContractPlayer.getAvailableMargin()
                  assert.equal(deployerMargin0, 0)
                  assert.equal(playerMargin0, 0)
                  assert.equal(deployerMargin1.toString(), minBet)
                  assert.equal(playerMargin1.toString(), minBet)

                  await network.provider.send("evm_increaseTime", [-offsetDays1 * 86400])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  tx = await cfbContract.performUpkeep("0x")
                  txReceipt = await tx.wait(1)
                  await cfbContractDeployer.payFromMargin(1, -1, minBet)
                  await cfbContractPlayer.payFromMargin(1, -1, minBet)
                  deployerMargin0 = await cfbContractDeployer.getAvailableMargin()
                  playerMargin0 = await cfbContractPlayer.getAvailableMargin()
                  await network.provider.send("evm_increaseTime", [offsetDays2 * 86400 + 50])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  tx = await cfbContract.performUpkeep("0x")
                  txReceipt = await tx.wait(1)
                  deployerMargin1 = await cfbContractDeployer.getAvailableMargin()
                  playerMargin1 = await cfbContractPlayer.getAvailableMargin()
                  assert.equal(deployerMargin0, 0)
                  assert.equal(playerMargin0, 0)
                  assert.equal(deployerMargin1.toString(), minBet)
                  assert.equal(playerMargin1.toString(), minBet)
              })
              it("'aBetSettlement' works correctly when bets on both sides", async () => {
                  await cfbContractDeployer.payFromWallet(0, 1, { value: minBet })
                  await cfbContractPlayer.payFromWallet(0, -1, { value: minBet })
                  deployerMargin0 = await cfbContractDeployer.getAvailableMargin()
                  playerMargin0 = await cfbContractPlayer.getAvailableMargin()
                  await network.provider.send("evm_increaseTime", [offsetDays1 * 86400 + 50])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  tx = await cfbContract.performUpkeep("0x")
                  txReceipt = await tx.wait(1)
                  deployerMargin1 = await cfbContractDeployer.getAvailableMargin()
                  playerMargin1 = await cfbContractPlayer.getAvailableMargin()
                  assert.equal(deployerMargin0, 0)
                  assert.equal(playerMargin0, 0)
                  assert.equal(deployerMargin1, 0)
                  assert.equal(playerMargin1.toString(), minBet * 2)
              })
          })
          describe("withdraw", async () => {
              it("'withdraw' works correctly", async () => {
                  await cfbContractDeployer.payFromWallet(0, 1, { value: minBet })
                  await network.provider.send("evm_increaseTime", [offsetDays1 * 86400 + 50])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  tx = await cfbContract.performUpkeep("0x")
                  txReceipt = await tx.wait(1)

                  await cfbContractDeployer.withDraw(minBet)
                  deployerMargin = await cfbContractDeployer.getAvailableMargin()
                  assert.equal(deployerMargin, 0)
                  await expect(cfbContractDeployer.withDraw(minBet)).to.be.revertedWith(
                      "CryptocurrencyFutureBet__NotEnoughWithdraw(0)"
                  )
              })
          })
      })
