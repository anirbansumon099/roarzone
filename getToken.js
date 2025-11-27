// requester.js
const axios = require('axios');

/**
 * POST request sender compatible with curl -u, PHP-compatible Basic Auth
 * @param {string} url - Request URL
 * @param {object} options
 * @param {string} options.userAgent - User-Agent header
 * @param {string} options.username - Basic Auth username
 * @param {string} options.password - Basic Auth password
 * @param {string} [options.data] - Optional plain text POST body
 * @returns {Promise<any>} - Response data
 */
async function postRequest(url, options = {}) {
    const { userAgent = '', username = '', password = '', data = '' } = options;

    try {
        const response = await axios({
            method: 'post',
            url: url,
            headers: {
                'User-Agent': userAgent
            },
            auth: {
                username,
                password
            },
            data: data
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
