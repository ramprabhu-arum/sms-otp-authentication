const twilio = require("twilio");

const accountSid = "AC6510cade2d7d758b5f6a2d7902bd89e3";
const authToken = "a9916d8ef46d887d347b72cdec88d29a";
const client = twilio(accountSid, authToken);

async function testSend() {
  try {
    const message = await client.messages.create({
      body: "Test message from Twilio",
      from: "+15855801246",
      to: "+14014408512", // Your test phone number
    });
    console.log("Message sent successfully:", message.sid);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

testSend();
