using ChatAppBackend.DTOs.Auth;
using ChatAppBackend.Services;
using ChatAppBackend.Models;
using Microsoft.AspNetCore.Mvc;
using ChatAppBackend.Data;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ApplicationDbContext _context;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _config;



       public AuthController(IAuthService authService, ApplicationDbContext context, IEmailService emailService, IConfiguration config)
{
    _authService = authService;
    _context = context;
    _emailService = emailService;
    _config = config;
}

        [HttpPost("register")]
public async Task<IActionResult> Register([FromBody] RegisterDto dto)
{
    if (!ModelState.IsValid)
        return BadRequest(new {
            message = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .FirstOrDefault() ?? "Invalid input."
        });

    // Check username specifically first for a better error message
    bool usernameTaken = await _context.Users.AnyAsync(u =>
        u.UserName.ToLower() == dto.UserName.ToLower());

    if (usernameTaken)
        return BadRequest(new { message = "Username is already taken. Please choose another." });

    bool emailTaken = await _context.Users.AnyAsync(u =>
        u.Email.ToLower() == dto.Email.ToLower());

    if (emailTaken)
        return BadRequest(new { message = "An account with this email already exists." });

    var result = await _authService.RegisterAsync(dto);

    if (result == null)
        return BadRequest(new { message = "Registration failed. Please try again." });

    return Ok(result);
}

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _authService.LoginAsync(dto);

            if (result == null)
                return Unauthorized(new { message = "Invalid email or password." });

            return Ok(result);
        }

        [HttpPost("forgot-password")]
public async Task<IActionResult> ForgotPassword(
    [FromBody] ForgotPasswordDto dto)
{
    var user = await _context.Users
        .FirstOrDefaultAsync(u => u.Email == dto.Email.ToLower());

    // Always return OK to prevent email enumeration
    if (user == null)
        return Ok(new { message =
            "If that email exists, a reset link has been sent." });

    // Invalidate any existing tokens for this user
    var existingTokens = _context.PasswordResetTokens
        .Where(t => t.UserId == user.Id && !t.IsUsed);
    _context.PasswordResetTokens.RemoveRange(existingTokens);

    // Generate new token
    var token = Convert.ToBase64String(Guid.NewGuid().ToByteArray())
        .Replace("/", "_").Replace("+", "-").Replace("=", "");

    _context.PasswordResetTokens.Add(new PasswordResetToken
    {
        UserId = user.Id,
        Token = token,
        ExpiresAt = DateTime.UtcNow.AddHours(1),
        IsUsed = false
    });

    await _context.SaveChangesAsync();

    var frontendUrl = _config["EmailSettings:FrontendUrl"];
    var resetLink = $"{frontendUrl}/reset-password?token={token}";

    await _emailService.SendPasswordResetEmailAsync(
        user.Email, user.UserName, resetLink);

    return Ok(new { message =
        "If that email exists, a reset link has been sent." });
}

[HttpPost("reset-password")]
public async Task<IActionResult> ResetPassword(
    [FromBody] ResetPasswordDto dto)
{
    var resetToken = await _context.PasswordResetTokens
        .Include(t => t.User)
        .FirstOrDefaultAsync(t =>
            t.Token == dto.Token &&
            !t.IsUsed &&
            t.ExpiresAt > DateTime.UtcNow);

    if (resetToken == null)
        return BadRequest(new { message =
            "Invalid or expired reset link." });

    resetToken.User.PasswordHash =
        BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
    resetToken.IsUsed = true;

    await _context.SaveChangesAsync();

    return Ok(new { message =
        "Password reset successfully. You can now log in." });
}
    }
}