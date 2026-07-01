namespace ChatAppBackend.DTOs.Messages
{
    public class MessageDto
    {
        public int Id { get; set; }
        public int ChatRoomId { get; set; }
        public Guid SenderId { get; set; }
        public string SenderUserName { get; set; } = string.Empty;
        public string? SenderAvatarUrl { get; set; }
        public string Content { get; set; } = string.Empty;
        public string MessageType { get; set; } = "Text";
        public DateTime SentAt { get; set; }
        public DateTime? EditedAt { get; set; }
        public bool IsDeleted { get; set; }
    }
}