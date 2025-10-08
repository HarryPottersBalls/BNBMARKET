import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Cloudinary image display', () => {
  render(<App />);
  // Check for the presence of an img element, which is rendered by AdvancedImage
  const imageElement = screen.getByRole('img');
  expect(imageElement).toBeInTheDocument();
});
