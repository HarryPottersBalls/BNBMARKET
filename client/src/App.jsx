import React from 'react';

export default function YinyangMarket() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">陰陽市場</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Balance + Harmony - Truth</p>
          </div>
          
          <div className="flex items-center space-x-8">
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Binance</p>
              <p className="text-xl font-semibold">¥8,888.00</p>
            </div>
            <button className="bg-yin-600 hover:bg-yin-700 text-white px-6 py-2 rounded-lg transition-colors">
              Connect Wallet
            </button>
          </div>
        </div>
      </header>

      {/* Balance Principles */}
      <section className="container mx-auto px-6 mb-12">
        <div className="flex justify-center space-x-12">
          {[ 'Balance', 'Harmony', 'Wisdom'].map((principle) => (
            <div key={principle} className="text-center">
              <div className="w-20 h-20 rounded-full border-2 border-yang-500 dark:border-yin-400 mx-auto mb-3 flex items-center justify-center">
                <span className="text-lg">{principle.charAt(0)}</span>
              </div>
              <p className="font-medium">{principle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics Dashboard */}
      <section className="container mx-auto px-6 mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Yin Volume */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border-l-4 border-yin-600">
            <h3 className="text-lg font-semibold mb-2">Yin Volume</h3>
            <p className="text-2xl font-bold mb-1">¥9.2M</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Passive flows</p>
          </div>

          {/* Perfect Balance */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border-l-4 border-purple-500">
            <h3 className="text-lg font-semibold mb-2">Perfect Balance</h3>
            <p className="text-2xl font-bold mb-1">¥18.6M</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total harmony</p>
          </div>

          {/* Yang Volume */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border-l-4 border-yang-600">
            <h3 className="text-lg font-semibold mb-2">Yang Volume</h3>
            <p className="text-2xl font-bold mb-1">¥9.4M</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active flows</p>
          </div>
        </div>
      </section>

      {/* Prediction Markets */}
      <section className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Market 1 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">Will Bitcoin reach $100k by end of 2025?</h3>
              <span className="bg-yang-100 text-yang-800 dark:bg-yang-900 dark:text-yang-200 px-3 py-1 rounded-full text-sm">
                Yang
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Volume: ¥2.4M</p>
            
            <div className="flex space-x-4">
              <div className="flex-1 text-center">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">684</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">YES</p>
                </div>
              </div>
              <div className="flex-1 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">324</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">NO</p>
                </div>
              </div>
            </div>
          </div>

          {/* Market 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">Chinese GDP growth exceeds 5.5% this year?</h3>
              <span className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-3 py-1 rounded-full text-sm">
                Balanced
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Volume: ¥1.8M</p>
            
            <div className="flex space-x-4">
              <div className="flex-1 text-center">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">554</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">YES</p>
                </div>
              </div>
              <div className="flex-1 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">454</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">NO</p>
                </div>
              </div>
            </div>
          </div>

          {/* Market 3 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">AI regulations passed in Q1 2026?</h3>
              <span className="bg-yin-100 text-yin-800 dark:bg-yin-900 dark:text-yin-200 px-3 py-1 rounded-full text-sm">
                Yin
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Volume: ¥3.1M</p>
            
            <div className="flex space-x-4">
              <div className="flex-1 text-center">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">-</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">YES</p>
                </div>
              </div>
              <div className="flex-1 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">-</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">NO</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}