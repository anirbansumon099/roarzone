// CommonJS সিনট্যাক্স ব্যবহার করে axios ইম্পোর্ট করা
const axios = require('axios');
const { URL } = require('url');

// --- 🔒 ক্লায়েন্ট কনফিগারেশন (মডিউলের ভিতরে সুরক্ষিত) ---
const CLIENT_CONFIG = {
    USERNAME: 'admin',
    PASSWORD: 'admin123',
    BASE_URL: 'http://tv.roarzone.info/app.php',
    USER_AGENT: 'Rangdhanu Live 1.0'
};
// ----------------------------------------------------


/**
 * @function makeAuthPostRequest
 * কনফিগারেশনে থাকা ক্লায়েন্ট বিবরণ ব্যবহার করে একটি POST রিকোয়েস্ট করে।
 * @returns {Promise<Object>} axios থেকে প্রাপ্ত সম্পূর্ণ Response Object.
 */
async function makeAuthPostRequest() {
  
  const { USERNAME, PASSWORD, BASE_URL, USER_AGENT } = CLIENT_CONFIG;

  // URL অবজেক্ট তৈরি করা এবং ইউজারনেম/পাসওয়ার্ড যুক্ত করা
  const urlWithAuth = new URL(BASE_URL);
  urlWithAuth.username = USERNAME;
  urlWithAuth.password = PASSWORD;
  
  const finalUrl = urlWithAuth.href;

  try {
    const response = await axios.post(
      finalUrl, 
      null, // ডেটা বডি ফাঁকা
      {
        headers: {
          // কাস্টম User-Agent হেডার
          'User-Agent': USER_AGENT,
        },
      }
    );

    // সফল হলে সম্পূর্ণ Response Object রিটার্ন করা
    return response; 

  } catch (error) {
    // ত্রুটি হ্যান্ডেলিং: ত্রুটির সময়ও যদি Response থাকে, তবে সেটি রিটার্ন করা।
    if (error.response) {
      // 4xx বা 5xx ত্রুটির সময়ও response অবজেক্টটি থ্রো করা
      throw error.response; 
    } else {
      // নেটওয়ার্ক বা অন্য কোনো ত্রুটি থ্রো করা
      throw new Error(`Network Error: ${error.message}`);
    }
  }
}

// CommonJS সিনট্যাক্স: ফাংশনটিকে মডিউল হিসেবে এক্সপোর্ট করা
module.exports = {
    makeAuthPostRequest: makeAuthPostRequest
};
