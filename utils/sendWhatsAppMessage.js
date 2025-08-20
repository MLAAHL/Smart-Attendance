const twilio = require("twilio");
require("dotenv").config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;

if (!accountSid || !authToken || !fromWhatsApp) {
  console.error("❌ Twilio environment variables missing. Please check your .env file.");
  console.error("Required variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER");
  process.exit(1);
}

const client = twilio(accountSid, authToken);

/**
 * Sends a WhatsApp message via Twilio.
 * @param {string} toNumber - Recipient phone number with country code, e.g. '917483729869'
 * @param {string} message - Message body text
 * @returns {Promise<Object>} - Returns success status and message details
 */
const sendWhatsAppMessage = async (toNumber, message) => {
  try {
    // Input validation
    if (!toNumber || !message) {
      throw new Error("Phone number and message are required");
    }

    if (typeof toNumber !== 'string' || typeof message !== 'string') {
      throw new Error("Phone number and message must be strings");
    }

    // Remove all non-digit characters (spaces, dashes, plus signs)
    const sanitizedNumber = toNumber.replace(/\D/g, "");

    // Enhanced phone number validation
    if (sanitizedNumber.length < 10) {
      throw new Error("Phone number too short (minimum 10 digits required)");
    }

    if (sanitizedNumber.length > 15) {
      throw new Error("Phone number too long (maximum 15 digits allowed)");
    }

    // Check if message is not empty after trimming
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new Error("Message cannot be empty");
    }

    // Format phone number for WhatsApp
    const fullTo = `whatsapp:+${sanitizedNumber}`;
    console.log(`📱 Sending WhatsApp to: ${fullTo}`);

    const response = await client.messages.create({
      from: fromWhatsApp,
      to: fullTo,
      body: trimmedMessage,
    });

    console.log(`✅ WhatsApp sent to ${toNumber}, Message SID: ${response.sid}`);
    
    return {
      success: true,
      messageId: response.sid,
      to: fullTo,
      status: response.status,
      message: "WhatsApp message sent successfully"
    };

  } catch (error) {
    console.error(`❌ Failed to send WhatsApp to ${toNumber}:`, error.message || error);
    
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      to: toNumber,
      message: "Failed to send WhatsApp message"
    };
  }
};

/**
 * Utility function to format phone numbers for WhatsApp
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} - Formatted phone number
 */
const formatPhoneForWhatsApp = (phoneNumber) => {
  if (!phoneNumber) return null;
  
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Add country code if not present (assuming India +91)
  if (digits.length === 10 && !digits.startsWith('91')) {
    return `91${digits}`;
  }
  
  return digits;
};

/**
 * Sends WhatsApp messages to multiple recipients with delay
 * @param {Array} recipients - Array of {phone, message} objects
 * @param {number} delay - Delay between messages in ms (default: 500)
 * @returns {Promise<Array>} - Array of results
 */
const sendBulkWhatsAppMessages = async (recipients, delay = 500) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendWhatsAppMessage(recipient.phone, recipient.message);
      results.push({
        phone: recipient.phone,
        studentName: recipient.studentName || 'Unknown',
        ...result
      });
      
      // Add delay to avoid rate limiting
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      results.push({
        phone: recipient.phone,
        studentName: recipient.studentName || 'Unknown',
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
};

module.exports = sendWhatsAppMessage;

// Export additional utilities if needed
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
module.exports.formatPhoneForWhatsApp = formatPhoneForWhatsApp;
module.exports.sendBulkWhatsAppMessages = sendBulkWhatsAppMessages;
