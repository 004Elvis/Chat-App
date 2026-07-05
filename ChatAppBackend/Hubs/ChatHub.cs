using System.Security.Claims;
using ChatAppBackend.Data;
using ChatAppBackend.DTOs.Messages;
using ChatAppBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;

        // Track online users: userId -> connectionId
        private static readonly Dictionary<string, string> OnlineUsers = new();

        public ChatHub(ApplicationDbContext context)
        {
            _context = context;
        }

        // Called automatically when a user connects
        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            var userName = GetUserName();

            // Track connection
            OnlineUsers[userId] = Context.ConnectionId;

            // Join all rooms this user belongs to
            var roomIds = await _context.ChatRoomMembers
                .Where(m => m.UserId == Guid.Parse(userId))
                .Select(m => m.ChatRoomId)
                .ToListAsync();

            foreach (var roomId in roomIds)
                await Groups.AddToGroupAsync(
                    Context.ConnectionId, roomId.ToString());

            // Notify others this user is online
            await Clients.Others.SendAsync("UserOnline", userId, userName);

            await base.OnConnectedAsync();
        }

        // Called automatically when a user disconnects
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            var userName = GetUserName();

            OnlineUsers.Remove(userId);

            // Update last seen
            var user = await _context.Users.FindAsync(Guid.Parse(userId));
            if (user != null)
            {
                user.LastSeenAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            // Notify others this user is offline
            await Clients.Others.SendAsync("UserOffline", userId, userName);

            await base.OnDisconnectedAsync(exception);
        }

        // Client calls this to send a message
        public async Task SendMessage(int roomId, string content,
            string messageType = "Text")
        {
            var userId = Guid.Parse(GetUserId());

            // Verify sender is a member of the room
            var isMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId && m.UserId == userId);

            if (!isMember)
            {
                await Clients.Caller.SendAsync("Error",
                    "You are not a member of this room.");
                return;
            }

            // Save message to database
            var message = new Message
            {
                ChatRoomId = roomId,
                SenderId = userId,
                Content = content,
                MessageType = messageType,
                SentAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            // Load sender details for the DTO
            var sender = await _context.Users.FindAsync(userId);

            var messageDto = new MessageDto
            {
                Id = message.Id,
                ChatRoomId = message.ChatRoomId,
                SenderId = message.SenderId,
                SenderUserName = sender!.UserName,
                SenderAvatarUrl = sender.AvatarUrl,
                Content = message.Content,
                MessageType = message.MessageType,
                SentAt = message.SentAt,
                IsDeleted = false
            };

            // Broadcast to everyone in the room (including sender)
            await Clients.Group(roomId.ToString())
                .SendAsync("ReceiveMessage", messageDto);
        }

        // Client calls this to join a specific room
        public async Task JoinRoom(int roomId)
        {
            var userId = Guid.Parse(GetUserId());

            var isMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == roomId && m.UserId == userId);

            if (!isMember) return;

            await Groups.AddToGroupAsync(
                Context.ConnectionId, roomId.ToString());

            await Clients.Group(roomId.ToString())
                .SendAsync("UserJoined", roomId, GetUserId(), GetUserName());
        }

        // Client calls this to leave a room
        public async Task LeaveRoom(int roomId)
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId, roomId.ToString());

            await Clients.Group(roomId.ToString())
                .SendAsync("UserLeft", roomId, GetUserId(), GetUserName());
        }

        // Client calls this when user starts typing
        public async Task StartTyping(int roomId)
        {
            await Clients.OthersInGroup(roomId.ToString())
                .SendAsync("UserTyping", roomId, GetUserName());
        }

        // Client calls this when user stops typing
        public async Task StopTyping(int roomId)
        {
            await Clients.OthersInGroup(roomId.ToString())
                .SendAsync("UserStoppedTyping", roomId, GetUserName());
        }

        // Client calls this to mark messages as read
        public async Task MarkAsRead(int roomId, int messageId)
        {
            var userId = Guid.Parse(GetUserId());

            var member = await _context.ChatRoomMembers
                .FirstOrDefaultAsync(m =>
                    m.ChatRoomId == roomId && m.UserId == userId);

            if (member == null) return;

            member.LastReadMessageId = messageId;
            await _context.SaveChangesAsync();

            await Clients.Group(roomId.ToString())
                .SendAsync("MessageRead", roomId, messageId, GetUserId());
        }

        // Helper: get current user ID from JWT claims
        private string GetUserId() =>
            Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new HubException("User not authenticated.");

        // Helper: get current username from JWT claims
        private string GetUserName() =>
            Context.User?.FindFirstValue(ClaimTypes.Name)
            ?? throw new HubException("User not authenticated.");
    }
}