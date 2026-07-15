namespace ChatAppBackend.Models
{
    public class EmailVerificationToken
    {
        public int Id { get; set; }
        public Guid UserId { get; set; }
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; } = false;
        public User User { get; set; } = null!;
    }
}
