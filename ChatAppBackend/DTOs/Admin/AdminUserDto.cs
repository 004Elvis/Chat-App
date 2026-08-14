namespace ChatAppBackend.DTOs.Admin
{
    public class AdminUserDto
    {
        public Guid Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public bool IsEmailVerified { get; set; }
        public bool IsSiteAdmin { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastSeenAt { get; set; }
    }
}