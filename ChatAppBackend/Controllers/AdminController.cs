using System.Security.Claims;
using ChatAppBackend.Data;
using ChatAppBackend.DTOs.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AdminController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Every action in this controller re-checks IsSiteAdmin itself
        // rather than trusting a JWT claim - the flag can change after a
        // token was issued (e.g. revoked), so we always hit the DB fresh.
        private async Task<bool> IsRequesterSiteAdmin()
        {
            var userId = Guid.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var user = await _context.Users.FindAsync(userId);
            return user?.IsSiteAdmin == true;
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            if (!await IsRequesterSiteAdmin())
                return Forbid();

            var users = await _context.Users
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new AdminUserDto
                {
                    Id = u.Id,
                    UserName = u.UserName,
                    Email = u.Email,
                    AvatarUrl = u.AvatarUrl,
                    IsEmailVerified = u.IsEmailVerified,
                    IsSiteAdmin = u.IsSiteAdmin,
                    CreatedAt = u.CreatedAt,
                    LastSeenAt = u.LastSeenAt
                })
                .ToListAsync();

            return Ok(users);
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            if (!await IsRequesterSiteAdmin())
                return Forbid();

            var stats = new AdminStatsDto
            {
                TotalUsers = await _context.Users.CountAsync(),
                VerifiedUsers = await _context.Users.CountAsync(u => u.IsEmailVerified),
                TotalRooms = await _context.ChatRooms.CountAsync(),
                TotalGroupRooms = await _context.ChatRooms.CountAsync(r => r.IsGroup),
                TotalDirectMessageRooms = await _context.ChatRooms.CountAsync(r => !r.IsGroup),
                TotalMessages = await _context.Messages.CountAsync()
            };

            return Ok(stats);
        }
    }
}