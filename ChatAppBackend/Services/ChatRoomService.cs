using ChatAppBackend.Data;
using ChatAppBackend.DTOs.ChatRooms;
using ChatAppBackend.DTOs.Messages;
using ChatAppBackend.DTOs.Users;
using ChatAppBackend.Models;
using ChatAppBackend.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Services
{
    public interface IChatRoomService
    {
        Task<List<ChatRoomDto>> GetUserRoomsAsync(Guid userId);
        Task<ChatRoomDto?> GetRoomByIdAsync(int roomId, Guid userId);
        Task<ChatRoomDto?> CreateRoomAsync(CreateChatRoomDto dto, Guid creatorId);
        Task<ChatRoomDto?> StartDirectMessageAsync(Guid otherUserId, Guid currentUserId);
        Task<bool> AddMemberAsync(int roomId, Guid userId, Guid requesterId);
        Task<(bool Success, string? Error)> RemoveMemberAsync(int roomId, Guid userId, Guid requesterId);
        Task<(bool Success, string? Error)> PromoteToAdminAsync(int roomId, Guid targetUserId, Guid requesterId);
        Task<bool> LeaveRoomAsync(int roomId, Guid userId);
        Task<bool> DeleteRoomAsync(int roomId, Guid requesterId);
        Task<List<MessageDto>> GetMessagesAsync(int roomId, Guid userId, int? cursor, int limit);
    }

    public class ChatRoomService : IChatRoomService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatRoomService(
            ApplicationDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task<List<ChatRoomDto>> GetUserRoomsAsync(Guid userId)
        {
            var rooms = await _context.ChatRoomMembers
                .Where(m => m.UserId == userId)
                .Include(m => m.ChatRoom)
                    .ThenInclude(r => r.Members)
                        .ThenInclude(m => m.User)
                .Select(m => m.ChatRoom)
                .ToListAsync();

            var result = new List<ChatRoomDto>();

            foreach (var room in rooms)
            {
                var lastMessage = await _context.Messages
                    .Where(msg => msg.ChatRoomId == room.Id && !msg.IsDeleted)
                    .OrderByDescending(msg => msg.SentAt)
                    .Include(msg => msg.Sender)
                    .FirstOrDefaultAsync();

                var member = room.Members.FirstOrDefault(m => m.UserId == userId);
                var unreadCount = 0;

                if (member?.LastReadMessageId != null)
                {
                    unreadCount = await _context.Messages
                        .Where(msg => msg.ChatRoomId == room.Id
                            && msg.Id > member.LastReadMessageId
                            && !msg.IsDeleted)
                        .CountAsync();
                }

                result.Add(MapToDto(room, lastMessage, unreadCount));
            }

            return result;
        }

        public async Task<ChatRoomDto?> GetRoomByIdAsync(int roomId, Guid userId)
        {
            var isMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId && m.UserId == userId);

            if (!isMember) return null;

            var room = await _context.ChatRooms
                .Include(r => r.Members)
                    .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(r => r.Id == roomId);

            if (room == null) return null;

            return MapToDto(room, null, 0);
        }

        public async Task<ChatRoomDto?> CreateRoomAsync(
            CreateChatRoomDto dto, Guid creatorId)
        {
            var room = new ChatRoom
            {
                Name = dto.Name,
                IsGroup = dto.IsGroup,
                CreatedByUserId = creatorId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ChatRooms.Add(room);
            await _context.SaveChangesAsync();

            var members = new List<ChatRoomMember>
            {
                new ChatRoomMember
                {
                    ChatRoomId = room.Id,
                    UserId = creatorId,
                    Role = "Admin",
                    JoinedAt = DateTime.UtcNow
                }
            };

            foreach (var memberId in dto.MemberIds)
            {
                if (memberId != creatorId)
                {
                    members.Add(new ChatRoomMember
                    {
                        ChatRoomId = room.Id,
                        UserId = memberId,
                        Role = "Member",
                        JoinedAt = DateTime.UtcNow
                    });
                }
            }

            _context.ChatRoomMembers.AddRange(members);
            await _context.SaveChangesAsync();

            return await GetRoomByIdAsync(room.Id, creatorId);
        }

        public async Task<ChatRoomDto?> StartDirectMessageAsync(
            Guid otherUserId, Guid currentUserId)
        {
            if (otherUserId == currentUserId) return null;

            var otherUserExists = await _context.Users
                .AnyAsync(u => u.Id == otherUserId);
            if (!otherUserExists) return null;

            var existingRoomId = await _context.ChatRooms
                .Where(r => !r.IsGroup)
                .Where(r => r.Members.Count == 2
                    && r.Members.Any(m => m.UserId == currentUserId)
                    && r.Members.Any(m => m.UserId == otherUserId))
                .Select(r => (int?)r.Id)
                .FirstOrDefaultAsync();

            if (existingRoomId.HasValue)
                return await GetRoomByIdAsync(existingRoomId.Value, currentUserId);

            var room = new ChatRoom
            {
                Name = string.Empty,
                IsGroup = false,
                CreatedByUserId = currentUserId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ChatRooms.Add(room);
            await _context.SaveChangesAsync();

            _context.ChatRoomMembers.AddRange(
                new ChatRoomMember
                {
                    ChatRoomId = room.Id,
                    UserId = currentUserId,
                    Role = "Member",
                    JoinedAt = DateTime.UtcNow
                },
                new ChatRoomMember
                {
                    ChatRoomId = room.Id,
                    UserId = otherUserId,
                    Role = "Member",
                    JoinedAt = DateTime.UtcNow
                }
            );

            await _context.SaveChangesAsync();

            return await GetRoomByIdAsync(room.Id, currentUserId);
        }

        public async Task<bool> AddMemberAsync(
            int roomId, Guid userId, Guid requesterId)
        {
            var isAdmin = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId
                    && m.UserId == requesterId
                    && m.Role == "Admin");

            if (!isAdmin) return false;

            var alreadyMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId && m.UserId == userId);

            if (alreadyMember) return false;

            _context.ChatRoomMembers.Add(new ChatRoomMember
            {
                ChatRoomId = roomId,
                UserId = userId,
                Role = "Member",
                JoinedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<(bool Success, string? Error)> RemoveMemberAsync(
            int roomId, Guid userId, Guid requesterId)
        {
            if (userId == requesterId)
                return (false, "Use 'Leave Group' to remove yourself.");

            var isAdmin = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId
                    && m.UserId == requesterId
                    && m.Role == "Admin");

            if (!isAdmin)
                return (false, "Only admins can remove members.");

            var member = await _context.ChatRoomMembers
                .FirstOrDefaultAsync(m => m.ChatRoomId == roomId
                    && m.UserId == userId);

            if (member == null)
                return (false, "That person is not a member of this room.");

            if (member.Role == "Admin")
                return (false, "Admins can't remove a fellow admin.");

            _context.ChatRoomMembers.Remove(member);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.Group(roomId.ToString())
                .SendAsync("MemberRemoved", roomId, userId);

            return (true, null);
        }

        public async Task<(bool Success, string? Error)> PromoteToAdminAsync(
            int roomId, Guid targetUserId, Guid requesterId)
        {
            Console.WriteLine($"[PROMOTE DEBUG] roomId={roomId}, requesterId={requesterId}, targetUserId={targetUserId}");

            var requesterMembership = await _context.ChatRoomMembers
                .Where(m => m.ChatRoomId == roomId && m.UserId == requesterId)
                .Select(m => new { m.UserId, m.Role })
                .FirstOrDefaultAsync();

            Console.WriteLine(requesterMembership == null
                ? "[PROMOTE DEBUG] No ChatRoomMember row found for this requesterId in this room at all."
                : $"[PROMOTE DEBUG] Found membership - Role='{requesterMembership.Role}'");

            var allMembers = await _context.ChatRoomMembers
                .Where(m => m.ChatRoomId == roomId)
                .Select(m => new { m.UserId, m.Role })
                .ToListAsync();
            Console.WriteLine("[PROMOTE DEBUG] All members in this room:");
            foreach (var m in allMembers)
                Console.WriteLine($"  - UserId={m.UserId}, Role={m.Role}");

            var isAdmin = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId
                    && m.UserId == requesterId
                    && m.Role == "Admin");

            if (!isAdmin)
                return (false, "Only admins can promote members.");

            var target = await _context.ChatRoomMembers
                .FirstOrDefaultAsync(m => m.ChatRoomId == roomId
                    && m.UserId == targetUserId);

            if (target == null)
                return (false, "That person is not a member of this room.");

            if (target.Role == "Admin")
                return (true, null);

            target.Role = "Admin";
            await _context.SaveChangesAsync();

            await _hubContext.Clients.Group(roomId.ToString())
                .SendAsync("MemberPromoted", roomId, targetUserId);

            return (true, null);
        }

        public async Task<bool> LeaveRoomAsync(int roomId, Guid userId)
        {
            var member = await _context.ChatRoomMembers
                .FirstOrDefaultAsync(m => m.ChatRoomId == roomId
                    && m.UserId == userId);

            if (member == null) return false;

            var wasAdmin = member.Role == "Admin";

            _context.ChatRoomMembers.Remove(member);
            await _context.SaveChangesAsync();

            var remainingMembers = await _context.ChatRoomMembers
                .Where(m => m.ChatRoomId == roomId)
                .OrderBy(m => m.JoinedAt)
                .ToListAsync();

            if (remainingMembers.Count == 0)
            {
                var room = await _context.ChatRooms.FindAsync(roomId);
                if (room != null)
                {
                    await _hubContext.Clients.Group(roomId.ToString())
                        .SendAsync("RoomDeleted", roomId);

                    _context.ChatRooms.Remove(room);
                    await _context.SaveChangesAsync();
                }
                return true;
            }

            if (wasAdmin && !remainingMembers.Any(m => m.Role == "Admin"))
            {
                remainingMembers[0].Role = "Admin";
                await _context.SaveChangesAsync();

                await _hubContext.Clients.Group(roomId.ToString())
                    .SendAsync("MemberPromoted", roomId, remainingMembers[0].UserId);
            }

            await _hubContext.Clients.Group(roomId.ToString())
                .SendAsync("MemberLeft", roomId, userId);

            return true;
        }

        public async Task<bool> DeleteRoomAsync(int roomId, Guid requesterId)
        {
            var isAdmin = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId
                    && m.UserId == requesterId
                    && m.Role == "Admin");

            if (!isAdmin) return false;

            var room = await _context.ChatRooms
                .FirstOrDefaultAsync(r => r.Id == roomId && r.IsGroup);

            if (room == null) return false;

            await _hubContext.Clients.Group(roomId.ToString())
                .SendAsync("RoomDeleted", roomId);

            _context.ChatRooms.Remove(room);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<List<MessageDto>> GetMessagesAsync(
            int roomId, Guid userId, int? cursor, int limit = 50)
        {
            var isMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId && m.UserId == userId);

            if (!isMember) return new List<MessageDto>();

            var query = _context.Messages
    .Where(m => m.ChatRoomId == roomId)
    .Include(m => m.Sender)
    .Include(m => m.ReplyToMessage)
        .ThenInclude(r => r!.Sender)
    .OrderByDescending(m => m.SentAt)
    .AsQueryable();

if (cursor.HasValue)
    query = query.Where(m => m.Id < cursor.Value);

var messages = await query.Take(limit).ToListAsync();

return messages.Select(m => new MessageDto
{
    Id = m.Id,
    ChatRoomId = m.ChatRoomId,
    SenderId = m.SenderId,
    SenderUserName = m.Sender.UserName,
    SenderAvatarUrl = m.Sender.AvatarUrl,
    Content = m.IsDeleted ? "This message was deleted" : m.Content,
    MessageType = m.MessageType,
    SentAt = m.SentAt,
    EditedAt = m.EditedAt,
    IsDeleted = m.IsDeleted,
    ReplyTo = m.ReplyToMessage == null ? null : new ReplyPreviewDto
    {
        Id = m.ReplyToMessage.Id,
        SenderUserName = m.ReplyToMessage.Sender.UserName,
        Content = m.ReplyToMessage.IsDeleted
            ? "This message was deleted"
            : m.ReplyToMessage.Content,
        IsDeleted = m.ReplyToMessage.IsDeleted
    }
}).ToList();
        }

        private ChatRoomDto MapToDto(
            ChatRoom room, Message? lastMessage, int unreadCount)
        {
            return new ChatRoomDto
            {
                Id = room.Id,
                Name = room.Name,
                IsGroup = room.IsGroup,
                CreatedAt = room.CreatedAt,
                UnreadCount = unreadCount,
                Members = room.Members.Select(m => new UserDto
                {
                    Id = m.User.Id,
                    UserName = m.User.UserName,
                    Email = m.User.Email,
                    AvatarUrl = m.User.AvatarUrl,
                    LastSeenAt = m.User.LastSeenAt
                }).ToList(),
                AdminUserIds = room.Members
                    .Where(m => m.Role == "Admin")
                    .Select(m => m.UserId)
                    .ToList(),
                LastMessage = lastMessage == null ? null : new MessageDto
                {
                    Id = lastMessage.Id,
                    ChatRoomId = lastMessage.ChatRoomId,
                    SenderId = lastMessage.SenderId,
                    SenderUserName = lastMessage.Sender.UserName,
                    SenderAvatarUrl = lastMessage.Sender.AvatarUrl,
                    Content = lastMessage.IsDeleted
                        ? "This message was deleted"
                        : lastMessage.Content,
                    SentAt = lastMessage.SentAt,
                    IsDeleted = lastMessage.IsDeleted
                }
            };
        }
    }
}