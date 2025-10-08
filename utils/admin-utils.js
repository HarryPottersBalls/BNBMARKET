const logger = require('./logger');

function isAdminAddress(address) {
  if (!address) return false;

  const adminAddresses = [
    process.env.ADMIN_WALLET
  ].filter(Boolean);

  // Normalize all addresses to lowercase for comparison
  const normalizedAddress = address.toLowerCase();
  const normalizedAdminAddresses = adminAddresses.map(addr => addr.toLowerCase());

  const isAdmin = normalizedAdminAddresses.includes(normalizedAddress);

  // Debug logging
  logger.debug('Admin check:', {
    providedAddress: address,
    normalizedAddress: normalizedAddress,
    adminAddresses: normalizedAdminAddresses,
    isAdmin: isAdmin
  });

  return isAdmin;
}

module.exports = { isAdminAddress };