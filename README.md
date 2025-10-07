# BNBmarket - Decentralized Prediction Markets

A decentralized prediction market platform built on Binance Smart Chain, allowing users to create and trade on prediction markets using BNB.

## 🚀 Features

- **Create Markets**: Create prediction markets on any topic with custom options and images
- **Place Bets**: Bet BNB on outcomes with transparent, blockchain-based odds
- **Real-time Charts**: Price and volume charts showing market dynamics
- **Admin Panel**: Market review and odds management system
- **Treasury System**: Secure fund management on BSC
- **MetaMask Integration**: Connect with MetaMask wallet for BSC transactions

## 🏗️ Tech Stack

### Frontend
- **HTML/CSS/JavaScript**: Pure web technologies, no frameworks
- **Web3.js**: For Binance Smart Chain interactions
- **Chart.js**: Real-time market visualization
- **MetaMask**: Wallet connection and transaction signing

### Backend
- **Node.js + Express**: RESTful API server
- **PostgreSQL**: Market and betting data storage
- **Cloudinary**: Image upload and storage
- **Web3**: BSC blockchain interactions

### Blockchain
- **Binance Smart Chain**: Primary blockchain network
- **BNB**: Native token for all transactions
- **Smart Contracts**: Custom contracts for market logic (future implementation)

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- MetaMask wallet extension
- Cloudinary account (for image uploads)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/bnbmarket.git
   cd bnbmarket
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=your_postgresql_connection_string
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   BSC_RPC_URL=https://bsc-dataseed1.binance.org/
   PORT=3001
   ```

4. **Database setup**
   The database tables will be automatically created when you start the server.

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3001`
