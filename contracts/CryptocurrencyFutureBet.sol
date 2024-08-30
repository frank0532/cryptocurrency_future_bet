// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

uint256 constant MINDAYS = 7;
uint256 constant MAXDAYS = 1000;

error CryptocurrencyFutureBet__NotEnoughETHEntered();
error CryptocurrencyFutureBet__BetOver();
error CryptocurrencyFutureBet__NotEnoughWithdraw(uint256 maxWithdraw);
error CryptocurrencyFutureBet__NotEnoughMargin(uint256 maxAvailableMargin);
error CryptocurrencyFutureBet__InvertStr2NumError(string numStr);

contract CryptocurrencyFutureBet is KeeperCompatibleInterface {
    mapping(uint256 => Bet) private s_allBets;
    mapping(string => AggregatorV3Interface) private s_feedData;
    mapping(address => uint256) private s_playersMargin;
    uint256 private s_betId = 0;
    uint256 private immutable i_minBet;
    string[] private s_betsLines;

    event BetEnter(address indexed player, string symbol, int256 targetPrice, uint256 endTime);
    event ABetSettled(uint256 indexed indexId, string desc);

    struct Bet {
        bool settled;
        string symbol;
        uint64 startTime;
        uint64 stopTime;
        uint64 targetTime;
        int256 targetPrice;
        int256 realPrice;
        address creator;
        address[] playersList;
        uint256 upsSum;
        uint256 downsSum;
        mapping(address => uint256) betsUp;
        mapping(address => uint256) betsDown;
    }

    constructor(uint256 minBet) {
        i_minBet = minBet;
    }

    function withDrawAll() public {
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success);
    }

    function withDraw(uint256 amount) external {
        if (amount > s_playersMargin[msg.sender]) {
            revert CryptocurrencyFutureBet__NotEnoughWithdraw(s_playersMargin[msg.sender]);
        }
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        s_playersMargin[msg.sender] = s_playersMargin[msg.sender] - amount;
    }

    function checkUpkeep(bytes memory checkData)
        public
        override
        returns (bool upkeepNeeded, bytes memory)
    {}

    function performUpkeep(bytes calldata) external override {
        for (uint256 i = 0; i < s_betId; i++) {
            if (s_allBets[i].targetTime <= block.timestamp) {
                aBetSettlement(i);
            }
        }
    }

    function aBetSettlement(uint256 betIndex) private {
        if (!s_allBets[betIndex].settled) {
            (int256 realPrice, ) = getPrice(s_allBets[betIndex].symbol);
            int256 direct = realPrice - s_allBets[betIndex].targetPrice;
            if (s_allBets[betIndex].upsSum == 0 && s_allBets[betIndex].downsSum == 0) {} else {
                if (s_allBets[betIndex].upsSum > 0 && s_allBets[betIndex].downsSum > 0) {
                    if (direct < 0) {
                        for (uint256 i = 0; i < s_allBets[betIndex].playersList.length; i++) {
                            address playeri = s_allBets[betIndex].playersList[i];
                            s_playersMargin[playeri] =
                                s_playersMargin[playeri] +
                                s_allBets[betIndex].betsDown[playeri] +
                                (s_allBets[betIndex].betsDown[playeri] /
                                    s_allBets[betIndex].downsSum) *
                                s_allBets[betIndex].upsSum;
                        }
                    } else {
                        for (uint256 i = 0; i < s_allBets[betIndex].playersList.length; i++) {
                            address playeri = s_allBets[betIndex].playersList[i];
                            s_playersMargin[playeri] =
                                s_playersMargin[playeri] +
                                s_allBets[betIndex].betsUp[playeri] +
                                (s_allBets[betIndex].betsUp[playeri] / s_allBets[betIndex].upsSum) *
                                s_allBets[betIndex].downsSum;
                        }
                    }
                } else {
                    if (s_allBets[betIndex].upsSum == 0) {
                        for (uint256 i = 0; i < s_allBets[betIndex].playersList.length; i++) {
                            address playeri = s_allBets[betIndex].playersList[i];
                            s_playersMargin[playeri] =
                                s_playersMargin[playeri] +
                                s_allBets[betIndex].betsDown[playeri];
                        }
                    } else {
                        for (uint256 i = 0; i < s_allBets[betIndex].playersList.length; i++) {
                            address playeri = s_allBets[betIndex].playersList[i];
                            s_playersMargin[playeri] =
                                s_playersMargin[playeri] +
                                s_allBets[betIndex].betsUp[playeri];
                        }
                    }
                }
            }
            s_allBets[betIndex].settled = true;
            emit ABetSettled(betIndex, s_betsLines[betIndex]);
        }
    }

    function betTrace(
        uint256 betIndex,
        int8 direct,
        address player,
        uint256 amount
    ) private {
        if (amount < i_minBet) {
            revert CryptocurrencyFutureBet__NotEnoughETHEntered();
        }
        if (block.timestamp > s_allBets[betIndex].stopTime) {
            revert CryptocurrencyFutureBet__BetOver();
        }
        if (
            (s_allBets[betIndex].betsUp[player] == 0) && (s_allBets[betIndex].betsDown[player] == 0)
        ) {
            s_allBets[betIndex].playersList.push(player);
        }
        if (direct > 0) {
            s_allBets[betIndex].betsUp[player] = s_allBets[betIndex].betsUp[player] + amount;
            s_allBets[betIndex].upsSum = s_allBets[betIndex].upsSum + amount;
        } else {
            s_allBets[betIndex].betsDown[player] = s_allBets[betIndex].betsDown[player] + amount;
            s_allBets[betIndex].downsSum = s_allBets[betIndex].downsSum + amount;
        }
        emit BetEnter(
            player,
            s_allBets[betIndex].symbol,
            s_allBets[betIndex].targetPrice,
            s_allBets[betIndex].targetTime
        );
    }

    function payFromWallet(uint256 betIndex, int8 direct) external payable {
        betTrace(betIndex, direct, msg.sender, msg.value);
    }

    function payFromMargin(
        uint256 betIndex,
        int8 direct,
        uint256 amount
    ) external {
        if (s_playersMargin[msg.sender] >= amount) {
            betTrace(betIndex, direct, msg.sender, amount);
            s_playersMargin[msg.sender] = s_playersMargin[msg.sender] - amount;
        } else {
            revert CryptocurrencyFutureBet__NotEnoughMargin(s_playersMargin[msg.sender]);
        }
    }

    function createBet(
        string calldata symbol,
        uint64 targetTime,
        string calldata targetPriceInt,
        string calldata targetPriceDecimals,
        address feedDataAddress
    ) external {
        uint64 startTime = uint64(block.timestamp);
        uint64 offsetDays = (targetTime - startTime) / 86400;
        require(
            (offsetDays >= MINDAYS) && (offsetDays <= MAXDAYS),
            string(
                abi.encodePacked(
                    "'offsetDays'should be in[",
                    Strings.toString(MINDAYS),
                    ",",
                    Strings.toString(MAXDAYS),
                    ")."
                )
            )
        );
        s_allBets[s_betId].settled = false;
        s_allBets[s_betId].symbol = symbol;
        s_allBets[s_betId].startTime = startTime;
        s_allBets[s_betId].stopTime = (startTime + targetTime) / 2;
        s_allBets[s_betId].targetTime = targetTime;
        s_allBets[s_betId].creator = msg.sender;
        s_feedData[symbol] = AggregatorV3Interface(feedDataAddress);
        uint8 decimals = s_feedData[symbol].decimals();
        int256 TargetPrice = int256(
            str2uint(targetPriceInt) *
                (10**decimals) +
                str2uint(targetPriceDecimals) *
                (10**(decimals - uint8(bytes(targetPriceDecimals).length)))
        );
        s_allBets[s_betId].targetPrice = TargetPrice;
        s_betsLines.push(
            string(
                abi.encodePacked(
                    symbol,
                    ",",
                    Strings.toString(s_allBets[s_betId].startTime),
                    ",",
                    Strings.toString(s_allBets[s_betId].stopTime),
                    ",",
                    Strings.toString(s_allBets[s_betId].targetTime),
                    ",",
                    targetPriceInt,
                    ".",
                    targetPriceDecimals
                )
            )
        );
        s_betId = s_betId + 1;
    }

    function getABetDetails(uint256 betIndex)
        external
        view
        returns (
            address[] memory,
            string memory,
            string memory
        )
    {
        uint256 playersNum = s_allBets[betIndex].playersList.length;
        string memory betsUp = "";
        string memory betsDown = "";

        for (uint256 i = 0; i < playersNum; i++) {
            address playeri = s_allBets[betIndex].playersList[i];
            uint256 upi = s_allBets[betIndex].betsUp[playeri];
            uint256 downi = s_allBets[betIndex].betsDown[playeri];
            betsUp = string(abi.encodePacked(betsUp, Strings.toString(upi), ","));
            betsDown = string(abi.encodePacked(betsDown, Strings.toString(downi), ","));
        }
        return (s_allBets[betIndex].playersList, betsUp, betsDown);
    }

    function getABetAsset(uint256 betIndex)
        external
        view
        returns (uint256 upsSum, uint256 downsSum)
    {
        upsSum = s_allBets[betIndex].upsSum;
        downsSum = s_allBets[betIndex].downsSum;
    }

    function getABetStatus(uint256 betIndex) external view returns (bool) {
        return (s_allBets[betIndex].settled);
    }

    function getAllBetsLines() external view returns (string[] memory) {
        return (s_betsLines);
    }

    function getPrice(string memory symbol) public view returns (int256, uint8) {
        (, int256 price, , , ) = s_feedData[symbol].latestRoundData();
        uint8 decimals = s_feedData[symbol].decimals();
        return (price, decimals);
    }

    function getAvailableMargin() external view returns (uint256) {
        return s_playersMargin[msg.sender];
    }

    function getMinBet() external view returns (uint256) {
        return (i_minBet);
    }

    function getBetsLinesNum() external view returns (uint256) {
        return (s_betId);
    }

    function str2uint(string calldata strNum) public pure returns (uint256 num) {
        for (uint256 i = 0; i < bytes(strNum).length; i++) {
            if ((uint8(bytes(strNum)[i]) - 48) < 0 || (uint8(bytes(strNum)[i]) - 48) > 9) {
                revert CryptocurrencyFutureBet__InvertStr2NumError(strNum);
            }
            num += (uint8(bytes(strNum)[i]) - 48) * 10**(bytes(strNum).length - i - 1);
        }
        return (num);
    }
}
