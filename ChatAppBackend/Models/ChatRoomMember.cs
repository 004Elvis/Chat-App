namespace ChatAppBackend.Models
{
    public class ChatRoomMember
    {
        public int Id { get; set; }
        public int ChatRoomId { get; set; }
        public Guid UserId { get; set; }
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public string Role { get; set; } = "Member"; // "Admin" or "Member"
        public int? LastReadMessageId { get; set; }

        // Navigation properties
        public ChatRoom ChatRoom { get; set; } = null!;
        public User User { get; set; } = null!;
        public Message? LastReadMessage { get; set; }
    }
}  