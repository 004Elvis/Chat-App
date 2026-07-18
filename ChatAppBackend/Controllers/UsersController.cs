using System.Security.Claims;
using ChatAppBackend.Data;
using ChatAppBackend.DTOs.Users;
using ChatAppBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICloudinaryService _cloudinaryService;

        public UsersController(
            ApplicationDbContext context, ICloudinaryService cloudinaryService)
        {
            _context = context;
            _cloudinaryService = cloudinaryService;
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            var userId = Guid.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            return Ok(new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                AvatarUrl = user.AvatarUrl,
                LastSeenAt = user.LastSeenAt
            });
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string query)
        {
            if (string.IsNullOrWhiteSpace(query))
                return Ok(new List<UserDto>());

            var currentUserId = Guid.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var users = await _context.Users
                .Where(u => u.Id != currentUserId &&
                    (u.UserName.Contains(query) || u.Email.Contains(query)))
                .Take(10)
                .Select(u => new UserDto
                {
                    Id = u.Id,
                    UserName = u.UserName,
                    Email = u.Email,
                    AvatarUrl = u.AvatarUrl,
                    LastSeenAt = u.LastSeenAt
                })
                .ToListAsync();

            return Ok(users);
        }

        [HttpPost("me/avatar")]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file was uploaded." });

            // 5MB cap - plenty for an avatar, keeps abuse/cost in check
            const long maxSizeBytes = 5 * 1024 * 1024;
            if (file.Length > maxSizeBytes)
                return BadRequest(new { message = "Image must be smaller than 5MB." });

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
            if (!allowedTypes.Contains(file.ContentType))
                return BadRequest(new { message = "Only JPG, PNG, WEBP or GIF images are allowed." });

            var userId = Guid.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            try
            {
                using var stream = file.OpenReadStream();
                var avatarUrl = await _cloudinaryService
                    .UploadAvatarAsync(stream, file.FileName, userId);

                user.AvatarUrl = avatarUrl;
                await _context.SaveChangesAsync();

                return Ok(new { avatarUrl });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Avatar upload error: {ex.Message}");
                return StatusCode(500, new { message =
                    "Could not upload image right now. Please try again." });
            }
        }

        [HttpPut("me/username")]
        public async Task<IActionResult> UpdateUsername([FromBody] UpdateUsernameDto dto)
        {
            var userId = Guid.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // No-op if they "changed" it to the same name (case-insensitive)
            if (user.UserName.ToLower() == dto.UserName.ToLower())
                return Ok(new { userName = user.UserName });

            bool taken = await _context.Users.AnyAsync(u =>
                u.Id != userId && u.UserName.ToLower() == dto.UserName.ToLower());

            if (taken)
                return BadRequest(new { message = "Username is already taken. Please choose another." });

            user.UserName = dto.UserName;
            await _context.SaveChangesAsync();

            return Ok(new { userName = user.UserName });
        }
    }
}