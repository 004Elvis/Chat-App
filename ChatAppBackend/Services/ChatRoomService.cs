using ChatAppBackend.Data;
using ChatAppBackend.DTOs.ChatRooms;
using ChatAppBackend.DTOs.Messages;
using ChatAppBackend.DTOs.Users;
using ChatAppBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Services
{
    public interface IChatRoomService
    {
        Task<List<ChatRoomDto>> GetUserRoomsAsync(Guid userId);
        Task<ChatRoomDto?> GetRoomByIdAsync(int roomId, Guid userId);
        Task<ChatRoomDto?> CreateRoomAsync(CreateChatRoomDto dto, Guid creatorId);
        Task<bool> AddMemberAsync(int roomId, Guid userId, Guid requesterId);
        Task<bool> RemoveMemberAsync(int roomId, Guid userId, Guid requesterId);
        Task<List<MessageDto>> GetMessagesAsync(int roomId, Guid userId, int? cursor, int limit);
    }

    public class ChatRoomService : IChatRoomService
    {
        private readonly ApplicationDbContext _context;

        public ChatRoomService(ApplicationDbContext context)
        {
            _context = context;
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

            // Add creator as admin member
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

            // Add other members
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

        public async Task<bool> RemoveMemberAsync(
            int roomId, Guid userId, Guid requesterId)
        {
            var isAdmin = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId
                    && m.UserId == requesterId
                    && m.Role == "Admin");

            if (!isAdmin) return false;

            var member = await _context.ChatRoomMembers
                .FirstOrDefaultAsync(m => m.ChatRoomId == roomId
                    && m.UserId == userId);

            if (member == null) return false;

            _context.ChatRoomMembers.Remove(member);
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
                IsDeleted = m.IsDeleted
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