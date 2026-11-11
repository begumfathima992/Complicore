const { Resend } = require('resend');

/**
 * Thin wrapper around Resend so the expiry-alert job (and anything else
 * that needs to send mail later) doesn't call the SDK directly - this is
 * the one seam a test mocks instead of hitting the real API, and the one
 * place that decides "no key configured => don't send, don't pretend".
 */
let client = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * @param {{to: string[], subject: string, html: string, text: string}} params
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function sendEmail({ to, subject, html, text }) {
  const resend = getClient();
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY is not configured' };
  }
  if (!to || to.length === 0) {
    return { sent: false, reason: 'No recipients' };
  }

  const from = process.env.MAIL_FROM || 'HRMS Compliance <alerts@striveraglobal.co.uk>';
  const result = await resend.emails.send({ from, to, subject, html, text });
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message || JSON.stringify(result.error)}`);
  }
  return { sent: true };
}

module.exports = { sendEmail };
