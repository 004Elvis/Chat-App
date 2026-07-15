using ChatAppBackend.DTOs.Auth;
using ChatAppBackend.Services;
using ChatAppBackend.Models;
using Microsoft.AspNetCore.Mvc;
using ChatAppBackend.Data;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

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

[HttpPost("google")]
public async Task<IActionResult> GoogleLogin([FromBody] GoogleAuthDto dto)
{
    try
    {
        // Verify the Google ID token
        var payload = await Google.Apis.Auth.GoogleJsonWebSignature
            .ValidateAsync(dto.IdToken, new Google.Apis.Auth
                .GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _config["GoogleAuth:ClientId"] }
            });

        // Check if user already exists
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == payload.Email.ToLower());

        if (user == null)
        {
            // Create new user from Google account
            var userName = payload.Email.Split('@')[0];
            userName = System.Text.RegularExpressions.Regex
                .Replace(userName, @"[^a-zA-Z0-9_-]", "_");

            // Enforce the same 3-20 character rule as manual registration.
            // Pad short names (e.g. "jo" from jo@gmail.com) so they clear
            // the 3-char minimum used by RegisterDto's validation.
            if (userName.Length < 3)
                userName = userName.PadRight(3, '0');

            // Reserve room for a numeric suffix (up to 3 digits) so that
            // "baseUserName{suffix}" can never exceed the 20-char max.
            var baseUserName = userName.Length > 17
                ? userName.Substring(0, 17) : userName;
            userName = baseUserName;
            int suffix = 1;
            while (await _context.Users.AnyAsync(u =>
                u.UserName.ToLower() == userName.ToLower()))
            {
                userName = $"{baseUserName}{suffix}";
                suffix++;
            }

            user = new User
            {
                Id = Guid.NewGuid(),
                UserName = userName,
                Email = payload.Email.ToLower(),
                PasswordHash = BCrypt.Net.BCrypt
                    .HashPassword(Guid.NewGuid().ToString()),
                AvatarUrl = payload.Picture,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        }

        user.LastSeenAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(BuildAuthResponse(user));
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Google auth error: {ex.Message}");
        return Unauthorized(new { message = "Invalid Google token." });
    }
}

private AuthResponseDto BuildAuthResponse(User user)
{
    var jwtSettings = _config.GetSection("JwtSettings");
    var key = new SymmetricSecurityKey(
        Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!));

    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim("sub", user.Id.ToString()),
        new Claim("nameid", user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.UserName),
        new Claim(ClaimTypes.Email, user.Email)
    };

    var token = new JwtSecurityToken(
        issuer: jwtSettings["Issuer"],
        audience: jwtSettings["Audience"],
        claims: claims,
        expires: DateTime.UtcNow.AddDays(7),
        signingCredentials: new SigningCredentials(
            key, SecurityAlgorithms.HmacSha256)
    );

    return new AuthResponseDto
    {
        Token = new JwtSecurityTokenHandler().WriteToken(token),
        UserName = user.UserName,
        UserId = user.Id,
        AvatarUrl = user.AvatarUrl
    };
}
    }
}