const { v4: uuidv4 } = require('uuid');
const Decimal = require('decimal.js');

class Market {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.title = data.title;
    this.description = data.description || '';
    this.category = data.category || 'other';
    this.creatorAddress = data.creatorAddress;
    this.status = data.status || 'draft';
    this.endDate = data.endDate ? new Date(data.endDate) : null;
    this.options = this._validateOptions(data.options);
    this.initialLiquidity = new Decimal(data.initialLiquidity || 0);
    this.totalVolume = new Decimal(data.totalVolume || 0);
    this.metadata = {
      ...data.metadata,
      createdAt: data.metadata?.createdAt || new Date(),
      updatedAt: new Date()
    };
  }

  // Validate and transform market options
  _validateOptions(options = []) {
    return options.map(option => ({
      id: option.id || uuidv4(),
      name: option.name,
      image: option.image || null,
      probability: new Decimal(option.probability || 0)
    }));
  }

  // Validate market creation
  validate() {
    const errors = [];

    if (!this.title || this.title.length < 10) {
      errors.push('Title must be at least 10 characters long');
    }

    if (!this.creatorAddress) {
      errors.push('Creator address is required');
    }

    if (this.options.length < 2) {
      errors.push('At least two market options are required');
    }

    if (this.endDate && this.endDate < new Date()) {
      errors.push('End date must be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Calculate current market probabilities
  calculateProbabilities(bets) {
    const totalBets = bets.reduce((sum, bet) => sum.plus(bet.amount), new Decimal(0));

    return this.options.map(option => {
      const optionBets = bets.filter(bet => bet.optionId === option.id);
      const optionTotal = optionBets.reduce((sum, bet) => sum.plus(bet.amount), new Decimal(0));

      return {
        optionId: option.id,
        probability: totalBets.gt(0)
          ? optionTotal.dividedBy(totalBets).times(100)
          : new Decimal(100 / this.options.length)
      };
    });
  }

  // Serialize market for storage or transmission
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      category: this.category,
      creatorAddress: this.creatorAddress,
      status: this.status,
      endDate: this.endDate,
      options: this.options,
      initialLiquidity: this.initialLiquidity.toString(),
      totalVolume: this.totalVolume.toString(),
      metadata: this.metadata
    };
  }
}

module.exports = Market;