const sendWhatsAppMessage = require('./utils/sendWhatsAppMessage');

const number = "+917483729869"; // Add country code + number (India code 91)
const message = "Hello! This is a test WhatsApp message from Twilio sandbox.";

sendWhatsAppMessage(number, message);
