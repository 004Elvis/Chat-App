using System.Security.Claims;
using ChatAppBackend.Data;
using ChatAppBackend.DTOs.Messages;
using ChatAppBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Hubs
{
    
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;

        private static readonly Dictionary<string, string> OnlineUsers = new();

        public ChatHub(ApplicationDbContext context)
        {
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            var userName = GetUserName();

            OnlineUsers[userId] = Context.ConnectionId;

            var roomIds = await _context.ChatRoomMembers
    .Where(m => m.UserId == Guid.Parse(userId))
    .Select(m => m.ChatRoomId)
    .ToListAsync();

            foreach (var roomId in roomIds)
                await Groups.AddToGroupAsync(
                    Context.ConnectionId, roomId.ToString());

            await Clients.Others.SendAsync("UserOnline", userId, userName);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            var userName = GetUserName();

            OnlineUsers.Remove(userId);

            var user = await _context.Users.FindAsync(Guid.Parse(userId));
            if (user != null)
            {
                user.LastSeenAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            await Clients.Others.SendAsync("UserOffline", userId, userName);
            await base.OnDisconnectedAsync(exception);
        }

      public async Task SendMessage(int roomId, string content)
    
{
    string messageType = "Text";
    Console.WriteLine($"=== SEND MESSAGE: room={roomId} content={content} ===");

    var userIdStr = GetUserId();
    Console.WriteLine($"=== USER ID: {userIdStr} ===");

    if (userIdStr == "UNKNOWN")
    {
        await Clients.Caller.SendAsync("Error", "Not authenticated");
        return;
    }

    var userId = Guid.Parse(userIdStr);

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

    var sender = await _context.Users.FindAsync(userId);

    var messageDto = new MessageDto
    {
        Id = message.Id,
        ChatRoomId = message.ChatRoomId,
        SenderId = message.SenderId,
        SenderUserName = sender?.UserName ?? "Unknown",
        SenderAvatarUrl = sender?.AvatarUrl,
        Content = message.Content,
        MessageType = message.MessageType,
        SentAt = message.SentAt,
        IsDeleted = false
    };

    await Clients.Group(roomId.ToString())
        .SendAsync("ReceiveMessage", messageDto);

    Console.WriteLine($"=== MESSAGE SAVED AND BROADCAST ===");
}
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

        public async Task LeaveRoom(int roomId)
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId, roomId.ToString());

            await Clients.Group(roomId.ToString())
                .SendAsync("UserLeft", roomId, GetUserId(), GetUserName());
        }

        public async Task StartTyping(int roomId)
        {
            await Clients.OthersInGroup(roomId.ToString())
                .SendAsync("UserTyping", roomId, GetUserName());
        }

        public async Task StopTyping(int roomId)
        {
            await Clients.OthersInGroup(roomId.ToString())
                .SendAsync("UserStoppedTyping", roomId, GetUserName());
        }

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

        // Updated to try multiple claim types
        private string GetUserId()
{
    return Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? Context.User?.FindFirstValue("sub")
        ?? Context.User?.FindFirstValue("nameid")
        ?? Context.UserIdentifier
        ?? "UNKNOWN";
}

        private string GetUserName() =>
            Context.User?.FindFirstValue(ClaimTypes.Name)
            ?? Context.User?.FindFirstValue("name")
            ?? throw new HubException("User not authenticated.");
    }
}