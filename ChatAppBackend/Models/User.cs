namespace ChatAppBackend.Models
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public bool IsEmailVerified { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastSeenAt { get; set; }

        // Navigation properties
        public ICollection<ChatRoomMember> ChatRoomMembers { get; set; } = new List<ChatRoomMember>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
        public ICollection<ChatRoom> CreatedRooms { get; set; } = new List<ChatRoom>();
    }
}