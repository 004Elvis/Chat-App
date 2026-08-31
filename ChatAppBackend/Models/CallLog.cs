namespace ChatAppBackend.Models
{
    public class CallLog
    {
        public int Id { get; set; }
        public int ChatRoomId { get; set; }
        public Guid CallerId { get; set; }
        public Guid ReceiverId { get; set; }
        public bool IsVideo { get; set; }
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        public DateTime? EndedAt { get; set; }
        public int DurationSeconds { get; set; } = 0;

        // "Completed", "Rejected", "Missed", "Cancelled" (caller hung
        // up before it was answered)
        public string Status { get; set; } = "Missed";

        public ChatRoom ChatRoom { get; set; } = null!;
        public User Caller { get; set; } = null!;
        public User Receiver { get; set; } = null!;
    }
}