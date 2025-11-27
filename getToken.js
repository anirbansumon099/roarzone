const axios = require('axios');

/**
 * Send POST request with plain text data, custom User-Agent, and Base64 encoded Authorization
 * @param {string} url - Request URL
 * @param {object} options - Options
 * @param {string} options.userAgent - User-Agent
 * @param {string} options.username - Basic Auth username
 * @param {string} options.password - Basic Auth password
 * @param {string} options.data - Plain text data to send
 * @returns {Promise<any>} - Response data
 */
async function postRequest(url, options = {}) {
    const { userAgent = '', username = '', password = '', data = '' } = options;

    // Base64 encoded Authorization header (PHP-compatible)
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    try {
        const response = await axios.post(url, data, {
            headers: {
                'User-Agent': userAgent,
                'Authorization': authHeader,
                'Content-Type': 'text/plain'
            }
        });

        return response.data;
    } catch (error) {
        if (error.response) {
            return { error: true, status: error.response.status, data: error.response.data };
        } else {
            return { error: true, message: error.message };
        }
    }
}

module.exports = { postRequest };
