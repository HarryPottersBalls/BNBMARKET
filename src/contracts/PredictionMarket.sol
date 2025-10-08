// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract YinYangPredictionMarket {
    struct Prediction {
        string question;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 totalVolume;
        address creator;
        uint256 expirationTime;
        bool resolved;
        bool result;
    }

    mapping(uint256 => Prediction) public predictions;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public predictionCount;

    event PredictionCreated(
        uint256 indexed predictionId,
        string question,
        uint256 expirationTime
    );

    event VoteCast(
        uint256 indexed predictionId,
        address voter,
        bool vote,
        uint256 amount
    );

    event PredictionResolved(
        uint256 indexed predictionId,
        bool result
    );

    function createPrediction(
        string memory _question,
        uint256 _expirationTime
    ) public returns (uint256) {
        require(_expirationTime > block.timestamp, "Invalid expiration time");

        predictionCount++;
        predictions[predictionCount] = Prediction({
            question: _question,
            yesVotes: 0,
            noVotes: 0,
            totalVolume: 0,
            creator: msg.sender,
            expirationTime: _expirationTime,
            resolved: false,
            result: false
        });

        emit PredictionCreated(predictionCount, _question, _expirationTime);
        return predictionCount;
    }

    function vote(uint256 _predictionId, bool _vote) public payable {
        Prediction storage prediction = predictions[_predictionId];

        require(block.timestamp < prediction.expirationTime, "Prediction has expired");
        require(!prediction.resolved, "Prediction already resolved");
        require(!hasVoted[_predictionId][msg.sender], "Already voted");
        require(msg.value > 0, "Must send some value to vote");

        if (_vote) {
            prediction.yesVotes++;
        } else {
            prediction.noVotes++;
        }

        prediction.totalVolume += msg.value;
        hasVoted[_predictionId][msg.sender] = true;

        emit VoteCast(_predictionId, msg.sender, _vote, msg.value);
    }

    function resolvePrediction(uint256 _predictionId, bool _result) public {
        Prediction storage prediction = predictions[_predictionId];

        require(msg.sender == prediction.creator, "Only creator can resolve");
        require(block.timestamp >= prediction.expirationTime, "Cannot resolve before expiration");
        require(!prediction.resolved, "Prediction already resolved");

        prediction.resolved = true;
        prediction.result = _result;

        emit PredictionResolved(_predictionId, _result);
    }

    function withdrawWinnings(uint256 _predictionId) public {
        Prediction storage prediction = predictions[_predictionId];

        require(prediction.resolved, "Prediction not yet resolved");
        require(hasVoted[_predictionId][msg.sender], "You did not vote");

        bool userVote = (prediction.result && hasVotedYes(_predictionId, msg.sender)) ||
                        (!prediction.result && !hasVotedYes(_predictionId, msg.sender));

        require(userVote, "You voted incorrectly");

        uint256 totalPredictionVolume = prediction.totalVolume;
        uint256 winningVotes = prediction.result ? prediction.yesVotes : prediction.noVotes;

        uint256 userVoteWeight = 1; // In a more advanced version, this would be proportional to amount
        uint256 winningsShare = (totalPredictionVolume * userVoteWeight) / winningVotes;

        payable(msg.sender).transfer(winningsShare);
    }

    function hasVotedYes(uint256 _predictionId, address _voter) public view returns (bool) {
        return hasVoted[_predictionId][_voter];
    }

    function getPredictionDetails(uint256 _predictionId) public view returns (
        string memory question,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalVolume,
        uint256 expirationTime,
        bool resolved,
        bool result
    ) {
        Prediction storage prediction = predictions[_predictionId];
        return (
            prediction.question,
            prediction.yesVotes,
            prediction.noVotes,
            prediction.totalVolume,
            prediction.expirationTime,
            prediction.resolved,
            prediction.result
        );
    }
}