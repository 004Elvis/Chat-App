namespace ChatAppBackend.Models
{
    public class Message
    {
        public int Id { get; set; }
        public int ChatRoomId { get; set; }
        public Guid SenderId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string MessageType { get; set; } = "Text"; // Text, Image, File, System
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime? EditedAt { get; set; }
        public bool IsDeleted { get; set; } = false;

        // Navigation properties
        public ChatRoom ChatRoom { get; set; } = null!;
        public User Sender { get; set; } = null!;
        public ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
    }
}