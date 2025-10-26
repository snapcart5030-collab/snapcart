// config/mail.js
module.exports = {
  // keep same API: sendMail({ to, subject, text })
  sendMail: async ({ to, subject, text }) => {
    try {
      console.log("📧 (Email disabled) Would send to:", to);
      console.log("📨 Subject:", subject);
      console.log("💬 Message:", text);
      // return success for callers expecting a resolved promise
      return Promise.resolve({ accepted: [to] });
    } catch (err) {
      console.error("Mailer (console) error:", err);
      return Promise.reject(err);
    }
  },
};
