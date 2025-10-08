import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Admin from './Admin';
import { colors } from './theme/colorscheme';
import { headerStyles } from './theme/colors';
import CloudinaryImageDisplay from './components/media/CloudinaryImageDisplay';
import PredictionMarketPage from './components/PredictionMarket';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/markets" element={<PredictionMarketPage />} />
        <Route path="/" element={<CloudinaryImageDisplay />} />
      </Routes>
    </Router>
  );
}

export default App;
