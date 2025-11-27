// axios_auth.js
const axios = require('axios');
const { URL } = require('url');

/**
 * 🔒 Client configuration
 */
const CLIENT_CONFIG = {
    USERNAME: 'admin',
    PASSWORD: 'admin123',
    BASE_URL: 'http://tv.roarzone.info/app.php',
    USER_AGENT: 'Rangdhanu Live 1.0'
};

/**
 * @function makeAuthPostRequest
 * Basic Auth সহ POST request পাঠায় এবং response data সরাসরি ফিরিয়ে দেয়।
 * @param {Object|null} postData - যদি POST body থাকে, তা এখানে পাঠাতে হবে (JSON)
 * @returns {Promise<Object>} সফল হলে { success: true, data: <response_data> }
 * ব্যর্থ হলে { success: false, error: <error_details> }
 */
async function makeAuthPostRequest(postData = null) {
    const { USERNAME, PASSWORD, BASE_URL, USER_AGENT } = CLIENT_CONFIG;

    // URL-এ Basic Auth যোগ করা
    const urlWithAuth = new URL(BASE_URL);
    urlWithAuth.username = USERNAME;
    urlWithAuth.password = PASSWORD;

    try {
        const response = await axios.post(
            urlWithAuth.href,
            postData,
            {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/json'
                },
                auth: {
                    username: USERNAME,
                    password: PASSWORD
                }
            }
        );

        // ✅ Response data সরাসরি ফিরিয়ে দিচ্ছে
        return { success: true, data: response.data };

    } catch (error) {
        let errorDetails = {};

        if (error.response) {
            errorDetails = {
                message: `API Request Failed (Status: ${error.response.status})`,
                status: error.response.status,
                data: error.response.data
            };
        } else if (error.request) {
            errorDetails = { message: "Network Error: No response received from server." };
        } else {
            errorDetails = { message: `Request Setup Error: ${error.message}` };
        }

        return { success: false, error: errorDetails };
    }
}

// ✅ ফাংশন এক্সপোর্ট করা যাতে অন্য ফাইলে ব্যবহার করা যায়
module.exports = {
    makeAuthPostRequest
};
