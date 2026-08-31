namespace ChatAppBackend.DTOs.Calls
{
    public class CallLogDto
    {
        public int Id { get; set; }
        public int ChatRoomId { get; set; }
        public string RoomName { get; set; } = string.Empty;
        public bool IsGroup { get; set; }
        public Guid OtherUserId { get; set; }
        public string OtherUserName { get; set; } = string.Empty;
        public string? OtherUserAvatarUrl { get; set; }
        public bool IsVideo { get; set; }
        public bool WasOutgoing { get; set; }
        public DateTime StartedAt { get; set; }
        public int DurationSeconds { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class LogCallDto
    {
        public int ChatRoomId { get; set; }
        public Guid ReceiverId { get; set; }
        public bool IsVideo { get; set; }
        public int DurationSeconds { get; set; }
        public string Status { get; set; } = string.Empty;
    }
}