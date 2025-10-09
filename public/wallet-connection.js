async function connectMetaMask() {
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            // Get the first account
            const account = accounts[0];

            // Update UI to show connected state
            document.getElementById('connect-wallet-btn').textContent = `Connected: ${account.slice(0, 6)}...${account.slice(-4)}`;

            // Optional: You can add more logic here like getting balance, network, etc.
            return account;
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            alert('Failed to connect wallet. Please try again.');
            return null;
        }
    } else {
        alert('MetaMask is not installed. Please install MetaMask to connect.');
        return null;
    }
}

// Add event listener when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const connectButton = document.getElementById('connect-wallet-btn');
    if (connectButton) {
        connectButton.addEventListener('click', connectMetaMask);
    }
});