using SendGrid;
using SendGrid.Helpers.Mail;

namespace ChatAppBackend.Services
{
    public interface IEmailService
    {
        Task SendPasswordResetEmailAsync(string toEmail,
            string userName, string resetLink);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

     public async Task SendPasswordResetEmailAsync(
    string toEmail, string userName, string resetLink)
{
    var settings = _config.GetSection("EmailSettings");
    var apiKey = settings["SendGridApiKey"];

    Console.WriteLine($"=== EMAIL: Sending to {toEmail} ===");
    
    // SAFE CHECK: Prevents crash if apiKey is null, empty, or shorter than 10 chars!
    var keyPreview = !string.IsNullOrEmpty(apiKey) && apiKey.Length >= 10 
        ? apiKey.Substring(0, 10) + "..." 
        : "MISSING OR TOO SHORT!";
    Console.WriteLine($"=== API KEY starts with: {keyPreview} ===");
    
    Console.WriteLine($"=== RESET LINK: {resetLink} ===");

    if (string.IsNullOrEmpty(apiKey))
    {
        Console.WriteLine("[ERROR] SendGrid API Key is completely empty in Configuration!");
        return; // Exit safely instead of throwing SendGrid client errors
    }

    var client = new SendGridClient(apiKey);
    var from = new EmailAddress(settings["FromEmail"], settings["FromName"]);
    var to = new EmailAddress(toEmail, userName);
    var subject = "Reset your ChatApp password";
    var htmlContent = $@"
        <div style='font-family: Arial, sans-serif; max-width: 600px;'>
            <h2 style='color: #6c63ff;'>💬 ChatApp</h2>
            <h3>Reset Your Password</h3>
            <p>Hi {userName},</p>
            <p>Click the button below to reset your password.</p>
            <a href='{resetLink}'
               style='display:inline-block; padding:12px 24px;
                      background:#6c63ff; color:white;
                      text-decoration:none; border-radius:8px;
                      margin:16px 0;'>
                Reset Password
            </a>
            <p>This link expires in <strong>1 hour</strong>.</p>
            <p>If you didn't request this, ignore this email.</p>
        </div>";

    var msg = MailHelper.CreateSingleEmail(from, to, subject, null, htmlContent);
    var response = await client.SendEmailAsync(msg);

    Console.WriteLine($"=== EMAIL STATUS: {response.StatusCode} ===");

    var responseBody = await response.Body.ReadAsStringAsync();
    Console.WriteLine($"=== EMAIL RESPONSE: {responseBody} ===");
}
    }
}