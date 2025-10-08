// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PredictionMarket is Ownable, ReentrancyGuard {
    struct Market {
        uint256 id;
        address creator;
        string question;
        bool open; // True if the market is active and accepting swaps
    }

    // Wallets for fee distribution
    address public platformWallet;
    address public treasuryWallet;

    // Fee percentages
    uint256 public constant CREATOR_FEE_PERCENT = 2;
    uint256 public constant PLATFORM_FEE_PERCENT = 1;
    uint256 public constant TREASURY_FEE_PERCENT = 1;
    uint256 public constant TOTAL_FEE_PERCENT = 4; // Sum of all fees

    // Fee for creating a new market (e.g., 0.01 BNB)
    uint256 public marketCreationFee = 0.01 ether;

    // Storage
    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    // Accumulated fees for market creators
    mapping(address => uint256) public creatorFeeBalance;

    // Events
    event MarketCreated(uint256 indexed marketId, address indexed creator, string question);
    event Swap(uint256 indexed marketId, address indexed user, uint256 amount);
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);

    constructor(address initialOwner, address _platformWallet, address _treasuryWallet) Ownable(initialOwner) {
        require(_platformWallet != address(0), "Platform wallet cannot be zero address");
        require(_treasuryWallet != address(0), "Treasury wallet cannot be zero address");
        platformWallet = _platformWallet;
        treasuryWallet = _treasuryWallet;
    }

    /**
     * @dev Creates a new prediction market.
     * The market creation fee is split 50/50 between the platform and the treasury.
     */
    function createMarket(string memory _question) external payable nonReentrant {
        require(msg.value == marketCreationFee, "Incorrect market creation fee");

        // Split the creation fee
        uint256 platformShare = msg.value / 2;
        uint256 treasuryShare = msg.value - platformShare;

        // Send fees
        (bool success1, ) = platformWallet.call{value: platformShare}("");
        require(success1, "Failed to send fee to platform");
        (bool success2, ) = treasuryWallet.call{value: treasuryShare}("");
        require(success2, "Failed to send fee to treasury");

        // Create and store the new market
        marketCount++;
        markets[marketCount] = Market({
            id: marketCount,
            creator: msg.sender,
            question: _question,
            open: true
        });

        emit MarketCreated(marketCount, msg.sender, _question);
    }

    /**
     * @dev Simulates a swap on a market and distributes fees.
     * The core swap logic (LMSR) happens off-chain. This function's role is to
     * process the payment and correctly distribute the fees.
     */
    function swap(uint256 _marketId) external payable nonReentrant {
        require(markets[_marketId].open, "Market is not open");
        require(msg.value > 0, "Swap amount must be greater than zero");

        uint256 totalFee = (msg.value * TOTAL_FEE_PERCENT) / 100;
        uint256 netAmount = msg.value - totalFee; // Amount for the actual swap/liquidity pool

        // Calculate individual fees from the total swap value
        uint256 creatorFee = (msg.value * CREATOR_FEE_PERCENT) / 100;
        uint256 platformFee = (msg.value * PLATFORM_FEE_PERCENT) / 100;
        uint256 treasuryFee = (msg.value * TREASURY_FEE_PERCENT) / 100;

        // Accumulate creator's fee
        Market storage market = markets[_marketId];
        creatorFeeBalance[market.creator] += creatorFee;

        // Send fees to platform and treasury
        (bool success1, ) = platformWallet.call{value: platformFee}("");
        require(success1, "Failed to send fee to platform");
        (bool success2, ) = treasuryWallet.call{value: treasuryFee}("");
        require(success2, "Failed to send fee to treasury");

        // The netAmount would be sent to the liquidity pool/market maker contract.
        // For this simulation, we'll just emit an event.
        emit Swap(_marketId, msg.sender, netAmount);
    }

    /**
     * @dev Allows a market creator to withdraw their accumulated fees.
     */
    function withdrawCreatorFees() external nonReentrant {
        uint256 amount = creatorFeeBalance[msg.sender];
        require(amount > 0, "No fees to withdraw");

        creatorFeeBalance[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit CreatorFeesWithdrawn(msg.sender, amount);
    }

    // --- Admin Functions ---

    function setMarketCreationFee(uint256 _newFee) external onlyOwner {
        marketCreationFee = _newFee;
    }

    function setPlatformWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Cannot be zero address");
        platformWallet = _newWallet;
    }

    function setTreasuryWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Cannot be zero address");
        treasuryWallet = _newWallet;
    }

    function closeMarket(uint256 _marketId) external onlyOwner {
        markets[_marketId].open = false;
    }

    // Function to withdraw any BNB accidentally sent to this contract
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
