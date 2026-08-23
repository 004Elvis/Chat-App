namespace ChatAppBackend.Models
{
    public class GroupKeyEntry
    {
        public int Id { get; set; }
        public int ChatRoomId { get; set; }
        public int KeyVersion { get; set; }
        public Guid UserId { get; set; }

        public string EncryptedKey { get; set; } = string.Empty;

    
        public string DistributorPublicKey { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ChatRoom ChatRoom { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}