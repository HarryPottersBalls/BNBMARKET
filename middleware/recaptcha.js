const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const logger = require('../utils/logger');
const { ForbiddenError } = require('../errors/customErrors');

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_THRESHOLD = parseFloat(process.env.RECAPTCHA_THRESHOLD || '0.5'); // Default threshold

const recaptchaMiddleware = async (req, res, next) => {
  const reCAPTCHAToken = req.body.reCAPTCHAToken || req.headers['x-recaptcha-token'];

  if (!RECAPTCHA_SECRET_KEY) {
    logger.warn('reCAPTCHA secret key is not set. Skipping reCAPTCHA verification.');
    return next(); // Allow request to proceed if reCAPTCHA is not configured
  }

  if (!reCAPTCHAToken) {
    logger.warn('reCAPTCHA token missing from request.');
    return next(new ForbiddenError('reCAPTCHA token missing. Access denied.'));
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${reCAPTCHAToken}`,
    });

    const data = await response.json();

    if (!data.success || data.score < RECAPTCHA_THRESHOLD) {
      logger.warn(`reCAPTCHA verification failed for IP: ${req.ip}, Score: ${data.score}, Action: ${data.action}, Reason: ${data['error-codes'] ? data['error-codes'].join(', ') : 'N/A'}`);
      return next(new ForbiddenError('reCAPTCHA verification failed. Access denied.'));
    }

    logger.info(`reCAPTCHA verification successful for IP: ${req.ip}, Score: ${data.score}, Action: ${data.action}`);
    next();
  } catch (error) {
    logger.error('Error during reCAPTCHA verification:', error);
    next(new Error('Internal server error during reCAPTCHA verification.'));
  }
};

module.exports = recaptchaMiddleware;
