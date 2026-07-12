using ChatAppBackend.DTOs.Auth;
using ChatAppBackend.Services;
using Microsoft.AspNetCore.Mvc;
using ChatAppBackend.Data;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ApplicationDbContext _context;


       public AuthController(IAuthService authService, ApplicationDbContext context)
{
    _authService = authService;
    _context = context;
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
    }
}