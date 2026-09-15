using System;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace ChatAppBackend.Services
{
    public interface IEmailService
    {
        Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetLink);
        Task SendVerificationEmailAsync(string toEmail, string userName, string verifyLink);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetLink)
        {
            var settings = _config.GetSection("EmailSettings");
            var appPassword = settings["SendGridApiKey"];
            var fromEmail = settings["FromEmail"] ?? "elvismidega@gmail.com";
            var fromName = settings["FromName"] ?? "ChatApp";

            Console.WriteLine($"=== EMAIL: Sending to {toEmail} via Gmail SMTP ===");
            Console.WriteLine($"=== RESET LINK: {resetLink} ===");

            if (string.IsNullOrEmpty(appPassword))
            {
                Console.WriteLine("[ERROR] App Password is empty in Configuration!");
                return;
            }

            try
            {
                using var client = new SmtpClient("smtp.gmail.com")
                {
                    Port = 587,
                    Credentials = new NetworkCredential(fromEmail, appPassword),
                    EnableSsl = true,
                };

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(fromEmail, fromName),
                    Subject = "Reset your ChatApp password",
                    Body = $@"
<div style=""font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;"">
  <h2 style=""color:#1f6f64;"">💬 ChatApp</h2>
  <h3>Reset Your Password</h3>
  <p>Hi {userName},</p>
  <p>Click the button below to reset your password.</p>
  <p style=""text-align:center; margin: 32px 0;"">
    <a href=""{resetLink}""
       style=""background:#1f6f64; color:#ffffff; padding: 12px 28px;
              border-radius: 8px; text-decoration: none; font-weight: bold;
              display: inline-block;"">
      Reset Password
    </a>
  </p>
  <p style=""color:#666; font-size: 13px;"">
    Or copy and paste this link into your browser:<br>
    <a href=""{resetLink}"">{resetLink}</a>
  </p>
  <p>This link expires in 1 hour.</p>
  <p style=""color:#999; font-size: 12px;"">
    If you didn't request this, you can safely ignore this email.
  </p>
</div>",
                    IsBodyHtml = true,
                };
                mailMessage.To.Add(toEmail);

                await client.SendMailAsync(mailMessage);
                Console.WriteLine("=== EMAIL STATUS: Sent Successfully ===");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"=== EMAIL ERROR: {ex.Message} ===");
            }
        }

        public async Task SendVerificationEmailAsync(string toEmail, string userName, string verifyLink)
        {
            var settings = _config.GetSection("EmailSettings");
            var appPassword = settings["SendGridApiKey"];
            var fromEmail = settings["FromEmail"] ?? "elvismidega@gmail.com";
            var fromName = settings["FromName"] ?? "ChatApp";

            Console.WriteLine($"=== VERIFICATION EMAIL: Sending to {toEmail} via Gmail SMTP ===");
            Console.WriteLine($"=== VERIFY LINK: {verifyLink} ===");

            if (string.IsNullOrEmpty(appPassword))
            {
                Console.WriteLine("[ERROR] App Password is empty in Configuration!");
                return;
            }

            try
            {
                using var client = new SmtpClient("smtp.gmail.com")
                {
                    Port = 587,
                    Credentials = new NetworkCredential(fromEmail, appPassword),
                    EnableSsl = true,
                };

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(fromEmail, fromName),
                    Subject = "Verify your ChatApp email",
                    Body = $@"
<div style=""font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;"">
  <h2 style=""color:#1f6f64;"">💬 ChatApp</h2>
  <h3>Verify Your Email</h3>
  <p>Hi {userName},</p>
  <p>Thanks for signing up! Click the button below to confirm this is really your email address.</p>
  <p style=""text-align:center; margin: 32px 0;"">
    <a href=""{verifyLink}""
       style=""background:#1f6f64; color:#ffffff; padding: 12px 28px;
              border-radius: 8px; text-decoration: none; font-weight: bold;
              display: inline-block;"">
      Verify Email
    </a>
  </p>
  <p style=""color:#666; font-size: 13px;"">
    Or copy and paste this link into your browser:<br>
    <a href=""{verifyLink}"">{verifyLink}</a>
  </p>
  <p>This link expires in 24 hours.</p>
  <p style=""color:#999; font-size: 12px;"">
    If you didn't create this account, you can safely ignore this email.
  </p>
</div>",
                    IsBodyHtml = true,
                };
                mailMessage.To.Add(toEmail);

                await client.SendMailAsync(mailMessage);
                Console.WriteLine("=== VERIFICATION EMAIL STATUS: Sent Successfully ===");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"=== VERIFICATION EMAIL ERROR: {ex.Message} ===");
            }
        }
    }
}