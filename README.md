# BNBMarket Backend

## Project Status
![Continuous Integration](https://github.com/yourusername/bnbmarket-backend/actions/workflows/ci.yml/badge.svg)
[![Coverage](https://codecov.io/gh/yourusername/bnbmarket-backend/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/bnbmarket-backend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=bnbmarket-backend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=bnbmarket-backend)

## Overview
BNBMarket is a prediction market platform built on the Binance Smart Chain.

## Prerequisites
- Node.js 18+
- npm 9+

## Installation
1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

## Running the Application
- Development: `npm run dev`
- Production: `npm start`

## Testing
- Run tests: `npm test`
- Run with coverage: `npm run test:coverage`

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Code Quality
- Linting: `npm run lint`
- Formatting: `npm run format`

## Environment Variables
Create a `.env` file with the following variables:
- `DATABASE_URL`
- `PORT`
- `NODE_ENV`

## Docker Support
Build: `docker build -t bnbmarket-backend .`
Run: `docker run -p 3000:3000 bnbmarket-backend`

## License
[Insert License Here]
