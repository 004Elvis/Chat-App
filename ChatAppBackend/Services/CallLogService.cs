using ChatAppBackend.Data;
using ChatAppBackend.DTOs.Calls;
using ChatAppBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Services
{
    public interface ICallLogService
    {
        Task<CallLogDto?> LogCallAsync(Guid callerId, LogCallDto dto);
        Task<List<CallLogDto>> GetMyCallLogsAsync(Guid userId, int? roomId);
    }

    public class CallLogService : ICallLogService
    {
        private readonly ApplicationDbContext _context;

        public CallLogService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<CallLogDto?> LogCallAsync(Guid callerId, LogCallDto dto)
        {
            var isMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == dto.ChatRoomId && m.UserId == callerId);
            if (!isMember) return null;

            var log = new CallLog
            {
                ChatRoomId = dto.ChatRoomId,
                CallerId = callerId,
                ReceiverId = dto.ReceiverId,
                IsVideo = dto.IsVideo,
                StartedAt = DateTime.UtcNow.AddSeconds(-dto.DurationSeconds),
                EndedAt = dto.Status == "Completed" ? DateTime.UtcNow : null,
                DurationSeconds = dto.DurationSeconds,
                Status = dto.Status
            };

            _context.CallLogs.Add(log);
            await _context.SaveChangesAsync();

            return await BuildDto(log, callerId);
        }

        public async Task<List<CallLogDto>> GetMyCallLogsAsync(Guid userId, int? roomId)
        {
            var query = _context.CallLogs
                .Where(c => c.CallerId == userId || c.ReceiverId == userId)
                .Include(c => c.Caller)
                .Include(c => c.Receiver)
                .Include(c => c.ChatRoom)
                .AsQueryable();

            if (roomId.HasValue)
                query = query.Where(c => c.ChatRoomId == roomId.Value);

            var logs = await query
                .OrderByDescending(c => c.StartedAt)
                .Take(200)
                .ToListAsync();

            var result = new List<CallLogDto>();
            foreach (var log in logs)
            {
                var dto = await BuildDto(log, userId);
                if (dto != null) result.Add(dto);
            }
            return result;
        }

        private async Task<CallLogDto?> BuildDto(CallLog log, Guid viewerId)
        {
            var wasOutgoing = log.CallerId == viewerId;
            var other = wasOutgoing ? log.Receiver : log.Caller;

            if (other == null)
            {
                other = await _context.Users.FindAsync(wasOutgoing ? log.ReceiverId : log.CallerId);
                if (other == null) return null;
            }

            return new CallLogDto
            {
                Id = log.Id,
                ChatRoomId = log.ChatRoomId,
                RoomName = log.ChatRoom?.Name ?? string.Empty,
                IsGroup = log.ChatRoom?.IsGroup ?? false,
                OtherUserId = other.Id,
                OtherUserName = other.UserName,
                OtherUserAvatarUrl = other.AvatarUrl,
                IsVideo = log.IsVideo,
                WasOutgoing = wasOutgoing,
                StartedAt = log.StartedAt,
                DurationSeconds = log.DurationSeconds,
                Status = log.Status
            };
        }
    }
}