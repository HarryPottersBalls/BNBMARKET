// Apply colors dynamically
function applyColors() {
  // Header
  document.querySelector('.balance-text').style.color = colors.accents.balanced;
  document.querySelector('.binance-price').style.color = colors.accents.yang;
  
  // Stats
  document.querySelector('.yin-volume').style.background = colors.accents.yin;
  document.querySelector('.perfect-balance').style.background = colors.accents.balanced;
  document.querySelector('.yang-volume').style.background = colors.accents.yang;
  
  // Predictions
  document.querySelectorAll('.volume-badge.yang').forEach(el => {
    el.style.background = colors.accents.yang;
  });
  // ... and so on for other elements
}