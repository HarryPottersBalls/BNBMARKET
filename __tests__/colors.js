// Header & Navigation
const headerStyles = {
  background: colors.background,
  text: colors.text.light,
  balanceText: colors.accents.balanced, // "Balance + Harmony - Truth"
  binancePrice: colors.accents.yang,    // ¥8,888.00 - warm color
  connectWallet: colors.accents.yang    // Connect Wallet button
}

// Statistics Cards
const statCards = {
  yinVolume: {
    background: colors.accents.yin,     // Dark for yin
    text: colors.text.light
  },
  perfectBalance: {
    background: colors.accents.balanced, // Green for balance
    text: colors.text.light
  },
  yangVolume: {
    background: colors.accents.yang,     // Warm for yang
    text: colors.text.dark
  }
}

// Market Prediction Cards
const predictionCards = {
  bitcoin: {
    volumeBadge: colors.accents.yang,    // Yang volume
    yesCount: colors.accents.yang,       // YES votes
    noCount: colors.accents.yin          // NO votes
  },
  gdp: {
    volumeBadge: colors.accents.balanced, // Balanced volume
    yesCount: colors.accents.balanced,    // YES votes
    noCount: colors.accents.neutral       // NO votes
  },
  aiRegulations: {
    volumeBadge: colors.accents.yin,      // Yin volume
    yesCount: colors.accents.yin,         // YES votes
    noCount: colors.accents.neutral       // NO votes
  }
}